import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { shiftISO, todayISO } from '../utils/dayInfo';
import NavLinks from './NavLinks';
import { COLORS, navButton } from '../styles';

export default function TopNav({ dateISO }) {
  const navigate = useNavigate();

  const onPickDate = (e) => {
    if (e.target.value) navigate(`/day/${e.target.value}`);
  };

  const linkStyle = navButton;
  const arrowStyle = { ...navButton, padding: '4px 10px' };

  return (
    <div style={{
      background: COLORS.ink,
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 16px',
      borderBottom: `4px double ${COLORS.hairline}`,
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
      <NavLinks />
    </div>
  );
}
