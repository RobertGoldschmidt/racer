import React, { useState, useEffect } from 'react';
import WorkoutForm from './components/WorkoutForm';
import WorkoutList from './components/WorkoutList';
import Prediction from './components/Prediction';
import ProgressChart from './components/ProgressChart';

const styles = {
  app: { maxWidth: 900, margin: '0 auto', padding: 20, fontFamily: 'system-ui, sans-serif' },
  h1: { textAlign: 'center', marginBottom: 30 },
  tabs: { display: 'flex', gap: 10, marginBottom: 20, justifyContent: 'center' },
  tab: { padding: '10px 24px', border: '2px solid #333', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 16 },
  tabActive: { padding: '10px 24px', border: '2px solid #2563eb', borderRadius: 8, background: '#2563eb', color: 'white', cursor: 'pointer', fontSize: 16 },
};

export default function App() {
  const [workouts, setWorkouts] = useState([]);
  const [view, setView] = useState('list');
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [lastPrediction, setLastPrediction] = useState(null);

  const fetchWorkouts = async () => {
    const res = await fetch('/api/workouts');
    setWorkouts(await res.json());
  };

  useEffect(() => { fetchWorkouts(); }, []);

  const handleSave = async (data) => {
    if (editingWorkout) {
      await fetch(`/api/workouts/${editingWorkout.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    } else {
      await fetch('/api/workouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    }
    setEditingWorkout(null);
    setView('list');
    fetchWorkouts();
  };

  const handleDelete = async (id) => {
    await fetch(`/api/workouts/${id}`, { method: 'DELETE' });
    fetchWorkouts();
  };

  const handleEdit = (workout) => {
    setEditingWorkout(workout);
    setView('add');
  };

  return (
    <div style={styles.app}>
      <h1 style={styles.h1}>10K Race Predictor</h1>
      <div style={styles.tabs}>
        <button style={view === 'list' ? styles.tabActive : styles.tab} onClick={() => { setView('list'); setEditingWorkout(null); }}>Workouts</button>
        <button style={view === 'add' ? styles.tabActive : styles.tab} onClick={() => { setView('add'); setEditingWorkout(null); }}>Add Workout</button>
        <button style={view === 'predict' ? styles.tabActive : styles.tab} onClick={() => setView('predict')}>Predict 10K</button>
        <button style={view === 'progress' ? styles.tabActive : styles.tab} onClick={() => setView('progress')}>Progress</button>
      </div>

      {view === 'list' && <WorkoutList workouts={workouts} onEdit={handleEdit} onDelete={handleDelete} />}
      {view === 'add' && <WorkoutForm onSave={handleSave} initial={editingWorkout} />}
      {view === 'predict' && <Prediction lastPrediction={lastPrediction} onPrediction={setLastPrediction} />}
      {view === 'progress' && <ProgressChart />}
    </div>
  );
}
