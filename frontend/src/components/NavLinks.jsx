import React, { useState } from 'react';
import SettingsPanel from './SettingsPanel';
import RecapPanel from './RecapPanel';

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

export default function NavLinks() {
  const [showSettings, setShowSettings] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const styleFor = (active) => active ? activeStyle : baseStyle;

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
