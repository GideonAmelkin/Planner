import React from 'react';
import { Link } from 'react-router-dom';
import NavLinks from './NavLinks';
import { TABS } from './TopNav';
import { COLORS, navButton } from '../styles';

export const RAIL_WIDTH = 240;

// The Agenda tab's fixed left rail: wordmark, the three section links stacked,
// and Recap / Settings pinned to the bottom. Date controls live in DateCard.
export default function AgendaRail({ dateISO, section = 'agenda' }) {
  const tabStyle = (active) => ({
    ...navButton,
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    fontSize: 14,
    background: active ? COLORS.page : 'transparent',
    borderColor: active ? COLORS.page : 'transparent',
    color: active ? COLORS.ink : COLORS.muted,
  });

  return (
    <aside style={{
      width: RAIL_WIDTH,
      flex: 'none',
      position: 'sticky',
      top: 0,
      height: '100vh',
      background: COLORS.paper,
      borderRight: `1px solid ${COLORS.hairline}`,
      padding: '20px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      overflow: 'auto',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3, margin: '0 0 4px 8px' }}>Planner</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {TABS.map((t) => (
          <Link key={t.section} to={`/${t.section}/${dateISO}`} style={tabStyle(t.section === section)}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div style={{ marginTop: 'auto' }}>
        <NavLinks direction="column" />
      </div>
    </aside>
  );
}
