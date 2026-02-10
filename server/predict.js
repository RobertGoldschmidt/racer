const { spawn } = require('child_process');

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const NUM_RUNS = 3;

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLAUDE_BIN, ['-p', '--output-format', 'text', '--model', 'claude-opus-4-6', '--max-turns', '1'], { killSignal: 'SIGKILL' });
    let stdout = '';
    let stderr = '';
    let timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('Claude timed out after 10 minutes')); }, 600000);
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      clearTimeout(timer);
      if (code !== 0 && code !== null) return reject(new Error(stderr || `claude exited with code ${code}`));
      if (!stdout.trim()) return reject(new Error(stderr || 'Claude returned empty response'));
      resolve(stdout.trim());
    });
    proc.on('error', err => { clearTimeout(timer); reject(err); });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

function timeToSeconds(t) {
  const [m, s] = t.split(':').map(Number);
  return m * 60 + s;
}

function secondsToTime(s) {
  let m = Math.floor(s / 60);
  let sec = Math.round(s % 60);
  if (sec === 60) { m++; sec = 0; }
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function computeStats(workouts) {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));

  // Only use workouts without warmup/cooldown for pace stats (otherwise avg is diluted)
  const pureWorkouts = sorted.filter(w => !w.warmup_km && !w.cooldown_km);
  const paces = pureWorkouts.map(w => w.duration_minutes / w.distance_km);

  const totalKm = sorted.reduce((s, w) => s + w.distance_km, 0);
  const numDays = sorted.length;
  const fmtPace = (p) => { let m = Math.floor(p); let s = Math.round((p - m) * 60); if (s === 60) { m++; s = 0; } return `${m}:${s.toString().padStart(2, '0')}`; };
  const avgPace = paces.length ? fmtPace(paces.reduce((s, p) => s + p, 0) / paces.length) : 'N/A';
  const longestRun = Math.max(...sorted.map(w => w.distance_km));

  const intervals = sorted.filter(w => w.workout_type === 'intervals' && w.interval_time_seconds);
  const tempos = sorted.filter(w => w.workout_type === 'tempo' && w.tempo_time_seconds);

  let qualityInfo = '';
  if (intervals.length) {
    const avgIntervalPace = intervals.reduce((s, w) => s + w.interval_time_seconds, 0) / intervals.length;
    qualityInfo += `Avg interval pace: ${fmtPace(avgIntervalPace / 60)} min/km (${intervals.length} sessions). `;
  }
  if (tempos.length) {
    const avgTempoPace = tempos.reduce((s, w) => s + w.tempo_time_seconds, 0) / tempos.length;
    qualityInfo += `Avg tempo pace: ${fmtPace(avgTempoPace / 60)} min/km (${tempos.length} sessions). `;
  }

  return `COMPUTED STATS: ${numDays} workouts, ${totalKm.toFixed(1)}km total, longest run ${longestRun}km. ${qualityInfo}Easy run avg: ${avgPace} min/km.`;
}

async function predict10k(workouts) {
  if (!workouts.length) {
    return { predicted_time: null, confidence: 'low', reasoning: 'No workout data available. Log some runs first!' };
  }

  const trainingLog = workouts.map(w => {
    const hasWarmupCooldown = w.warmup_km || w.cooldown_km;
    const isIntervalsOrTempo = w.workout_type === 'intervals' || w.workout_type === 'tempo';

    let line = `${w.date} | ${w.distance_km}km in ${w.duration_minutes}min`;

    // Only show avg pace if no warmup/cooldown (otherwise it's misleading)
    if (!hasWarmupCooldown) {
      const paceRaw = w.duration_minutes / w.distance_km;
      const paceMin = Math.floor(paceRaw);
      const paceSec = Math.round((paceRaw - paceMin) * 60);
      const pace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;
      line += ` (${pace} min/km)`;
    }

    line += ` | Type: ${w.workout_type} | Effort: ${w.perceived_effort}`;

    if (w.warmup_km) line += ` | Warmup: ${w.warmup_km}km`;
    if (w.cooldown_km) line += ` | Cooldown: ${w.cooldown_km}km`;
    if (w.interval_distance_m) line += ` | Intervals: ${w.interval_reps}x${w.interval_distance_m}m at ${w.interval_time_seconds}s/km pace, ${w.interval_recovery_type} recovery ${w.interval_recovery_time}s`;
    if (w.tempo_distance_km) line += ` | Tempo: ${w.tempo_distance_km}km at ${w.tempo_time_seconds}s/km pace`;
    if (w.max_heart_rate) line += ` | maxHR: ${w.max_heart_rate}`;

    // Only show avg HR for non-interval/tempo workouts (for those, max HR is more relevant)
    if (w.avg_heart_rate && !isIntervalsOrTempo) line += ` | HR: ${w.avg_heart_rate}`;

    if (w.elevation_m) line += ` | Elev: ${w.elevation_m}m`;
    if (w.notes) line += ` | Notes: ${w.notes}`;
    return line;
  }).join('\n');

  const stats = computeStats(workouts);

  const prompt = `You are an expert running coach. Predict a 10K race time using EXACTLY this method:
1. Identify the best representative race-effort workout (tempo, intervals, or race)
2. Convert that pace to VDOT using Jack Daniels tables
3. Look up the 10K equivalent from that VDOT
4. Adjust by +/- 30s max based on training volume and consistency
Be precise and deterministic. Return ONLY valid JSON: {"predicted_time":"mm:ss","confidence":"low|medium|high","reasoning":"2-3 sentences"}

${stats}

${trainingLog}`;

  console.log('--- PREDICTION PROMPT ---');
  console.log(prompt);
  console.log('--- END PROMPT ---');

  // Run multiple predictions in parallel and average
  const promises = [];
  for (let i = 0; i < NUM_RUNS; i++) {
    promises.push(runClaude(prompt));
  }
  const results = await Promise.all(promises);

  const times = [];
  let lastReasoning = '';
  for (const text of results) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.predicted_time) {
          times.push(timeToSeconds(parsed.predicted_time));
          lastReasoning = parsed.reasoning;
        }
      } catch (e) {}
    }
  }

  if (!times.length) {
    return { predicted_time: 'N/A', confidence: 'low', reasoning: results[0], prompt };
  }

  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const spread = Math.max(...times) - Math.min(...times);
  const confidence = spread <= 60 ? 'high' : spread <= 120 ? 'medium' : 'low';
  const individual = times.map(t => secondsToTime(t)).join(', ');

  return {
    predicted_time: secondsToTime(avg),
    confidence,
    reasoning: `${lastReasoning} [${NUM_RUNS} predictions averaged: ${individual}, spread: ${spread}s]`,
    prompt,
  };
}

module.exports = { predict10k };
