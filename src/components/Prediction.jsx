import React, { useState } from 'react';

const cardStyle = { maxWidth: 500, margin: '20px auto', padding: 24, border: '2px solid #2563eb', borderRadius: 12, textAlign: 'center' };
const btnStyle = { padding: '12px 32px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' };

export default function Prediction({ lastPrediction, onPrediction }) {
  const [prediction, setPrediction] = useState(lastPrediction);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const predict = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/predict', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Prediction failed');
      const data = await res.json();
      setPrediction(data);
      onPrediction(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={cardStyle}>
      <h2>10K Race Time Prediction</h2>
      <p style={{ color: '#666', marginBottom: 20 }}>Analyzes your training using Jack Daniels' VDOT methodology to predict your 10K time.</p>
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
        </div>
      )}
    </div>
  );
}
