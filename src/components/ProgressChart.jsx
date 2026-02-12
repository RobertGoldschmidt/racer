import React, { useState, useEffect } from 'react';

const cardStyle = { maxWidth: 700, margin: '20px auto', padding: 24, border: '2px solid #2563eb', borderRadius: 12 };

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ProgressChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    fetch('/api/progress').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div style={cardStyle}><p style={{ textAlign: 'center' }}>Loading...</p></div>;
  if (!data.length) return <div style={cardStyle}><p style={{ textAlign: 'center', color: '#666' }}>No qualifying workouts yet. Log a race, tempo, or interval session to see progress.</p></div>;

  const dayMs = 86400000;
  const pad = { top: 30, right: 20, bottom: 60, left: 55 };
  const H = 300;

  // Time axis (dates)
  const dates = data.map(d => new Date(d.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || dayMs;
  const totalDays = Math.max(1, Math.round(dateRange / dayMs));

  // Dynamic width: 20px per day, minimum 620px
  const W = Math.max(620, pad.left + pad.right + totalDays * 20);
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  // Y axis (10K time in seconds — inverted so faster is higher)
  const times = data.map(d => d.tenK_seconds);
  const minTime = Math.min(...times) - 30;
  const maxTime = Math.max(...times) + 30;
  const timeRange = maxTime - minTime;

  const xScale = (date) => pad.left + ((new Date(date).getTime() - minDate) / dateRange) * plotW;
  const yScale = (sec) => pad.top + ((sec - minTime) / timeRange) * plotH;

  // Percentage-based positioning for HTML tooltip
  const xPct = (date) => (xScale(date) / W) * 100;
  const yPct = (sec) => (yScale(sec) / H) * 100;

  // Smooth line path using cubic bezier (Catmull-Rom to bezier conversion)
  const points = data.map(d => ({ x: xScale(d.date), y: yScale(d.tenK_seconds) }));
  let linePath = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[Math.max(0, i - 2)];
    const p1 = points[i - 1];
    const p2 = points[i];
    const p3 = points[Math.min(points.length - 1, i + 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    linePath += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  // Y-axis ticks
  const yTicks = [];
  const tickStep = timeRange > 600 ? 120 : 60;
  const firstTick = Math.ceil(minTime / tickStep) * tickStep;
  for (let t = firstTick; t <= maxTime; t += tickStep) {
    yTicks.push(t);
  }

  // X-axis ticks: one per data point date
  const uniqueDates = [...new Set(data.map(d => d.date))].map(d => new Date(d).getTime()).sort((a, b) => a - b);

  return (
    <div style={cardStyle}>
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>10K Fitness Progress</h2>
      <p style={{ textAlign: 'center', color: '#666', fontSize: 13, marginBottom: 12 }}>
        Each point shows what your predicted 10K time would have been on that day.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ position: 'relative', width: W, minWidth: '100%' }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, display: 'block' }}>
            {/* Grid lines */}
            {yTicks.map(t => (
              <line key={t} x1={pad.left} x2={W - pad.right} y1={yScale(t)} y2={yScale(t)} stroke="#eee" strokeWidth={1} />
            ))}

            {/* Y axis labels */}
            {yTicks.map(t => (
              <text key={t} x={pad.left - 8} y={yScale(t) + 4} textAnchor="end" fontSize={11} fill="#666">{fmtTime(t)}</text>
            ))}

            {/* X axis labels — one per data point */}
            {uniqueDates.map(t => {
              const x = pad.left + ((t - minDate) / dateRange) * plotW;
              const d = new Date(t);
              const label = `${d.getDate()}.${d.getMonth() + 1}`;
              return <text key={t} x={x} y={H - pad.bottom + 18} textAnchor="middle" fontSize={11} fill="#666">{label}</text>;
            })}

            {/* Axis labels */}
            <text x={pad.left - 8} y={pad.top - 12} textAnchor="end" fontSize={11} fill="#999">Predicted 10K</text>
            <text x={pad.left} y={pad.top - 12} textAnchor="start" fontSize={11} fill="#999">(faster up)</text>

            {/* Line */}
            <path d={linePath} fill="none" stroke="#2563eb" strokeWidth={2} opacity={0.4} />

            {/* Data points */}
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

          {/* HTML tooltip — auto-sizes to content */}
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
