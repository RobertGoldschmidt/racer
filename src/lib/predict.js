import { calcVDOT, predictRaceTime, vdotFromThresholdPace, vdotFromIntervalPace } from './vdot.js';

// Parse a YYYY-MM-DD string as local midnight (not UTC) to avoid off-by-one timezone errors
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

function effortFromHR(avgHR, maxHR) {
  if (!avgHR) return 'moderate';
  const pct = avgHR / maxHR;
  if (pct >= 0.9) return 'max';
  if (pct >= 0.8) return 'hard';
  if (pct >= 0.7) return 'moderate';
  if (pct >= 0.6) return 'easy';
  return 'recovery';
}

function secondsToTime(s) {
  let m = Math.floor(s / 60);
  let sec = Math.round(s % 60);
  if (sec === 60) { m++; sec = 0; }
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function extractVDOTs(workouts, asOf, maxHR = 191) {
  const ref = asOf || Date.now();
  const estimates = [];

  for (const w of workouts) {
    const ageMs = ref - parseDate(w.date);
    if (ageMs < 0) continue;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (w.workout_type === 'race' && w.distance_km && w.duration_minutes) {
      const distanceM = w.distance_km * 1000;
      const vdot = calcVDOT(distanceM, w.duration_minutes);
      const effort = effortFromHR(w.avg_heart_rate, maxHR);
      let effortBonus = 0;
      if (effort === 'hard' || effort === 'max') effortBonus = 0.05;
      if (effort === 'easy') effortBonus = -0.1;
      estimates.push({
        vdot,
        type: 'race',
        reliability: 1.0 + effortBonus,
        ageDays,
        source: `${w.distance_km}km race on ${w.date} in ${secondsToTime(w.duration_minutes * 60)}`,
        workout: w,
      });
    }

    if (w.workout_type === 'tempo' && w.tempo_time_seconds && w.tempo_distance_km) {
      const vdot = vdotFromThresholdPace(w.tempo_time_seconds);
      estimates.push({
        vdot,
        type: 'tempo',
        reliability: 0.85,
        ageDays,
        source: `Tempo on ${w.date} at ${secondsToTime(w.tempo_time_seconds)} /km`,
        workout: w,
      });
    }

    if (w.workout_type === 'intervals' && w.interval_time_seconds && w.interval_distance_m) {
      const vdot = vdotFromIntervalPace(w.interval_time_seconds);
      estimates.push({
        vdot,
        type: 'intervals',
        reliability: 0.75,
        ageDays,
        source: `Intervals on ${w.date} at ${secondsToTime(w.interval_time_seconds)} /km`,
        workout: w,
      });
    }
  }

  return estimates;
}

function rankEstimates(estimates) {
  const HALF_LIFE_DAYS = 30;
  const decay = Math.LN2 / HALF_LIFE_DAYS;

  return estimates
    .map(e => {
      const recency = Math.exp(-decay * e.ageDays);
      const score = e.reliability * recency;
      return { ...e, recency, score };
    })
    .sort((a, b) => b.score - a.score);
}

function computeAdjustments(workouts, asOf) {
  const ref = asOf || Date.now();
  const fourWeeksAgo = ref - 28 * 24 * 60 * 60 * 1000;
  const recent = workouts.filter(w => {
    const t = parseDate(w.date);
    return t >= fourWeeksAgo && t <= ref;
  });

  let adj = 0;
  const reasons = [];

  const totalKm = recent.reduce((s, w) => s + (w.distance_km || 0), 0);
  const weeklyKm = totalKm / 4;
  if (weeklyKm >= 40) {
    adj -= 15;
    reasons.push(`high volume (${weeklyKm.toFixed(0)} km/wk, -15s)`);
  } else if (weeklyKm < 15) {
    adj += 20;
    reasons.push(`low volume (${weeklyKm.toFixed(0)} km/wk, +20s)`);
  }

  const workoutsPerWeek = recent.length / 4;
  if (workoutsPerWeek >= 5) {
    adj -= 10;
    reasons.push(`consistent training (${workoutsPerWeek.toFixed(1)}/wk, -10s)`);
  } else if (workoutsPerWeek < 2) {
    adj += 15;
    reasons.push(`low frequency (${workoutsPerWeek.toFixed(1)}/wk, +15s)`);
  }

  const hasLongRun = recent.some(w => w.distance_km >= 12);
  if (hasLongRun) {
    adj -= 5;
    reasons.push('long run present (-5s)');
  }

  // Cap at ±45s: max individual adjustments sum to 45s (20+10+15), so allow the full range
  adj = Math.max(-45, Math.min(45, adj));

  return { adjustmentSeconds: adj, reasons };
}

function determineConfidence(ranked, allWorkouts) {
  let score = 0;

  if (ranked.length > 0) {
    if (ranked[0].type === 'race') score += 3;
    else if (ranked[0].type === 'tempo') score += 2;
    else score += 1;
  }

  if (ranked.length > 0 && ranked[0].ageDays < 14) score += 2;
  else if (ranked.length > 0 && ranked[0].ageDays < 30) score += 1;

  if (ranked.length >= 2) {
    const diff = Math.abs(ranked[0].vdot - ranked[1].vdot);
    if (diff < 2) score += 2;
    else if (diff < 4) score += 1;
  }

  if (allWorkouts.length >= 10) score += 1;

  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

export function predict10k(workouts, maxHR = 191) {
  if (!workouts.length) {
    return { predicted_time: null, confidence: 'low', reasoning: 'No workout data available. Log some runs first!' };
  }

  const estimates = extractVDOTs(workouts, undefined, maxHR);

  if (!estimates.length) {
    return {
      predicted_time: null,
      confidence: 'low',
      reasoning: 'No qualifying workouts found. Log a race, tempo, or interval session to get a prediction.',
    };
  }

  const ranked = rankEstimates(estimates);
  const top = ranked.slice(0, 3);

  const totalWeight = top.reduce((s, e) => s + e.score, 0);
  const vdot = top.reduce((s, e) => s + e.vdot * e.score, 0) / totalWeight;

  const rawTimeMinutes = predictRaceTime(vdot, 10000);
  const rawTimeSeconds = rawTimeMinutes * 60;

  const { adjustmentSeconds, reasons: adjReasons } = computeAdjustments(workouts);
  const finalTimeSeconds = rawTimeSeconds + adjustmentSeconds;

  const confidence = determineConfidence(ranked, workouts);

  const primary = top[0];
  let reasoning = `Based on ${primary.source} (VDOT ${vdot.toFixed(1)})`;
  if (top.length > 1) {
    reasoning += `, cross-referenced with ${top.length - 1} other workout(s)`;
  }
  reasoning += `. Raw 10K prediction: ${secondsToTime(Math.round(rawTimeSeconds))}`;
  if (adjustmentSeconds !== 0) {
    reasoning += `. Adjustments: ${adjReasons.join(', ')} (net ${adjustmentSeconds > 0 ? '+' : ''}${adjustmentSeconds}s)`;
  }
  reasoning += '. Calculated using Jack Daniels\' VDOT methodology.';

  return {
    predicted_time: secondsToTime(Math.round(finalTimeSeconds)),
    confidence,
    reasoning,
  };
}

export function buildProgress(workouts, maxHR = 191) {
  const points = [];
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  const byDate = [];
  for (let i = 0; i < sorted.length; i++) {
    const isLastOfDate = i === sorted.length - 1 || sorted[i].date !== sorted[i + 1].date;
    if (isLastOfDate) byDate.push({ date: sorted[i].date, upToIndex: i });
  }

  for (const { date, upToIndex } of byDate) {
    const [y, m, d] = date.split('-').map(Number);
    const asOf = new Date(y, m - 1, d).getTime() + 86400000 - 1;
    const available = sorted.slice(0, upToIndex + 1);

    const estimates = extractVDOTs(available, asOf, maxHR);
    if (!estimates.length) continue;

    const ranked = rankEstimates(estimates);
    const top = ranked.slice(0, 3);
    const totalWeight = top.reduce((s, e) => s + e.score, 0);
    const vdot = top.reduce((s, e) => s + e.vdot * e.score, 0) / totalWeight;

    const rawSeconds = predictRaceTime(vdot, 10000) * 60;
    const { adjustmentSeconds } = computeAdjustments(available, asOf);
    const finalSeconds = rawSeconds + adjustmentSeconds;

    points.push({
      date,
      vdot: Math.round(vdot * 10) / 10,
      tenK_seconds: Math.round(finalSeconds),
      predicted_time: secondsToTime(Math.round(finalSeconds)),
    });
  }

  return points;
}
