import React, { useState } from 'react';

const todayStr = () => new Date().toISOString().slice(0, 10);

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 4 };
const inputStyle = { padding: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 14 };
const formStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 600, margin: '0 auto' };
const btnStyle = { gridColumn: 'span 2', padding: '12px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' };
const sectionStyle = { gridColumn: 'span 2', borderTop: '1px solid #ddd', paddingTop: 12, marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
const sectionLabel = { gridColumn: 'span 2', fontWeight: 'bold', fontSize: 14, color: '#555' };

export default function WorkoutForm({ onSave, initial }) {
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    date: initial?.date || todayStr(),
    distance_km: initial?.distance_km || '',
    duration_minutes: initial?.duration_minutes || '',
    avg_heart_rate: initial?.avg_heart_rate || '',
    elevation_m: initial?.elevation_m || '',
    workout_type: initial?.workout_type || 'easy',
    notes: initial?.notes || '',
    warmup_km: initial?.warmup_km || '',
    cooldown_km: initial?.cooldown_km || '',
    interval_distance_m: initial?.interval_distance_m || '',
    interval_reps: initial?.interval_reps || '',
    interval_recovery_type: initial?.interval_recovery_type || 'jog',
    interval_recovery_time: initial?.interval_recovery_time || '',
    interval_time_seconds: initial?.interval_time_seconds || '',
    tempo_distance_km: initial?.tempo_distance_km || '',
    tempo_time_seconds: initial?.tempo_time_seconds || '',
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const isIntervals = form.workout_type === 'intervals';
  const isTempo = form.workout_type === 'tempo';

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (form.date > todayStr()) errs.date = 'Date cannot be in the future';
    if (!form.distance_km || parseFloat(form.distance_km) <= 0) errs.distance_km = 'Must be greater than 0';
    if (!form.duration_minutes || parseFloat(form.duration_minutes) <= 0) errs.duration_minutes = 'Must be greater than 0';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    onSave({
      ...form,
      distance_km: parseFloat(form.distance_km),
      duration_minutes: parseFloat(form.duration_minutes),
      avg_heart_rate: form.avg_heart_rate ? parseInt(form.avg_heart_rate) : null,
      elevation_m: form.elevation_m ? parseFloat(form.elevation_m) : null,
      warmup_km: form.warmup_km ? parseFloat(form.warmup_km) : null,
      cooldown_km: form.cooldown_km ? parseFloat(form.cooldown_km) : null,
      interval_distance_m: form.interval_distance_m ? parseFloat(form.interval_distance_m) : null,
      interval_reps: form.interval_reps ? parseInt(form.interval_reps) : null,
      interval_recovery_type: isIntervals ? form.interval_recovery_type : null,
      interval_recovery_time: form.interval_recovery_time ? parseInt(form.interval_recovery_time) : null,
      interval_time_seconds: form.interval_time_seconds ? parseFloat(form.interval_time_seconds) : null,
      tempo_distance_km: form.tempo_distance_km ? parseFloat(form.tempo_distance_km) : null,
      tempo_time_seconds: form.tempo_time_seconds ? parseFloat(form.tempo_time_seconds) : null,
    });
  };

  return (
    <form onSubmit={submit} className="workout-form" style={formStyle}>
      <div style={fieldStyle}>
        <label>Date</label>
        <input type="date" value={form.date} onChange={set('date')} style={inputStyle} required max={todayStr()} />
        {errors.date && <span style={{ color: '#dc2626', fontSize: 12 }}>{errors.date}</span>}
      </div>
      <div style={fieldStyle}>
        <label>Distance (km) — total</label>
        <input type="number" step="any" min="0.001" value={form.distance_km} onChange={set('distance_km')} style={inputStyle} required />
        {errors.distance_km && <span style={{ color: '#dc2626', fontSize: 12 }}>{errors.distance_km}</span>}
      </div>
      <div style={fieldStyle}>
        <label>Duration (minutes) — total</label>
        <input type="number" step="0.1" min="0.1" value={form.duration_minutes} onChange={set('duration_minutes')} style={inputStyle} required />
        {errors.duration_minutes && <span style={{ color: '#dc2626', fontSize: 12 }}>{errors.duration_minutes}</span>}
      </div>
      <div style={fieldStyle}>
        <label>Workout Type</label>
        <select value={form.workout_type} onChange={set('workout_type')} style={inputStyle}>
          <option value="easy">Easy</option>
          <option value="tempo">Tempo</option>
          <option value="intervals">Intervals</option>
          <option value="long_run">Long Run</option>
          <option value="race">Race</option>
        </select>
      </div>

      {/* Warmup / Cooldown section */}
      <div className="form-section" style={sectionStyle}>
        <div className="form-section-label" style={sectionLabel}>Warmup / Cooldown</div>
        <div style={fieldStyle}>
          <label>Warmup (km)</label>
          <input type="number" step="any" value={form.warmup_km} onChange={set('warmup_km')} style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label>Cooldown (km)</label>
          <input type="number" step="any" value={form.cooldown_km} onChange={set('cooldown_km')} style={inputStyle} />
        </div>
      </div>

      {/* Intervals section — only shown when type is intervals */}
      {isIntervals && (
        <div className="form-section" style={sectionStyle}>
          <div className="form-section-label" style={sectionLabel}>Interval Details</div>
          <div style={fieldStyle}>
            <label>Interval Distance (m)</label>
            <input type="number" step="1" value={form.interval_distance_m} onChange={set('interval_distance_m')} style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label>Repetitions</label>
            <input type="number" value={form.interval_reps} onChange={set('interval_reps')} style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label>Recovery Type</label>
            <select value={form.interval_recovery_type} onChange={set('interval_recovery_type')} style={inputStyle}>
              <option value="walk">Walk</option>
              <option value="jog">Jog</option>
            </select>
          </div>
          <div style={fieldStyle}>
            <label>Recovery Time (seconds)</label>
            <input type="number" value={form.interval_recovery_time} onChange={set('interval_recovery_time')} style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label>Interval Pace (sec/km)</label>
            <input type="number" step="0.1" min="1" value={form.interval_time_seconds} onChange={set('interval_time_seconds')} style={inputStyle} />
          </div>
        </div>
      )}

      {/* Tempo section — only shown when type is tempo */}
      {isTempo && (
        <div className="form-section" style={sectionStyle}>
          <div className="form-section-label" style={sectionLabel}>Tempo Details</div>
          <div style={fieldStyle}>
            <label>Tempo Distance (km)</label>
            <input type="number" step="any" value={form.tempo_distance_km} onChange={set('tempo_distance_km')} style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label>Tempo Pace (sec/km)</label>
            <input type="number" step="0.1" value={form.tempo_time_seconds} onChange={set('tempo_time_seconds')} style={inputStyle} />
          </div>
        </div>
      )}

      <div style={fieldStyle}>
        <label>Avg Heart Rate (optional)</label>
        <input type="number" value={form.avg_heart_rate} onChange={set('avg_heart_rate')} style={inputStyle} />
      </div>
      <div style={fieldStyle}>
        <label>Elevation (m, optional)</label>
        <input type="number" step="1" value={form.elevation_m} onChange={set('elevation_m')} style={inputStyle} />
      </div>
      <div className="form-full-width" style={{ ...fieldStyle, gridColumn: 'span 2' }}>
        <label>Notes (optional)</label>
        <textarea value={form.notes} onChange={set('notes')} style={{ ...inputStyle, minHeight: 60 }} />
      </div>
      <button type="submit" style={btnStyle}>{initial ? 'Update Workout' : 'Add Workout'}</button>
    </form>
  );
}
