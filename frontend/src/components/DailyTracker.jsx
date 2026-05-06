import React, { useEffect, useRef, useState } from 'react';
import { saveTracker } from '../services/api';

export default function DailyTracker({ dateISO, value, onChange }) {
  const [text, setText] = useState(value || '');
  const timerRef = useRef(null);
  useEffect(() => { setText(value || ''); }, [value, dateISO]);

  const handleChange = (e) => {
    const v = e.target.value;
    setText(v);
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { saveTracker(dateISO, v); }, 800);
  };

  return (
    <div>
      <div style={{ fontStyle: 'italic', fontSize: 13, fontWeight: 500, textAlign: 'center', borderBottom: '1px solid #2D3436', padding: '4px 0' }}>
        Daily Tracker
      </div>
      <div style={{ fontSize: 10, textAlign: 'center', color: '#6B5B40', padding: '2px 0', borderBottom: '1px solid #C9BB9A' }}>
        Track expenses, email, voice mail, or other information.
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        rows={4}
        className="ruled-bg"
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          padding: '4px 6px',
          fontSize: 13,
          lineHeight: '1.6em',
          resize: 'vertical',
          color: '#2D3436',
        }}
      />
    </div>
  );
}
