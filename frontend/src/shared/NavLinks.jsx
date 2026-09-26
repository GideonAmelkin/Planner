import React, { useState } from 'react';
import SettingsPanel from './SettingsPanel';
import RecapPanel from './RecapPanel';
import { COLORS, navButton } from './styles';

const baseStyle = navButton;
const activeStyle = { ...baseStyle, background: COLORS.page, borderColor: COLORS.page };

// Recap and Settings buttons plus the modals they open. `direction="column"`
// stacks them full width (the Agenda rail); the default row sits in a header.
export default function NavLinks({ direction = 'row' }) {
  const [showSettings, setShowSettings] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const column = direction === 'column';
  const styleFor = (active) => ({
    ...(active ? activeStyle : baseStyle),
    cursor: 'pointer',
    ...(column ? { width: '100%', textAlign: 'left', padding: '8px 12px' } : {}),
  });

  return (
    <div style={{ display: 'flex', flexDirection: column ? 'column' : 'row', gap: column ? 6 : 8 }}>
      <button type="button" onClick={() => setShowRecap(true)} style={styleFor(showRecap)}>
        Recap
      </button>
      <button type="button" onClick={() => setShowSettings(true)} style={styleFor(showSettings)}>
        Settings
      </button>
      {showRecap ? <RecapPanel onClose={() => setShowRecap(false)} /> : null}
      {showSettings ? <SettingsPanel onClose={() => setShowSettings(false)} /> : null}
    </div>
  );
}
