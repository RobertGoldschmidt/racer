const { calcVDOT, predictRaceTime, vdotFromThresholdPace, vdotFromIntervalPace } = require('./vdot');

function secondsToTime(s) {
  let m = Math.floor(s / 60);
  let sec = Math.round(s % 60);
  if (sec === 60) { m++; sec = 0; }
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Extract VDOT estimates from qualifying workouts
 */
function extractVDOTs(workouts) {
  const now = Date.now();
  const estimates = [];

  for (const w of workouts) {
    const ageMs = now - new Date(w.date).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Race results -> direct VDOT calculation
    if (w.workout_type === 'race' && w.distance_km && w.duration_minutes) {
      const distanceM = w.distance_km * 1000;
      const vdot = calcVDOT(distanceM, w.duration_minutes);
      let effortBonus = 0;
      if (w.perceived_effort === 'hard' || w.perceived_effort === 'max') effortBonus = 0.05;
      if (w.perceived_effort === 'easy') effortBonus = -0.1;
      estimates.push({
        vdot,
        type: 'race',
        reliability: 1.0 + effortBonus,
        ageDays,
        source: `${w.distance_km}km race on ${w.date} in ${secondsToTime(w.duration_minutes * 60)}`,
        workout: w,
      });
    }

    // Tempo workouts -> VDOT from threshold pace
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

    // Interval workouts -> VDOT from interval pace
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

/**
 * Score and rank VDOT estimates using weighted scoring
 */
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

/**
 * Compute training adjustments (clamped to +/- 30s)
 */
function computeAdjustments(workouts) {
  const now = Date.now();
  const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000;
  const recent = workouts.filter(w => new Date(w.date).getTime() >= fourWeeksAgo);

  let adj = 0;
  const reasons = [];

  // Volume: weekly km in last 4 weeks
  const totalKm = recent.reduce((s, w) => s + (w.distance_km || 0), 0);
  const weeklyKm = totalKm / 4;
  if (weeklyKm >= 40) {
    adj -= 15;
    reasons.push(`high volume (${weeklyKm.toFixed(0)} km/wk, -15s)`);
  } else if (weeklyKm < 15) {
    adj += 20;
    reasons.push(`low volume (${weeklyKm.toFixed(0)} km/wk, +20s)`);
  }

  // Consistency: workouts per week
  const workoutsPerWeek = recent.length / 4;
  if (workoutsPerWeek >= 5) {
    adj -= 10;
    reasons.push(`consistent training (${workoutsPerWeek.toFixed(1)}/wk, -10s)`);
  } else if (workoutsPerWeek < 2) {
    adj += 15;
    reasons.push(`low frequency (${workoutsPerWeek.toFixed(1)}/wk, +15s)`);
  }

  // Long run presence
  const hasLongRun = recent.some(w => w.distance_km >= 12);
  if (hasLongRun) {
    adj -= 5;
    reasons.push('long run present (-5s)');
  }

  // Clamp to +/- 30s
  adj = Math.max(-30, Math.min(30, adj));

  return { adjustmentSeconds: adj, reasons };
}

/**
 * Determine confidence from data quality
 */
function determineConfidence(ranked, allWorkouts) {
  let score = 0;

  // Source quality
  if (ranked.length > 0) {
    if (ranked[0].type === 'race') score += 3;
    else if (ranked[0].type === 'tempo') score += 2;
    else score += 1;
  }

  // Recency of primary source
  if (ranked.length > 0 && ranked[0].ageDays < 14) score += 2;
  else if (ranked.length > 0 && ranked[0].ageDays < 30) score += 1;

  // Agreement between estimates
  if (ranked.length >= 2) {
    const diff = Math.abs(ranked[0].vdot - ranked[1].vdot);
    if (diff < 2) score += 2;
    else if (diff < 4) score += 1;
  }

  // Training data volume
  if (allWorkouts.length >= 10) score += 1;

  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

async function predict10k(workouts) {
  if (!workouts.length) {
    return { predicted_time: null, confidence: 'low', reasoning: 'No workout data available. Log some runs first!' };
  }

  // Extract VDOT estimates from qualifying workouts
  const estimates = extractVDOTs(workouts);

  if (!estimates.length) {
    return {
      predicted_time: null,
      confidence: 'low',
      reasoning: 'No qualifying workouts found. Log a race, tempo, or interval session to get a prediction.',
    };
  }

  // Rank and select top estimates
  const ranked = rankEstimates(estimates);
  const top = ranked.slice(0, 3);

  // Weighted average VDOT from top estimates
  const totalWeight = top.reduce((s, e) => s + e.score, 0);
  const vdot = top.reduce((s, e) => s + e.vdot * e.score, 0) / totalWeight;

  // Predict raw 10K time
  const rawTimeMinutes = predictRaceTime(vdot, 10000);
  const rawTimeSeconds = rawTimeMinutes * 60;

  // Apply training adjustments
  const { adjustmentSeconds, reasons: adjReasons } = computeAdjustments(workouts);
  const finalTimeSeconds = rawTimeSeconds + adjustmentSeconds;

  // Determine confidence
  const confidence = determineConfidence(ranked, workouts);

  // Build reasoning
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

module.exports = { predict10k };
