require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb, save } = require('./db');
const { predict10k } = require('./predict');

const app = express();

// Restrict to a configured origin (default: local Vite dev server)
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

// --- Input validation ---

const VALID_TYPES = ['easy', 'tempo', 'intervals', 'long_run', 'race'];
const VALID_RECOVERY = ['walk', 'jog'];

function validateWorkout(body) {
  const errors = [];
  const { date, distance_km, duration_minutes, workout_type } = body;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('date must be in YYYY-MM-DD format');
  } else if (new Date(date) > new Date()) {
    errors.push('date cannot be in the future');
  }

  if (distance_km == null || typeof distance_km !== 'number' || distance_km <= 0 || distance_km > 1000) {
    errors.push('distance_km must be a positive number (max 1000)');
  }

  if (duration_minutes == null || typeof duration_minutes !== 'number' || duration_minutes <= 0 || duration_minutes > 1440) {
    errors.push('duration_minutes must be between 0 and 1440');
  }

  if (!workout_type || !VALID_TYPES.includes(workout_type)) {
    errors.push(`workout_type must be one of: ${VALID_TYPES.join(', ')}`);
  }

  if (body.avg_heart_rate != null && (body.avg_heart_rate < 30 || body.avg_heart_rate > 300)) {
    errors.push('avg_heart_rate must be between 30 and 300');
  }

  if (body.elevation_m != null && (body.elevation_m < -500 || body.elevation_m > 10000)) {
    errors.push('elevation_m is out of range');
  }

  if (body.interval_time_seconds != null && body.interval_time_seconds <= 0) {
    errors.push('interval_time_seconds must be positive');
  }

  if (body.tempo_time_seconds != null && body.tempo_time_seconds <= 0) {
    errors.push('tempo_time_seconds must be positive');
  }

  if (body.interval_recovery_type != null && !VALID_RECOVERY.includes(body.interval_recovery_type)) {
    errors.push(`interval_recovery_type must be one of: ${VALID_RECOVERY.join(', ')}`);
  }

  return errors;
}

// --- Routes ---

app.get('/api/workouts', async (req, res) => {
  const db = await getDb();
  const results = db.exec('SELECT * FROM workouts ORDER BY date DESC');
  if (!results.length) return res.json([]);
  const cols = results[0].columns;
  const rows = results[0].values.map(row => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = row[i]);
    return obj;
  });
  res.json(rows);
});

app.post('/api/workouts', async (req, res) => {
  const errors = validateWorkout(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const db = await getDb();
  const { date, distance_km, duration_minutes, avg_heart_rate, elevation_m, workout_type, notes, warmup_km, cooldown_km, interval_distance_m, interval_reps, interval_recovery_type, interval_recovery_time, interval_time_seconds, tempo_distance_km, tempo_time_seconds } = req.body;
  db.run(
    `INSERT INTO workouts (date, distance_km, duration_minutes, avg_heart_rate, elevation_m, workout_type, notes, warmup_km, cooldown_km, interval_distance_m, interval_reps, interval_recovery_type, interval_recovery_time, interval_time_seconds, tempo_distance_km, tempo_time_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [date, distance_km, duration_minutes, avg_heart_rate || null, elevation_m || null, workout_type || 'easy', notes || null, warmup_km || null, cooldown_km || null, interval_distance_m || null, interval_reps || null, interval_recovery_type || null, interval_recovery_time || null, interval_time_seconds || null, tempo_distance_km || null, tempo_time_seconds || null]
  );
  save();
  res.json({ ok: true });
});

app.put('/api/workouts/:id', async (req, res) => {
  const errors = validateWorkout(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const db = await getDb();
  const { date, distance_km, duration_minutes, avg_heart_rate, elevation_m, workout_type, notes, warmup_km, cooldown_km, interval_distance_m, interval_reps, interval_recovery_type, interval_recovery_time, interval_time_seconds, tempo_distance_km, tempo_time_seconds } = req.body;
  db.run(
    `UPDATE workouts SET date=?, distance_km=?, duration_minutes=?, avg_heart_rate=?, elevation_m=?, workout_type=?, notes=?, warmup_km=?, cooldown_km=?, interval_distance_m=?, interval_reps=?, interval_recovery_type=?, interval_recovery_time=?, interval_time_seconds=?, tempo_distance_km=?, tempo_time_seconds=? WHERE id=?`,
    [date, distance_km, duration_minutes, avg_heart_rate || null, elevation_m || null, workout_type || 'easy', notes || null, warmup_km || null, cooldown_km || null, interval_distance_m || null, interval_reps || null, interval_recovery_type || null, interval_recovery_time || null, interval_time_seconds || null, tempo_distance_km || null, tempo_time_seconds || null, req.params.id]
  );
  save();
  res.json({ ok: true });
});

app.delete('/api/workouts/:id', async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM workouts WHERE id=?', [req.params.id]);
  save();
  res.json({ ok: true });
});

app.get('/api/progress', async (req, res) => {
  try {
    const db = await getDb();
    const results = db.exec('SELECT * FROM workouts ORDER BY date ASC');
    if (!results.length) return res.json([]);
    const cols = results[0].columns;
    const workouts = results[0].values.map(row => {
      const obj = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
    const { buildProgress } = require('./predict');
    res.json(buildProgress(workouts));
  } catch (err) {
    console.error('Progress error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/predict', async (req, res) => {
  try {
    const db = await getDb();
    const results = db.exec('SELECT * FROM workouts ORDER BY date DESC');
    let workouts = [];
    if (results.length) {
      const cols = results[0].columns;
      workouts = results[0].values.map(row => {
        const obj = {};
        cols.forEach((c, i) => obj[c] = row[i]);
        return obj;
      });
    }
    const prediction = await predict10k(workouts);
    res.json(prediction);
  } catch (err) {
    console.error('Prediction error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
