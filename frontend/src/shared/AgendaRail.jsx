import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import NavLinks from './NavLinks';
import { TABS } from './TopNav';
import { COLORS, navButton } from './styles';

export const RAIL_WIDTH = 240;
const STRIP_WIDTH = 44;
// Shared with the Garmin tab's sidebar toggle: hide the menu once, it is hidden everywhere.
export const NAV_COLLAPSED_KEY = 'plannerNavCollapsed';

const readCollapsed = () => { try { return localStorage.getItem(NAV_COLLAPSED_KEY) === '1'; } catch (_) { return false; } };
const writeCollapsed = (v) => { try { localStorage.setItem(NAV_COLLAPSED_KEY, v ? '1' : '0'); } catch (_) { /* ignore */ } };

// The Agenda tab's fixed left rail: wordmark, the three section links stacked,
// and Recap / Settings pinned to the bottom. Date controls live in DateCard.
// The round button at the top hides the rail to a 44px strip (remembered).
// Tab links always open today; Prev / Next inside a tab browse other days.
export default function AgendaRail({ section = 'agenda' }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => setCollapsed((c) => { writeCollapsed(!c); return !c; });

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
  const toggleStyle = {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: `1px solid ${COLORS.hairline}`,
    background: COLORS.paper,
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 1,
    cursor: 'pointer',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 'none',
  };
  const asideBase = {
    flex: 'none',
    position: 'sticky',
    top: 0,
    height: '100vh',
    background: COLORS.paper,
    borderRight: `1px solid ${COLORS.hairline}`,
    overflow: 'auto',
  };

  if (collapsed) {
    return (
      <aside style={{ ...asideBase, width: STRIP_WIDTH, padding: '20px 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <button type="button" onClick={toggle} style={toggleStyle} aria-label="Show menu" title="Show menu">›</button>
      </aside>
    );
  }

  return (
    <aside style={{ ...asideBase, width: RAIL_WIDTH, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 4px 8px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.3 }}>Planner</div>
        <button type="button" onClick={toggle} style={toggleStyle} aria-label="Hide menu" title="Hide menu">‹</button>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {TABS.map((t) => (
          <Link key={t.section} to={`/${t.section}/today`} style={tabStyle(t.section === section)}>
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
