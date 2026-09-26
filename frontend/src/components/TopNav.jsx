import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { shiftISO, todayISO } from '../utils/dayInfo';
import NavLinks from './NavLinks';
import { COLORS, navButton } from '../styles';
import { G, pillButton, chevronButton } from '../garminTheme';

const TABS = [
  { section: 'agenda', label: 'Agenda' },
  { section: 'health', label: 'Garmin' },
  { section: 'workout', label: 'Workout App' },
];

// Header bar. `section` is the active tab; every date control stays inside it.
// theme="garmin" renders the same controls in connect.garmin.com's sidebar idiom
// (near-black bar, thin Open Sans, blue Today pill); the Agenda keeps the paper look.
export default function TopNav({ dateISO, section = 'agenda', theme = 'paper' }) {
  const navigate = useNavigate();
  const garmin = theme === 'garmin';

  const onPickDate = (e) => {
    if (e.target.value) navigate(`/${section}/${e.target.value}`);
  };

  const linkStyle = garmin ? pillButton() : navButton;
  const arrowStyle = garmin
    ? { ...chevronButton, color: 'white', fontSize: 16 }
    : { ...navButton, padding: '4px 10px' };
  const tabStyle = (active) => (garmin ? {
    color: 'white',
    fontSize: 16,
    fontWeight: 300,
    padding: '6px 2px',
    borderBottom: `3px solid ${active ? 'white' : 'transparent'}`,
    textDecoration: 'none',
    marginRight: 18,
  } : {
    ...navButton,
    background: active ? 'white' : 'transparent',
    color: active ? COLORS.ink : 'white',
    padding: '4px 14px',
  });

  return (
    <div className={garmin ? 'garmin-page' : undefined} style={garmin ? {
      background: G.nav,
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      padding: '8px 16px',
      fontFamily: G.font,
    } : {
      background: COLORS.ink,
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      padding: '10px 16px',
      borderBottom: `4px double ${COLORS.hairline}`,
    }}>
      <div
        className={garmin ? undefined : 'serif'}
        style={garmin
          ? { fontSize: 22, fontWeight: 300, letterSpacing: 0.5, marginRight: 20, color: 'white' }
          : { fontSize: 22, fontWeight: 500, letterSpacing: 1, marginRight: 8 }}
      >
        Planner
      </div>
      <div style={{ display: 'flex', gap: garmin ? 0 : 4, marginRight: 12 }}>
        {TABS.map((t) => (
          <Link key={t.section} to={`/${t.section}/${dateISO}`} style={tabStyle(t.section === section)}>
            {t.label}
          </Link>
        ))}
      </div>
      <Link to={`/${section}/${shiftISO(dateISO, -1)}`} style={arrowStyle} aria-label="Previous day">{garmin ? '‹' : '◀ Prev'}</Link>
      <Link to={`/${section}/${todayISO()}`} style={linkStyle}>Today</Link>
      <Link to={`/${section}/${shiftISO(dateISO, 1)}`} style={arrowStyle} aria-label="Next day">{garmin ? '›' : 'Next ▶'}</Link>
      <input
        type="date"
        value={dateISO}
        onChange={onPickDate}
        style={garmin ? {
          background: 'transparent',
          color: 'white',
          border: `1px solid ${G.muted}`,
          padding: '3px 6px',
          borderRadius: 4,
          fontSize: 12,
          colorScheme: 'dark',
          fontFamily: G.font,
        } : {
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
      <NavLinks theme={theme} />
    </div>
  );
}
