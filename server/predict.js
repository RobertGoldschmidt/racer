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
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function computeStats(workouts) {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
  const paces = sorted.map(w => w.duration_minutes / w.distance_km);
  const totalKm = sorted.reduce((s, w) => s + w.distance_km, 0);
  const numDays = sorted.length;
  const avgPace = (paces.reduce((s, p) => s + p, 0) / paces.length).toFixed(2);
  const fastestPace = Math.min(...paces).toFixed(2);
  const longestRun = Math.max(...sorted.map(w => w.distance_km));

  const intervals = sorted.filter(w => w.workout_type === 'intervals' && w.interval_time_seconds);
  let intervalInfo = '';
  if (intervals.length) {
    const avgIntervalPace = (intervals.reduce((s, w) => s + w.interval_time_seconds, 0) / intervals.length).toFixed(0);
    intervalInfo = `Avg interval pace: ${avgIntervalPace}s/km over ${intervals.length} sessions.`;
  }

  return `COMPUTED STATS: ${numDays} workouts, ${totalKm.toFixed(1)}km total, avg pace ${avgPace} min/km, fastest pace ${fastestPace} min/km, longest run ${longestRun}km. ${intervalInfo}`;
}

async function predict10k(workouts) {
  if (!workouts.length) {
    return { predicted_time: null, confidence: 'low', reasoning: 'No workout data available. Log some runs first!' };
  }

  const trainingLog = workouts.map(w => {
    const pace = (w.duration_minutes / w.distance_km).toFixed(2);
    let line = `${w.date} | ${w.distance_km}km in ${w.duration_minutes}min (${pace} min/km) | Type: ${w.workout_type} | Effort: ${w.perceived_effort}`;
    if (w.warmup_km) line += ` | Warmup: ${w.warmup_km}km`;
    if (w.cooldown_km) line += ` | Cooldown: ${w.cooldown_km}km`;
    if (w.interval_distance_m) line += ` | Intervals: ${w.interval_reps}x${w.interval_distance_m}m at ${w.interval_time_seconds}s/km pace, ${w.interval_recovery_type} recovery ${w.interval_recovery_time}s`;
    if (w.tempo_distance_km) line += ` | Tempo: ${w.tempo_distance_km}km at ${w.tempo_time_seconds}s/km pace`;
    if (w.max_heart_rate) line += ` | maxHR: ${w.max_heart_rate}`;
    if (w.avg_heart_rate) line += ` | HR: ${w.avg_heart_rate}`;
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
