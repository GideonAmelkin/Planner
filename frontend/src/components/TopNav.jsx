import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { shiftISO, todayISO } from '../utils/dayInfo';
import NavLinks from './NavLinks';

export default function TopNav({ dateISO }) {
  const navigate = useNavigate();

  const onPickDate = (e) => {
    if (e.target.value) navigate(`/day/${e.target.value}`);
  };

  const linkStyle = {
    color: 'white',
    textDecoration: 'none',
    border: '1px solid white',
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.5,
    borderRadius: 2,
    background: 'transparent',
  };

  const arrowStyle = { ...linkStyle, padding: '4px 10px' };

  return (
    <div style={{
      background: '#2D3436',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 16px',
      borderBottom: '4px double #C9BB9A',
    }}>
      <div className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: 1, marginRight: 16 }}>Planner</div>
      <Link to={`/day/${shiftISO(dateISO, -1)}`} style={arrowStyle}>◀ Prev</Link>
      <Link to={`/day/${todayISO()}`} style={linkStyle}>Today</Link>
      <Link to={`/day/${shiftISO(dateISO, 1)}`} style={arrowStyle}>Next ▶</Link>
      <input
        type="date"
        value={dateISO}
        onChange={onPickDate}
        style={{
          background: 'transparent',
          color: 'white',
          border: '1px solid white',
          padding: '3px 6px',
          borderRadius: 2,
          fontSize: 12,
          colorScheme: 'dark',
        }}
      />
      <div style={{ flex: 1 }} />
      <NavLinks dateISO={dateISO} />
    </div>
  );
}
