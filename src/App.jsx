import React, { useState, useEffect } from 'react';
import WorkoutForm from './components/WorkoutForm';
import WorkoutList from './components/WorkoutList';
import Prediction from './components/Prediction';
import ProgressChart from './components/ProgressChart';
import { getDb, save, queryRows } from './lib/db';

const styles = {
  app: { maxWidth: 900, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif' },
  h1: { textAlign: 'center', marginBottom: 30 },
  tabs: { display: 'flex', gap: 10, marginBottom: 20, justifyContent: 'center', flexWrap: 'wrap' },
  tab: { padding: '10px 24px', border: '2px solid #333', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 16 },
  tabActive: { padding: '10px 24px', border: '2px solid #2563eb', borderRadius: 8, background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: 16 },
  notice: { background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 },
  noticeClose: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: '#555', padding: '0 4px' },
};

export default function App() {
  const [workouts, setWorkouts] = useState([]);
  const [view, setView] = useState('list');
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [lastPrediction, setLastPrediction] = useState(null);
  const [ready, setReady] = useState(false);
  const [seedNotice, setSeedNotice] = useState(false);
  const [maxHR, setMaxHR] = useState(() => {
    const saved = localStorage.getItem('racer_maxHR');
    return saved ? parseInt(saved, 10) : 191;
  });

  const fetchWorkouts = async () => {
    const db = await getDb();
    setWorkouts(queryRows(db, 'SELECT * FROM workouts ORDER BY date DESC'));
  };

  useEffect(() => {
    getDb().then(() => {
      setReady(true);
      if (localStorage.getItem('racer_seed_notice')) {
        setSeedNotice(true);
        localStorage.removeItem('racer_seed_notice');
      }
      fetchWorkouts();
    });
  }, []);

  const handleMaxHRChange = (val) => {
    const n = parseInt(val, 10);
    if (!isNaN(n) && n >= 100 && n <= 250) {
      setMaxHR(n);
      localStorage.setItem('racer_maxHR', String(n));
    }
  };

  const handleSave = async (data) => {
    const db = await getDb();
    if (editingWorkout) {
      db.run(
        `UPDATE workouts SET date=?, distance_km=?, duration_minutes=?, avg_heart_rate=?, elevation_m=?, workout_type=?, notes=?, warmup_km=?, cooldown_km=?, interval_distance_m=?, interval_reps=?, interval_recovery_type=?, interval_recovery_time=?, interval_time_seconds=?, tempo_distance_km=?, tempo_time_seconds=? WHERE id=?`,
        [data.date, data.distance_km, data.duration_minutes, data.avg_heart_rate || null, data.elevation_m || null, data.workout_type || 'easy', data.notes || null, data.warmup_km || null, data.cooldown_km || null, data.interval_distance_m || null, data.interval_reps || null, data.interval_recovery_type || null, data.interval_recovery_time || null, data.interval_time_seconds || null, data.tempo_distance_km || null, data.tempo_time_seconds || null, editingWorkout.id]
      );
    } else {
      db.run(
        `INSERT INTO workouts (date, distance_km, duration_minutes, avg_heart_rate, elevation_m, workout_type, notes, warmup_km, cooldown_km, interval_distance_m, interval_reps, interval_recovery_type, interval_recovery_time, interval_time_seconds, tempo_distance_km, tempo_time_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.date, data.distance_km, data.duration_minutes, data.avg_heart_rate || null, data.elevation_m || null, data.workout_type || 'easy', data.notes || null, data.warmup_km || null, data.cooldown_km || null, data.interval_distance_m || null, data.interval_reps || null, data.interval_recovery_type || null, data.interval_recovery_time || null, data.interval_time_seconds || null, data.tempo_distance_km || null, data.tempo_time_seconds || null]
      );
    }
    await save();
    setEditingWorkout(null);
    setView('list');
    fetchWorkouts();
  };

  const handleDelete = async (id) => {
    const db = await getDb();
    db.run('DELETE FROM workouts WHERE id=?', [id]);
    await save();
    fetchWorkouts();
  };

  const handleEdit = (workout) => {
    setEditingWorkout(workout);
    setView('add');
  };

  if (!ready) return <div style={{ textAlign: 'center', padding: 40, fontFamily: 'system-ui' }}>Loading database...</div>;

  return (
    <div className="app-container" style={styles.app}>
      <h1 style={styles.h1}>10K Race Predictor</h1>

      {seedNotice && (
        <div style={styles.notice}>
          <span>Sample workouts loaded to get you started — feel free to delete them and log your own runs.</span>
          <button onClick={() => setSeedNotice(false)} style={styles.noticeClose} aria-label="Dismiss">&times;</button>
        </div>
      )}

      <div className="tabs" style={styles.tabs}>
        <button style={view === 'list' ? styles.tabActive : styles.tab} onClick={() => { setView('list'); setEditingWorkout(null); }}>Workouts</button>
        <button style={view === 'add' ? styles.tabActive : styles.tab} onClick={() => { setView('add'); setEditingWorkout(null); }}>Add Workout</button>
        <button style={view === 'predict' ? styles.tabActive : styles.tab} onClick={() => setView('predict')}>Predict 10K</button>
        <button style={view === 'progress' ? styles.tabActive : styles.tab} onClick={() => setView('progress')}>Progress</button>
        <button style={view === 'settings' ? styles.tabActive : styles.tab} onClick={() => setView('settings')}>Settings</button>
      </div>

      {view === 'list' && <WorkoutList workouts={workouts} onEdit={handleEdit} onDelete={handleDelete} maxHR={maxHR} />}
      {view === 'add' && <WorkoutForm onSave={handleSave} initial={editingWorkout} />}
      {view === 'predict' && <Prediction workouts={workouts} lastPrediction={lastPrediction} onPrediction={setLastPrediction} maxHR={maxHR} />}
      {view === 'progress' && <ProgressChart workouts={workouts} maxHR={maxHR} />}
      {view === 'settings' && (
        <div style={{ maxWidth: 400, margin: '20px auto' }}>
          <h2>Settings</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <label style={{ fontWeight: 'bold' }}>Max Heart Rate (bpm)</label>
            <p style={{ margin: 0, color: '#666', fontSize: 13 }}>
              Used to calculate heart rate zones and effort levels. A common estimate is 220 minus your age.
            </p>
            <input
              type="number"
              min="100"
              max="250"
              value={maxHR}
              onChange={e => handleMaxHRChange(e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 14, width: 120 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
