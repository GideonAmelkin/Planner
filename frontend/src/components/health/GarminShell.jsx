import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GarminIcon from './GarminIcon';
import RecapPanel from '../RecapPanel';
import SettingsPanel from '../SettingsPanel';
import { shiftISO, todayISO, longDate } from '../../utils/dayInfo';
import {
  G, page, sidebar, wordmark, sidebarItem, sidebarDivider, topBar, circleButton, iconButton,
  summaryHeader, sectionLabel, dateTitle, syncedText, pillButton, chevronButton, contentArea,
} from '../../garminTheme';

const TABS = [
  { section: 'agenda', label: 'Agenda', icon: 'agenda', color: 'white' },
  { section: 'health', label: 'Garmin', icon: 'heart', color: G.metric.steps },
  { section: 'workout', label: 'Workout App', icon: 'workout', color: G.green },
];

// Card anchors listed in the sidebar, in the daily-summary order.
export const SECTIONS = [
  ['activities', 'Activities', 'activity'],
  ['heart-rate', 'Heart Rate', 'heart'],
  ['body-battery', 'Body Battery', 'battery'],
  ['stress', 'Stress', 'stress'],
  ['intensity', 'Intensity Minutes', 'intensity'],
  ['steps', 'Steps', 'steps'],
  ['floors', 'Floors', 'floors'],
  ['calories', 'Calories', 'calories'],
  ['sleep', 'Sleep', 'sleep'],
  ['pulse-ox', 'Pulse Ox', 'spo2'],
  ['respiration', 'Respiration', 'respiration'],
  ['hydration', 'Hydration', 'hydration'],
  ['hrv', 'HRV Status', 'hrv'],
  ['training', 'Training', 'training'],
  ['weight', 'Weight', 'weight'],
];

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

const scrollTo = (id) => (e) => {
  const el = document.getElementById(id);
  if (el) {
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// The connect.garmin.com frame around the Garmin tab: dark sidebar, white top bar,
// the DAILY SUMMARY header, then the gray content area.
export default function GarminShell({ dateISO, syncedAt, loading, connected, onRefresh, children }) {
  const navigate = useNavigate();
  const narrow = useNarrow();
  const [showRecap, setShowRecap] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const onPickDate = (e) => { if (e.target.value) navigate(`/health/${e.target.value}`); };

  const nav = (
    <>
      {TABS.map((t) => (
        <Link key={t.section} to={`/${t.section}/${dateISO}`} style={sidebarItem(t.section === 'health')}>
          <GarminIcon name={t.icon} color={t.color} size={20} /> {t.label}
        </Link>
      ))}
    </>
  );

  return (
    <div className="garmin-page" style={{ ...page, display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: 'stretch' }}>
      {narrow ? (
        <div style={{ background: G.nav, display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', overflowX: 'auto' }}>
          <Link to={`/agenda/${dateISO}`} style={{ ...wordmark, fontSize: 22, padding: '4px 10px' }}>planner</Link>
          {TABS.map((t) => (
            <Link key={t.section} to={`/${t.section}/${dateISO}`} style={{ ...sidebarItem(t.section === 'health'), width: 'auto', height: 34, padding: '0 10px', borderLeftWidth: 0, borderLeftStyle: 'none', borderBottom: `3px solid ${t.section === 'health' ? 'white' : 'transparent'}`, fontSize: 14 }}>
              <GarminIcon name={t.icon} color={t.color} size={16} /> {t.label}
            </Link>
          ))}
        </div>
      ) : (
        <nav style={sidebar} aria-label="Planner">
          <Link to={`/agenda/${dateISO}`} style={wordmark}>planner</Link>
          {nav}
          <div style={sidebarDivider} />
          {SECTIONS.map(([id, label, icon]) => (
            <a key={id} href={`#${id}`} onClick={scrollTo(id)} style={sidebarItem(false)}>
              <GarminIcon name={icon} size={20} /> {label}
            </a>
          ))}
          <div style={sidebarDivider} />
          <button type="button" onClick={() => setShowRecap(true)} style={sidebarItem(false)}><GarminIcon name="recap" color="white" size={20} /> Recap</button>
          <button type="button" onClick={() => setShowSettings(true)} style={sidebarItem(false)}><GarminIcon name="settings" color="white" size={20} /> Settings</button>
          <a href="#endpoints" onClick={scrollTo('endpoints')} style={sidebarItem(false)}><GarminIcon name="endpoints" color="white" size={20} /> All Endpoints</a>
          <div style={{ height: 24 }} />
        </nav>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...topBar, padding: narrow ? '0 16px' : topBar.padding }}>
          <Link to={`/agenda/${dateISO}`} style={circleButton} aria-label="Back to the agenda" title="Agenda">
            <GarminIcon name="back" color={G.muted} size={18} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" onClick={onRefresh} disabled={loading || !connected} style={{ ...iconButton, opacity: loading || !connected ? 0.4 : 1 }} title="Sync from Garmin" aria-label="Refresh">
              <GarminIcon name="sync" color={G.muted} size={22} />
            </button>
            <button type="button" onClick={() => setShowRecap(true)} style={iconButton} title="Recap" aria-label="Recap"><GarminIcon name="recap" color={G.muted} size={20} /></button>
            <button type="button" onClick={() => setShowSettings(true)} style={iconButton} title="Settings" aria-label="Settings"><GarminIcon name="settings" color={G.muted} size={20} /></button>
          </div>
        </div>

        <div style={{ ...summaryHeader, padding: narrow ? '14px 16px 12px' : summaryHeader.padding }}>
          <div>
            <div style={sectionLabel}>Daily Summary</div>
            <label style={{ ...dateTitle, marginTop: 10, position: 'relative', cursor: 'pointer' }} title="Pick a date">
              <GarminIcon name="calendar" color={G.blue} size={20} />
              <span>{longDate(dateISO).replace(/(\d+)(st|nd|rd|th)/, '$1,')}</span>
              <input
                type="date"
                value={dateISO}
                onChange={onPickDate}
                aria-label="Date"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              />
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

        <div style={{ ...contentArea, padding: narrow ? 16 : contentArea.padding }}>
          {children}
        </div>
      </div>

      {showRecap ? <RecapPanel onClose={() => setShowRecap(false)} /> : null}
      {showSettings ? <SettingsPanel onClose={() => setShowSettings(false)} /> : null}
    </div>
  );
}
