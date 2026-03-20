import React, { useState, useMemo } from 'react';
import { buildProgress } from '../lib/predict';

const cardStyle = { maxWidth: 700, margin: '20px auto', padding: 24, border: '2px solid #2563eb', borderRadius: 12 };

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ProgressChart({ workouts, maxHR = 191 }) {
  const [hover, setHover] = useState(null);

  const data = useMemo(() => {
    const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date));
    return buildProgress(sorted, maxHR);
  }, [workouts, maxHR]);

  if (!data.length) return <div className="progress-card" style={cardStyle}><p style={{ textAlign: 'center', color: '#666' }}>No qualifying workouts yet. Log a race, tempo, or interval session to see progress.</p></div>;

  const dayMs = 86400000;
  const pad = { top: 30, right: 20, bottom: 60, left: 55 };
  const H = 300;

  const dates = data.map(d => new Date(d.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || dayMs;
  const totalDays = Math.max(1, Math.round(dateRange / dayMs));

  const W = Math.max(620, pad.left + pad.right + totalDays * 20);
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const times = data.map(d => d.tenK_seconds);
  const minTime = Math.min(...times) - 30;
  const maxTime = Math.max(...times) + 30;
  const timeRange = maxTime - minTime || 60; // guard against single datapoint with identical times

  const xScale = (date) => pad.left + ((new Date(date).getTime() - minDate) / dateRange) * plotW;
  const yScale = (sec) => pad.top + ((sec - minTime) / timeRange) * plotH;

  const xPct = (date) => (xScale(date) / W) * 100;
  const yPct = (sec) => (yScale(sec) / H) * 100;

  const linePath = data.map((d, i) => {
    const x = xScale(d.date);
    const y = yScale(d.tenK_seconds);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  const yTicks = [];
  const tickStep = timeRange > 600 ? 120 : 60;
  const firstTick = Math.ceil(minTime / tickStep) * tickStep;
  for (let t = firstTick; t <= maxTime; t += tickStep) {
    yTicks.push(t);
  }

  const uniqueDates = [...new Set(data.map(d => d.date))].map(d => new Date(d).getTime()).sort((a, b) => a - b);

  return (
    <div className="progress-card" style={cardStyle}>
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>10K Fitness Progress</h2>
      <p style={{ textAlign: 'center', color: '#666', fontSize: 13, marginBottom: 12 }}>
        Each point shows what your predicted 10K time would have been on that day.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ position: 'relative', width: W, minWidth: '100%', margin: '0 50px' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, display: 'block' }}>
            {yTicks.map(t => (
              <line key={t} x1={pad.left} x2={W - pad.right} y1={yScale(t)} y2={yScale(t)} stroke="#eee" strokeWidth={1} />
            ))}

            {yTicks.map(t => (
              <text key={t} x={pad.left - 8} y={yScale(t) + 4} textAnchor="end" fontSize={11} fill="#666">{fmtTime(t)}</text>
            ))}

            {uniqueDates.map(t => {
              const x = pad.left + ((t - minDate) / dateRange) * plotW;
              const d = new Date(t);
              const label = `${d.getDate()}.${d.getMonth() + 1}`;
              return <text key={t} x={x} y={H - pad.bottom + 18} textAnchor="middle" fontSize={11} fill="#666">{label}</text>;
            })}

            <text x={pad.left - 8} y={pad.top - 12} textAnchor="end" fontSize={11} fill="#999">Predicted 10K</text>
            <text x={pad.left} y={pad.top - 12} textAnchor="start" fontSize={11} fill="#999">(faster up)</text>

            <path d={linePath} fill="none" stroke="#2563eb" strokeWidth={2} opacity={0.4} />

            {data.map((d, i) => {
              const x = xScale(d.date);
              const y = yScale(d.tenK_seconds);
              return (
                <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
                  <circle cx={x} cy={y} r={hover === i ? 7 : 5} fill="#2563eb" stroke="white" strokeWidth={2} />
                </g>
              );
            })}
          </svg>

          {hover !== null && (() => {
            const d = data[hover];
            return (
              <div style={{
                position: 'absolute',
                left: `${xPct(d.date)}%`,
                top: `${yPct(d.tenK_seconds)}%`,
                transform: 'translate(-50%, calc(-100% - 14px))',
                background: 'rgba(0,0,0,0.9)',
                color: 'white',
                padding: '6px 10px',
                borderRadius: 6,
                fontSize: 12,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                lineHeight: 1.4,
              }}>
                <div style={{ fontWeight: 'bold' }}>{d.predicted_time} (VDOT {d.vdot})</div>
                <div style={{ color: '#ccc' }}>{d.date}</div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
