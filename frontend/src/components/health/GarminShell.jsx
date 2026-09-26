import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GarminIcon from './GarminIcon';
import RecapPanel from '../RecapPanel';
import SettingsPanel from '../SettingsPanel';
import { shiftISO, todayISO, longDate } from '../../utils/dayInfo';
import { NAV, groupOf } from '../../garminNav';
import {
  G, page, sidebar, wordmark, sidebarItem, sidebarDivider, topBar, circleButton, iconButton,
  summaryHeader, sectionLabel, dateTitle, syncedText, pillButton, chevronButton, contentArea,
} from '../../garminTheme';

const OPEN_KEY = 'garminNavOpen';

function useNarrow(maxWidth = 900) {
  const query = `(max-width: ${maxWidth}px)`;
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    setNarrow(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return narrow;
}

function loadOpen() {
  try { return JSON.parse(sessionStorage.getItem(OPEN_KEY) || 'null'); } catch (_) { return null; }
}

const subItem = (active) => ({
  display: 'block',
  padding: '7px 12px 7px 58px',
  fontSize: 14,
  fontWeight: 300,
  color: 'white',
  textDecoration: 'none',
  background: active ? '#2b2b2b' : 'transparent',
  whiteSpace: 'nowrap',
});

// The sidebar tree, a copy of connect.garmin.com's, with our Agenda / Workout App at the top.
function Sidebar({ dateISO, activeSlug, onNavigate }) {
  const [open, setOpen] = useState(() => loadOpen() || {});
  const activeGroup = groupOf(activeSlug);
  const isOpen = (g) => open[g] !== false;   // all groups open by default, like Garmin
  const toggle = (g) => setOpen((o) => {
    const next = { ...o, [g]: !isOpen(g) };
    try { sessionStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch (_) { /* ignore */ }
    return next;
  });
  const hrefFor = (slug) => {
    if (slug === '__agenda') return `/agenda/${dateISO}`;
    if (slug === '__workout') return `/workout/${dateISO}`;
    return slug ? `/health/${dateISO}/${slug}` : `/health/${dateISO}`;
  };

  return (
    <>
      <Link to={`/agenda/${dateISO}`} style={wordmark} onClick={onNavigate}>planner</Link>
      {NAV.map((cluster, ci) => (
        <div key={cluster.cluster}>
          {ci > 0 ? <div style={sidebarDivider} /> : null}
          {cluster.items.map((it) => it.group ? (
            <div key={it.group} style={{ outline: activeGroup === it.group ? `1px solid ${G.blue}` : 'none', outlineOffset: -1, margin: activeGroup === it.group ? '2px 8px 2px 0' : 0 }}>
              <button type="button" onClick={() => toggle(it.group)} style={{ ...sidebarItem(false), justifyContent: 'space-between' }} aria-expanded={isOpen(it.group)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}><GarminIcon name={it.icon} color={it.color} size={20} /> {it.label}</span>
                <GarminIcon name={isOpen(it.group) ? 'chevronUp' : 'chevronDown'} color={G.muted} size={14} />
              </button>
              {isOpen(it.group) ? it.children.map((ch) => (
                <Link key={ch.slug} to={hrefFor(ch.slug)} onClick={onNavigate} style={subItem(activeSlug === ch.slug)}>{ch.label}</Link>
              )) : null}
            </div>
          ) : (
            <Link key={it.slug} to={hrefFor(it.slug)} onClick={onNavigate} style={sidebarItem(activeSlug === it.slug && !it.slug.startsWith('__'))}>
              <GarminIcon name={it.icon} color={it.color} size={20} /> {it.label}
            </Link>
          ))}
        </div>
      ))}
      <div style={{ height: 24 }} />
    </>
  );
}

// The connect.garmin.com frame around the Garmin tab: dark sidebar, white top bar, a
// page header (the DAILY SUMMARY block by default, or the `header` node a sub-page
// supplies), then the gray content area.
export default function GarminShell({ dateISO, activeSlug = '', syncedAt, loading, connected, onRefresh, header = null, children }) {
  const navigate = useNavigate();
  const narrow = useNarrow();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('plannerNavCollapsed') === '1'; } catch (_) { return false; } });
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem('plannerNavCollapsed', c ? '0' : '1'); } catch (_) { /* ignore */ } return !c; });
  const [showRecap, setShowRecap] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { setDrawer(false); }, [dateISO, activeSlug]);

  const onPickDate = (e) => { if (e.target.value) navigate(`/health/${e.target.value}${activeSlug ? `/${activeSlug}` : ''}`); };
  const closeDrawer = () => setDrawer(false);

  const defaultHeader = (
    <div style={{ ...summaryHeader, padding: narrow ? '14px 16px 12px' : summaryHeader.padding }}>
      <div>
        <div style={sectionLabel}>Daily Summary</div>
        <label style={{ ...dateTitle, marginTop: 10, position: 'relative', cursor: 'pointer' }} title="Pick a date">
          <GarminIcon name="calendar" color={G.blue} size={20} />
          <span>{longDate(dateISO).replace(/(\d+)(st|nd|rd|th)/, '$1,')}</span>
          <input type="date" value={dateISO} onChange={onPickDate} aria-label="Date" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
        </label>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link to={`/health/${todayISO()}`} style={pillButton()}>Today</Link>
          <Link to={`/health/${shiftISO(dateISO, -1)}`} style={chevronButton} aria-label="Previous day">‹</Link>
          <Link to={`/health/${shiftISO(dateISO, 1)}`} style={chevronButton} aria-label="Next day">›</Link>
        </div>
        <span style={syncedText}>{syncedAt ? `Synced ${syncedAt}` : (loading ? 'Syncing...' : 'Not synced')}</span>
      </div>
    </div>
  );

  return (
    <div className="garmin-page" style={{ ...page, display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: 'stretch' }}>
      {narrow ? (
        <>
          <div style={{ background: G.nav, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
            <button type="button" onClick={() => setDrawer((d) => !d)} style={{ ...iconButton, color: 'white' }} aria-label="Menu"><GarminIcon name="menu" color="white" size={22} /></button>
            <Link to={`/agenda/${dateISO}`} style={{ ...wordmark, fontSize: 22, padding: '4px 6px' }}>planner</Link>
          </div>
          {drawer ? (
            <>
              <div onClick={closeDrawer} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90 }} />
              <nav style={{ ...sidebar, position: 'fixed', top: 0, left: 0, bottom: 0, height: '100vh', zIndex: 91, width: 'min(300px, 85vw)', flex: 'none', boxShadow: '4px 0 16px rgba(0,0,0,0.4)' }} aria-label="Planner">
                <Sidebar dateISO={dateISO} activeSlug={activeSlug} onNavigate={closeDrawer} />
              </nav>
            </>
          ) : null}
        </>
      ) : (
        collapsed ? null : (
          <nav style={sidebar} aria-label="Planner">
            <Sidebar dateISO={dateISO} activeSlug={activeSlug} />
          </nav>
        )
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...topBar, padding: narrow ? '0 16px' : topBar.padding }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={narrow ? () => setDrawer((d) => !d) : toggleCollapsed} style={circleButton} aria-label={collapsed ? 'Show menu' : 'Hide menu'} title={collapsed ? 'Show menu' : 'Hide menu'}>
              <GarminIcon name="back" color={G.muted} size={18} style={{ transform: collapsed && !narrow ? 'rotate(180deg)' : 'none' }} />
            </button>
            {collapsed && !narrow ? <Link to={`/agenda/${dateISO}`} style={{ fontSize: 20, fontWeight: 300, color: G.text, textDecoration: 'none' }}>planner</Link> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" onClick={onRefresh} disabled={loading || !connected} style={{ ...iconButton, opacity: loading || !connected ? 0.4 : 1 }} title="Sync from Garmin" aria-label="Refresh">
              <GarminIcon name="sync" color={G.muted} size={22} />
            </button>
            <button type="button" onClick={() => setShowRecap(true)} style={iconButton} title="Recap" aria-label="Recap"><GarminIcon name="recap" color={G.muted} size={20} /></button>
            <button type="button" onClick={() => setShowSettings(true)} style={iconButton} title="Settings" aria-label="Settings"><GarminIcon name="settings" color={G.muted} size={20} /></button>
          </div>
        </div>

        {header || defaultHeader}

        <div style={{ ...contentArea, padding: narrow ? 16 : contentArea.padding }}>
          {children}
        </div>
      </div>

      {showRecap ? <RecapPanel onClose={() => setShowRecap(false)} /> : null}
      {showSettings ? <SettingsPanel onClose={() => setShowSettings(false)} /> : null}
    </div>
  );
}
