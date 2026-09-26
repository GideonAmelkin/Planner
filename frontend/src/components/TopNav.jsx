import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { shiftISO, todayISO } from '../utils/dayInfo';
import NavLinks from './NavLinks';
import { COLORS, navButton } from '../styles';

const TABS = [
  { section: 'agenda', label: 'Agenda' },
  { section: 'health', label: 'Health' },
];

// Header bar. `section` is the active tab; every date control stays inside it.
export default function TopNav({ dateISO, section = 'agenda' }) {
  const navigate = useNavigate();

  const onPickDate = (e) => {
    if (e.target.value) navigate(`/${section}/${e.target.value}`);
  };

  const linkStyle = navButton;
  const arrowStyle = { ...navButton, padding: '4px 10px' };
  const tabStyle = (active) => ({
    ...navButton,
    background: active ? 'white' : 'transparent',
    color: active ? COLORS.ink : 'white',
    padding: '4px 14px',
  });

  return (
    <div style={{
      background: COLORS.ink,
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      padding: '10px 16px',
      borderBottom: `4px double ${COLORS.hairline}`,
    }}>
      <div className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: 1, marginRight: 8 }}>Planner</div>
      <div style={{ display: 'flex', gap: 4, marginRight: 12 }}>
        {TABS.map((t) => (
          <Link key={t.section} to={`/${t.section}/${dateISO}`} style={tabStyle(t.section === section)}>
            {t.label}
          </Link>
        ))}
      </div>
      <Link to={`/${section}/${shiftISO(dateISO, -1)}`} style={arrowStyle}>◀ Prev</Link>
      <Link to={`/${section}/${todayISO()}`} style={linkStyle}>Today</Link>
      <Link to={`/${section}/${shiftISO(dateISO, 1)}`} style={arrowStyle}>Next ▶</Link>
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
