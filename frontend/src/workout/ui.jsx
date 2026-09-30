import React from 'react';
import Icon from './icons';
import { COLORS } from '../shared/styles';
import { W, iconDisc } from './theme';

// The Overview's building blocks, shared by every section so the whole tab reads as one style
// (the user's call, 2026-09-29: "everything should be reformatted to this style").

// Card head: black icon disc, title, grey sub line; `aside` is a chip on the right, `actions` sit next to it.
export function CardHeader({ icon = 'dumbbell', title, sub = null, aside = null, actions = null, onClick = null, open = null }) {
  const head = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span style={iconDisc()}><Icon name={icon} size={17} /></span>
      <span style={{ minWidth: 0, textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: COLORS.ink }}>
          {title}
          {open !== null ? <span style={{ color: W.blue, marginLeft: 8, fontSize: 12 }} aria-hidden="true">{open ? '▾' : '▸'}</span> : null}
        </span>
        {sub ? <span style={{ display: 'block', fontSize: 12, color: COLORS.muted, marginTop: 1 }}>{sub}</span> : null}
      </span>
    </span>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      {onClick ? (
        <button type="button" onClick={onClick} aria-expanded={open === null ? undefined : open} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit' }}>{head}</button>
      ) : head}
      {aside || actions ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0 }}>
          {aside ? <Chip>{aside}</Chip> : null}
          {actions}
        </span>
      ) : null}
    </div>
  );
}

// Uppercase label over a big thin number with a small unit (the Session length AVG / RANGE look).
export function Figure({ label, value, unit = null, sub = null, size = 28 }) {
  const shown = value === null || value === undefined || value === '' ? '-' : value;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={figureLabel}>{label}</div>
      <div style={{ fontSize: size, fontWeight: 500, letterSpacing: -1, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: COLORS.ink, whiteSpace: 'nowrap' }}>
        {shown}{shown !== '-' && unit ? <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500, letterSpacing: 0, marginLeft: 3 }}>{unit}</span> : null}
      </div>
      {sub ? <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}
export const figureLabel = { fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: COLORS.muted };

// Pill; with `color` it is a pastel wash of that color with a dot, like the muscle chips.
export function Chip({ children, color = null, style = null }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      background: color ? `${color}1F` : W.chip, color: color || COLORS.muted, fontVariantNumeric: 'tabular-nums', ...style,
    }}>
      {color ? <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flex: 'none' }} /> : null}
      {children}
    </span>
  );
}

// Pastel tile (the Highlights look): icon on a white disc, label, value, sub.
export function PastelTile({ icon, label, value, sub = null, bg = W.blueTile, fg = W.blueInk, valueSize = 19 }) {
  return (
    <div style={{ borderRadius: 20, padding: 14, minHeight: 96, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8, background: bg, color: fg, minWidth: 0 }}>
      <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={15} /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12 }}>{label}</div>
        <div style={{ fontSize: valueSize, fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{value}</div>
        {sub ? <div style={{ fontSize: 11 }}>{sub}</div> : null}
      </div>
    </div>
  );
}
export const PASTELS = [[W.yellowTile, W.yellowInk], [W.blueTile, W.blueInk], ['#E4F4EC', '#1F5E3F'], ['#F7E6F0', '#7A2754'], ['#EDE9FB', '#3F2F8A'], ['#FDEBDD', '#7A3B0E']];
