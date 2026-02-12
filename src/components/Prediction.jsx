import React, { useState, useEffect } from 'react';

const cardStyle = { maxWidth: 500, margin: '20px auto', padding: 24, border: '2px solid #2563eb', borderRadius: 12, textAlign: 'center' };

export default function Prediction({ lastPrediction, onPrediction }) {
  const [prediction, setPrediction] = useState(lastPrediction);
  const [loading, setLoading] = useState(!lastPrediction);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch('/api/predict', { method: 'POST' })
      .then(res => {
        if (!res.ok) return res.json().then(d => { throw new Error(d.error || 'Prediction failed'); });
        return res.json();
      })
      .then(data => {
        setPrediction(data);
        onPrediction(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={cardStyle}>
      <h2>10K Race Time Prediction</h2>
      <p style={{ color: '#666', marginBottom: 20 }}>Analyzes your training using Jack Daniels' VDOT methodology to predict your 10K time.</p>

      {loading && <p style={{ color: '#666' }}>Analyzing...</p>}
      {error && <p style={{ color: '#dc2626', marginTop: 16 }}>{error}</p>}

      {!loading && prediction && (
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
