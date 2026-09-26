import React from 'react';
import GarminIcon from '../health/GarminIcon';
import {
  G, emptyWrap, emptyCircle, emptyTitle, emptySub, blueButton, grayButton, outlinedButton, linkText,
  statPairValue, statPairLabel, noticeStrip,
} from '../../garminTheme';
import { num } from '../../utils/garminFormat';

export const BlueButton = ({ children, style, ...rest }) => <button type="button" style={{ ...blueButton, ...style }} {...rest}>{children}</button>;
export const GrayButton = ({ children, style, ...rest }) => <button type="button" style={{ ...grayButton, ...style }} {...rest}>{children}</button>;
export const OutlinedButton = ({ children, style, ...rest }) => <button type="button" style={{ ...outlinedButton, ...style }} {...rest}>{children}</button>;
export const LinkButton = ({ children, style, href, ...rest }) => (href
  ? <a href={href} target="_blank" rel="noreferrer" style={{ ...linkText, ...style }} {...rest}>{children}</a>
  : <button type="button" style={{ ...linkText, ...style }} {...rest}>{children}</button>);

// 64px gray circle glyph, 26px thin message, 12px sub, optional button and Learn More.
export function EmptyState({ icon = 'chart', iconColor = G.muted, title, sub = null, button = null, learnMore = null, style }) {
  return (
    <div style={{ ...emptyWrap, ...style }}>
      <div style={emptyCircle}><GarminIcon name={icon} color={iconColor} size={28} /></div>
      <div style={emptyTitle}>{title}</div>
      {sub ? <div style={emptySub}>{sub}</div> : null}
      {button ? <div style={{ marginTop: 16 }}>{button}</div> : null}
      {learnMore ? <a href={learnMore} target="_blank" rel="noreferrer" style={{ ...linkText, marginTop: 14, fontSize: 12 }}>Learn More</a> : null}
    </div>
  );
}

// 22px thin value with a 12px gray label (the pairs under every ring / timeline).
export function StatPair({ value, label, unit = '', dot = null, small = false, style }) {
  const shown = value === null || value === undefined || value === '' ? '--' : value;
  return (
    <div style={{ minWidth: 0, ...style }}>
      <div style={{ ...statPairValue, fontSize: small ? 18 : 22 }}>{shown}{unit && shown !== '--' ? <span style={{ fontSize: small ? 13 : 15, marginLeft: 3 }}>{unit}</span> : null}</div>
      <div style={{ ...statPairLabel, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        {dot ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, display: 'inline-block' }} /> : null}{label}
      </div>
    </div>
  );
}

export const StatRow = ({ children, cols = 'repeat(auto-fit, minmax(110px, max-content))', gap = '14px 32px', style }) => (
  <div style={{ display: 'grid', gridTemplateColumns: cols, gap, ...style }}>{children}</div>
);

// Ring gauge: value over goal, or explicit `segments` [{value, color}] around the ring.
export function RingGauge({ value, goal, color = G.metric.stepsFill, segments = null, label = null, sub = null, check = false, size = 100, stroke = 6, track = G.border, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const parts = segments
    ? (() => { const total = segments.reduce((n, s) => n + (s.value || 0), 0) || 1; let acc = 0; return segments.map((s) => { const len = (s.value || 0) / total * c; const el = { color: s.color, len, off: acc }; acc += len; return el; }); })()
    : [{ color, len: goal ? Math.min(1, (value || 0) / goal) * c : 0, off: 0 }];
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {parts.map((p, i) => p.len > 0 ? (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={`${p.len} ${c - p.len}`} strokeDashoffset={-p.off} strokeLinecap="butt" />
        ) : null)}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>
        {children || (
          <>
            <span style={{ fontSize: size >= 100 ? 20 : 16, fontWeight: 300, color: G.text, fontVariantNumeric: 'tabular-nums' }}>{value === null || value === undefined ? '--' : num(value)}</span>
            {label ? <span style={{ fontSize: 10, color: G.muted }}>{label}</span> : (goal ? <span style={{ fontSize: 10, color: G.muted }}>{num(goal)}</span> : null)}
            {sub ? <span style={{ fontSize: 10, color: G.muted }}>{sub}</span> : null}
            {check && goal && value >= goal ? <span style={{ color: color, fontSize: 12 }}>✓</span> : null}
          </>
        )}
      </div>
    </div>
  );
}

// 270-degree arc gauge with a red-to-green sweep (VO2 Max).
export function ArcGauge({ value, min = 20, max = 70, unit = 'ml/kg/min', size = 120 }) {
  const r = 50; const cx = 60; const cy = 60;
  const arc = (a0, a1, colr) => {
    const p = (a) => [cx + r * Math.cos((a - 90) * Math.PI / 180), cy + r * Math.sin((a - 90) * Math.PI / 180)];
    const [x0, y0] = p(a0); const [x1, y1] = p(a1);
    return <path d={`M${x0},${y0} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1}`} fill="none" stroke={colr} strokeWidth={7} strokeLinecap="butt" />;
  };
  const stops = ['#d32020', '#f27716', '#faca48', '#a9e34b', '#16a544'];
  const span = 270 / stops.length;
  const pct = value === null || value === undefined ? null : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const ang = pct === null ? null : -135 + pct * 270;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size}>
        {stops.map((c, i) => arc(-135 + i * span, -135 + (i + 1) * span, c))}
        {ang !== null ? <circle cx={cx + r * Math.cos((ang - 90) * Math.PI / 180)} cy={cy + r * Math.sin((ang - 90) * Math.PI / 180)} r={5} fill="white" stroke={G.text} strokeWidth={2} /> : null}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 300 }}>{value === null || value === undefined ? '--' : value}</span>
        <span style={{ fontSize: 9, color: G.muted }}>{unit}</span>
      </div>
    </div>
  );
}

// 20px bar (Intensity Minutes / Steps style) with an optional label row.
export function Bar({ value, goal, color, height = 12, style }) {
  const pct = goal ? Math.max(0, Math.min(100, (value / goal) * 100)) : 0;
  return <div style={{ background: G.border, height, width: '100%', ...style }}><div style={{ width: `${pct}%`, height: '100%', background: color }} /></div>;
}

// Personal Records style table.
export function DataTable({ columns, rows, empty = 'No data' }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr>{columns.map((c) => <th key={c.key} style={{ textAlign: c.align || 'left', fontSize: 12, fontWeight: 700, padding: '8px 12px 8px 0', borderBottom: `1px solid ${G.faint}` }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={columns.length} style={{ padding: 12, color: G.muted, fontWeight: 300 }}>{empty}</td></tr> : rows.map((r, i) => (
            <tr key={r.key || i}>{columns.map((c) => <td key={c.key} style={{ textAlign: c.align || 'left', padding: '9px 12px 9px 0', borderBottom: `1px solid ${G.border}`, fontWeight: c.bold ? 600 : 300, whiteSpace: 'nowrap' }}>{c.render ? c.render(r) : (r[c.key] ?? '--')}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Green Goals tile with a white circle glyph.
export function TileCard({ title, icon, caption, color = G.green, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{ background: color, color: 'white', border: 'none', borderRadius: 4, padding: '16px 12px 14px', width: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: G.font }}>
      <div style={{ fontSize: 16, fontWeight: 300 }}>{title}</div>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GarminIcon name={icon} color={color} size={28} /></div>
      <div style={{ fontSize: 11 }}>{caption}</div>
    </button>
  );
}

// Hexagon badge with a category color and the name under it.
const HEX_COLORS = ['#16a544', '#1265c2', '#f27716', '#6f42f3', '#15aabf', '#d42fc2', '#faca48', '#e02c2c'];
export function HexBadge({ name, index = 0, earned = true, points = null, size = 72 }) {
  const color = HEX_COLORS[index % HEX_COLORS.length];
  return (
    <div style={{ width: size + 24, textAlign: 'center', fontSize: 11, lineHeight: 1.3, color: G.text, opacity: earned ? 1 : 0.45 }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block', margin: '0 auto 6px' }}>
        <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill={color} stroke="#0f0f0f" strokeWidth={4} />
        <polygon points="50,14 83,33 83,67 50,86 17,67 17,33" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={2} />
        <text x="50" y="58" textAnchor="middle" fontSize="26" fontWeight="300" fill="white" fontFamily="Open Sans, sans-serif">{points !== null ? points : '★'}</text>
      </svg>
      {name}
    </div>
  );
}

// Round gray hero used by PacePro / Workouts / Insights.
export function Illustration({ icon, color = G.blue, size = 96 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: G.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><GarminIcon name={icon} color={color} size={size / 2} /></div>;
}

export const Notice = ({ children, icon = 'info', style }) => <div style={{ ...noticeStrip, ...style }}><GarminIcon name={icon} color={G.muted} size={14} /> <span>{children}</span></div>;

// The little avatar circle with the user's initial.
export const Avatar = ({ name = '', size = 28 }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: '#2b2b2b', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, fontWeight: 600, flexShrink: 0 }}>{(name || '?').trim().charAt(0).toUpperCase()}</div>
);
