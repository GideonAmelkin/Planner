import React, { useState } from 'react';
import SettingsPanel from './SettingsPanel';
import RecapPanel from './RecapPanel';
import { COLORS, navButton } from '../styles';

const baseStyle = navButton;
const activeStyle = { ...baseStyle, background: 'white', color: COLORS.ink };

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
