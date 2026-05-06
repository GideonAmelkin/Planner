import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isoToDate, todayISO } from '../utils/dayInfo';
import SettingsPanel from './SettingsPanel';

const baseStyle = {
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
const activeStyle = { ...baseStyle, background: 'white', color: '#2D3436' };

export default function NavLinks({ dateISO }) {
  const [showSettings, setShowSettings] = useState(false);
  const location = useLocation();
  const iso = dateISO || todayISO();
  const d = isoToDate(iso);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  const isActive = (prefix) => location.pathname.startsWith(prefix);
  const styleFor = (active) => active ? activeStyle : baseStyle;

  return (
    <>
      <Link to={`/day/${iso}`} style={styleFor(isActive('/day/'))}>Agenda</Link>
      <Link to={`/master/${year}/${month}`} style={styleFor(isActive('/master/'))}>Goals</Link>
      <Link to={`/calendar/${year}/${month}`} style={styleFor(isActive('/calendar/'))}>Calendar</Link>
      <button
        type="button"
        onClick={() => setShowSettings(true)}
        style={{ ...styleFor(showSettings), cursor: 'pointer' }}
      >
        Settings
      </button>
      {showSettings ? <SettingsPanel onClose={() => setShowSettings(false)} /> : null}
    </>
  );
}
