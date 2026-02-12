require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb, save } = require('./db');
const { predict10k } = require('./predict');

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));