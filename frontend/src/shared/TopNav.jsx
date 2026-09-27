import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { shiftISO, todayISO } from './dayInfo';
import NavLinks from './NavLinks';
import { COLORS, navButton } from './styles';

export const TABS = [
  { section: 'agenda', label: 'Agenda' },
  { section: 'garmin', label: 'Garmin' },
  { section: 'workout', label: 'Workout' },
  { section: 'social', label: 'Social' },
];

// Light header bar. `section` is the active tab; every date control stays inside it.
// No tab renders it any more (Agenda, Workout and Social use AgendaRail, Garmin uses
// garmin/GarminShell.jsx); it stays because it exports TABS.
export default function TopNav({ dateISO, section = 'agenda' }) {
  const navigate = useNavigate();

  const onPickDate = (e) => {
    if (e.target.value) navigate(`/${section}/${e.target.value}`);
  };

  const linkStyle = navButton;
  const arrowStyle = { ...navButton, padding: '5px 10px' };
  const tabStyle = (active) => ({
    ...navButton,
    background: active ? COLORS.page : 'transparent',
    borderColor: active ? COLORS.page : 'transparent',
    color: active ? COLORS.ink : COLORS.muted,
    padding: '5px 14px',
  });

  return (
    <div style={{
      background: COLORS.paper,
      color: COLORS.ink,
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      padding: '10px 16px',
      borderBottom: `1px solid ${COLORS.hairline}`,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, marginRight: 8 }}>Planner</div>
      <div style={{ display: 'flex', gap: 2, marginRight: 12 }}>
        {TABS.map((t) => (
          <Link key={t.section} to={`/${t.section}/${dateISO}`} style={tabStyle(t.section === section)}>
            {t.label}
          </Link>
        ))}
      </div>
      <Link to={`/${section}/${shiftISO(dateISO, -1)}`} style={arrowStyle}>‹ Prev</Link>
      <Link to={`/${section}/${todayISO()}`} style={linkStyle}>Today</Link>
      <Link to={`/${section}/${shiftISO(dateISO, 1)}`} style={arrowStyle}>Next ›</Link>
      <input
        type="date"
        value={dateISO}
        onChange={onPickDate}
        style={{
          background: COLORS.paper,
          color: COLORS.ink,
          border: `1px solid ${COLORS.hairline}`,
          padding: '4px 8px',
          borderRadius: 8,
          fontSize: 13,
          colorScheme: 'light',
        }}
      />
      <div style={{ flex: 1 }} />
      <NavLinks />
    </div>
  );
}
