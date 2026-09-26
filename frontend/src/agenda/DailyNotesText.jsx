import React, { useEffect, useRef, useState } from 'react';
import { saveNotesText } from './api';
import { COLORS, SECTION_DOTS, sectionDot, sectionHeader } from '../shared/styles';

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
    <div>
      <div style={{ ...sectionHeader, display: 'flex', alignItems: 'center' }}>
        <span style={sectionDot(SECTION_DOTS.notes)} />
        Notes
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        style={{
          width: '100%',
          minHeight: 160,
          border: 'none',
          background: COLORS.page,
          borderRadius: 8,
          padding: '10px 12px',
          fontSize: 15,
          lineHeight: 1.5,
          resize: 'vertical',
          color: COLORS.ink,
          display: 'block',
        }}
      />
    </div>
  );
}
