import React, { useState } from 'react';

const cardStyle = { maxWidth: 500, margin: '20px auto', padding: 24, border: '2px solid #2563eb', borderRadius: 12, textAlign: 'center' };
const btnStyle = { padding: '12px 32px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' };

export default function Prediction() {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const predict = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/predict', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Prediction failed');
      setPrediction(await res.json());
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={cardStyle}>
      <h2>10K Race Time Prediction</h2>
      <p style={{ color: '#666', marginBottom: 20 }}>Claude will analyze your training log and predict your 10K finish time.</p>
      <button onClick={predict} disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.6 : 1 }}>
        {loading ? 'Analyzing...' : 'Predict My 10K Time'}
      </button>

      {error && <p style={{ color: '#dc2626', marginTop: 16 }}>{error}</p>}

      {prediction && (
        <div style={{ marginTop: 24, textAlign: 'left' }}>
          {prediction.predicted_time ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 48, fontWeight: 'bold', color: '#2563eb' }}>{prediction.predicted_time}</div>
                <div style={{ fontSize: 14, color: '#666' }}>Predicted 10K Time</div>
              </div>
              <div style={{ marginBottom: 8 }}><strong>Confidence:</strong> {prediction.confidence}</div>
              <div><strong>Analysis:</strong> {prediction.reasoning}</div>
            </>
          ) : (
            <p>{prediction.reasoning}</p>
          )}
          {prediction.prompt && (
            <details style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
              <summary style={{ cursor: 'pointer' }}>Show prompt sent to Claude</summary>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 12, borderRadius: 6, marginTop: 8 }}>{prediction.prompt}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
