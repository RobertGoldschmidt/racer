import React from 'react';

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle = { textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid #333', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px 6px', borderBottom: '1px solid #eee' };
const btnSmall = { padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 };
const delBtn = { ...btnSmall, color: '#dc2626', borderColor: '#dc2626' };

export default function WorkoutList({ workouts, onEdit, onDelete }) {
  if (!workouts.length) {
    return <p style={{ textAlign: 'center', color: '#666' }}>No workouts yet. Add your first run!</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Dist (km)</th>
            <th style={thStyle}>Time (min)</th>
            <th style={thStyle}>Pace</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Effort</th>
            <th style={thStyle}>HR</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {workouts.map(w => (
            <tr key={w.id}>
              <td style={tdStyle}>{w.date}</td>
              <td style={tdStyle}>{w.distance_km}</td>
              <td style={tdStyle}>{w.duration_minutes}</td>
              <td style={tdStyle}>{(() => { const p = w.duration_minutes / w.distance_km; const m = Math.floor(p); const s = Math.round((p - m) * 60); return `${m}:${s.toString().padStart(2, '0')}`; })()} min/km</td>
              <td style={tdStyle}>{w.workout_type}</td>
              <td style={tdStyle}>{w.perceived_effort}</td>
              <td style={tdStyle}>{w.avg_heart_rate || '-'}</td>
              <td style={tdStyle}>
                <button style={btnSmall} onClick={() => onEdit(w)}>Edit</button>
                <button style={delBtn} onClick={() => onDelete(w.id)}>Del</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
