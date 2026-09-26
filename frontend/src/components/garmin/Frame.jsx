import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GarminIcon from '../health/GarminIcon';
import { shiftISO, todayISO, longDate } from '../../utils/dayInfo';
import {
  G, container, title44, title22, infoDot, sectionHeading, segmentTrack, segment, datePill, roundNav,
  tabRow, tab, yellowBanner, kebab,
} from '../../garminTheme';

// The white 1280px box every Garmin sub-page sits in.
export function PageContainer({ children, narrow = false, style, flush = false }) {
  return <div style={{ ...container, ...(narrow ? { maxWidth: 860 } : null), ...(flush ? { padding: 0 } : null), ...style }}>{children}</div>;
}

export const InfoDot = () => <span style={infoDot} aria-label="Info">?</span>;

// 44px thin title with the optional info dot and a right-side slot (kebab, buttons).
export function PageTitle({ children, info = false, small = false, right = null, sub = null, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: sub ? 4 : 16, ...style }}>
      <div>
        <h1 style={{ ...(small ? title22 : title44), margin: 0 }}>{children}{info ? <InfoDot /> : null}</h1>
        {sub ? <div style={{ fontSize: 12, color: G.muted, marginTop: 2 }}>{sub}</div> : null}
      </div>
      {right !== null ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div> : <button type="button" style={kebab} aria-label="More">⋮</button>}
    </div>
  );
}

export const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// ‹ › circles + gray date pill (native picker under it) + Today link.
export function DateControls({ dateISO, to, label = null, showToday = true, step = 1 }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Link to={to(shiftISO(dateISO, -step))} style={roundNav} aria-label="Previous">‹</Link>
      <Link to={to(shiftISO(dateISO, step))} style={roundNav} aria-label="Next">›</Link>
      <label style={datePill} title={longDate(dateISO)}>
        <GarminIcon name="calendar" color={G.text} size={14} /> {label || shortDate(dateISO)}
        <input type="date" value={dateISO} onChange={(e) => { if (e.target.value) navigate(to(e.target.value)); }} aria-label="Date" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
      </label>
      {showToday && dateISO !== todayISO() ? <Link to={to(todayISO())} style={{ fontSize: 12, color: G.blue }}>Today</Link> : null}
    </div>
  );
}

// Gray segmented control with a white bold active segment.
export function RangeControl({ options, value, onChange }) {
  return (
    <div style={segmentTrack} role="tablist">
      {options.map((o) => (
        <button key={o.key} type="button" role="tab" aria-selected={value === o.key} onClick={() => onChange(o.key)} style={segment(value === o.key)}>{o.label}</button>
      ))}
    </div>
  );
}

// Title row controls: DateControls left, RangeControl right, like Sleep / Steps / Weight.
export function ControlsRow({ left, right, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16, ...style }}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

// Underline tabs (Sleep Score | Sleep Coach). `right` is an optional slot at the row's end.
export function TabStrip({ tabs, value, onChange, right = null, style }) {
  return (
    <div style={{ ...tabRow, alignItems: 'flex-end', justifyContent: 'space-between', ...style }}>
      <div style={{ display: 'flex' }}>
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => onChange(t.key)} style={tab(value === t.key)}>
            {t.icon ? <GarminIcon name={t.icon} color={value === t.key ? G.text : G.muted} size={14} style={{ marginRight: 6, verticalAlign: -2 }} /> : null}{t.label}
          </button>
        ))}
      </div>
      {right ? <div style={{ paddingBottom: 6 }}>{right}</div> : null}
    </div>
  );
}

export function SectionHeading({ children, right = null, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...style }}>
      <h2 style={{ ...sectionHeading, margin: 0 }}>{children}</h2>
      {right}
    </div>
  );
}

// Garmin's yellow "Use Performance Dashboard..." strip.
export function Banner({ children, link = null, onClose }) {
  return (
    <div style={yellowBanner}>
      <span style={{ color: '#e9ae00' }}>★</span>
      <strong style={{ fontWeight: 600 }}>{children}</strong>
      {link ? <a href={link.href} target="_blank" rel="noreferrer" style={{ color: G.blue, fontSize: 12 }}>{link.label}</a> : null}
      <span style={{ flex: 1 }} />
      {onClose ? <button type="button" onClick={onClose} style={{ ...kebab, fontSize: 14 }} aria-label="Dismiss">×</button> : null}
    </div>
  );
}

// The Reports left index: top-level entries with nested 11px children; active in blue.
export function SideIndex({ groups, active }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.9, minWidth: 150 }}>
      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 6 }}>
          {g.to ? <Link to={g.to} style={{ color: active === g.key ? G.blue : G.text }}>{g.label}</Link> : <span style={{ color: G.text }}>{g.label}</span>}
          {g.children ? (
            <div style={{ paddingLeft: 12, fontSize: 11, lineHeight: 1.7 }}>
              {g.children.map((c) => (
                <div key={c.key}>{c.to ? <Link to={c.to} style={{ color: active === c.key ? G.blue : G.text }}>{c.label}</Link> : <span>{c.label}</span>}</div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// Two-column body (Summary | Daily Timeline) that stacks under 760px.
export function TwoCol({ left, right, ratio = '1fr 1fr', gap = 32, style }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(320px, 100%), 1fr))`, gap, ...style }}>
      <div style={{ minWidth: 0 }}>{left}</div>
      <div style={{ minWidth: 0 }}>{right}</div>
    </div>
  );
}
