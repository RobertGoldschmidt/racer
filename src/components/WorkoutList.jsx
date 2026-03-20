import React from 'react';

const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle = { textAlign: 'left', padding: '8px 6px', borderBottom: '2px solid #333', whiteSpace: 'nowrap' };
const tdStyle = { padding: '8px 6px', borderBottom: '1px solid #eee' };
const btnSmall = { padding: '4px 10px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 };
const delBtn = { ...btnSmall, color: '#dc2626', borderColor: '#dc2626' };

function hrZone(avgHR, maxHR) {
  if (!avgHR) return '-';
  const pct = avgHR / maxHR;
  if (pct >= 0.9) return `Z5 (${avgHR})`;
  if (pct >= 0.8) return `Z4 (${avgHR})`;
  if (pct >= 0.7) return `Z3 (${avgHR})`;
  if (pct >= 0.6) return `Z2 (${avgHR})`;
  return `Z1 (${avgHR})`;
}

export default function WorkoutList({ workouts, onEdit, onDelete, maxHR = 191 }) {
  if (!workouts.length) {
    return <p style={{ textAlign: 'center', color: '#666' }}>No workouts yet. Add your first run!</p>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="workout-table" style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Dist (km)</th>
            <th style={thStyle}>Time (min)</th>
            <th style={thStyle}>Pace</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>HR Zone</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {workouts.map(w => (
            <tr key={w.id}>
              <td style={tdStyle} data-label="Date">{w.date}</td>
              <td style={tdStyle} data-label="Dist (km)">{w.distance_km}</td>
              <td style={tdStyle} data-label="Time (min)">{w.duration_minutes}</td>
              <td style={tdStyle} data-label="Pace">{(() => { const p = w.duration_minutes / w.distance_km; const m = Math.floor(p); const s = Math.round((p - m) * 60); return `${m}:${s.toString().padStart(2, '0')}`; })()} min/km</td>
              <td style={tdStyle} data-label="Type">{w.workout_type}</td>
              <td style={tdStyle} data-label="HR Zone">{hrZone(w.avg_heart_rate, maxHR)}</td>
              <td style={tdStyle} data-label="">
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
