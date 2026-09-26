import React, { useState } from 'react';
import SettingsPanel from './SettingsPanel';
import RecapPanel from './RecapPanel';
import { COLORS, navButton } from '../styles';
import { G } from '../garminTheme';

const baseStyle = navButton;
const activeStyle = { ...baseStyle, background: 'white', color: COLORS.ink };

// Garmin theme: thin white text links, like the sidebar items on connect.garmin.com.
const garminStyle = (active) => ({
  background: 'transparent',
  border: 'none',
  color: 'white',
  fontSize: 14,
  fontWeight: active ? 400 : 300,
  padding: '4px 8px',
  fontFamily: G.font,
});

export default function NavLinks({ theme = 'paper' }) {
  const [showSettings, setShowSettings] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const styleFor = (active) => (theme === 'garmin' ? garminStyle(active) : (active ? activeStyle : baseStyle));

  return (
    <>
      <button
        type="button"
        onClick={() => setShowRecap(true)}
        style={{ ...styleFor(showRecap), cursor: 'pointer' }}
      >
        Recap
      </button>
      <button
        type="button"
        onClick={() => setShowSettings(true)}
        style={{ ...styleFor(showSettings), cursor: 'pointer' }}
      >
        Settings
      </button>
      {showRecap ? <RecapPanel onClose={() => setShowRecap(false)} /> : null}
      {showSettings ? <SettingsPanel onClose={() => setShowSettings(false)} /> : null}
    </>
  );
}
