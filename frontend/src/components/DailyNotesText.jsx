import React, { useEffect, useRef, useState } from 'react';
import { saveNotesText } from '../services/api';

export default function DailyNotesText({ dateISO, value, onChange }) {
  const [text, setText] = useState(value || '');
  const timerRef = useRef(null);
  useEffect(() => { setText(value || ''); }, [value, dateISO]);

  const handleChange = (e) => {
    const v = e.target.value;
    setText(v);
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { saveNotesText(dateISO, v); }, 800);
  };

  return (
    <div style={{ borderBottom: '1px solid #2D3436', marginTop: 28 }}>
      <div style={{
        fontStyle: 'italic',
        fontSize: 13,
        color: '#2D3436',
        textAlign: 'center',
        padding: '4px 0',
        borderBottom: '1px solid #2D3436',
        fontWeight: 500,
      }}>
        Notes
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        className="ruled-bg"
        style={{
          width: '100%',
          minHeight: 200,
          border: 'none',
          background: 'transparent',
          padding: '4px 8px',
          fontSize: 14,
          lineHeight: '1.6em',
          resize: 'vertical',
          color: '#2D3436',
        }}
      />
    </div>
  );
}
