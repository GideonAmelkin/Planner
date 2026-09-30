import React, { useLayoutEffect, useRef, useState } from 'react';
import Icon from '../icons';
import { MUSCLE_GROUPS, groupOf } from '../muscles';
import { fmtVolume, Delta } from '../ptParts';
import { COLORS } from '../../shared/styles';
import { W, roundButton } from '../theme';
import { BODY_HALF, CORE, FOOT, HAND, HEAD, HOTSPOTS, LINES, MUSCLE_HALF, NECK, VIEW_H, VIEW_W } from './figure';

// The Overview's centre piece: a shaded figure, front or back (the < > under it), each muscle group
// tinted by its share of the range's volume, and a dot on every group trained in the range (bigger =
// more). A dot opens a popover: pounds, share, change against the same-length window before (only
// when that window has gym sessions to compare with), the top exercise, and Open in Trainer.
// + and - zoom the figure; the popover follows the dot.
const ZOOMS = [1, 1.25, 1.5, 1.75];
const POP_W = 220;
const pct = (x) => `${Math.round(x * 100)}%`;

export default function BodyFigure({ now, before, beforeCount, beforeLabel, unit, top, onOpenTrainer, compact }) {
  const [side, setSide] = useState('front');
  const [zoomIx, setZoomIx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [popPos, setPopPos] = useState(null);
  const boxRef = useRef(null);
  const dotRefs = useRef({});

  const max = Math.max(1, ...MUSCLE_GROUPS.map((g) => now[g.key] || 0));
  const total = MUSCLE_GROUPS.reduce((t, g) => t + (now[g.key] || 0), 0);
  const trained = (k) => (now[k] || 0) > 0;
  const other = side === 'front' ? 'back' : 'front';
  const onOtherSide = Object.keys(HOTSPOTS[other]).filter((k) => trained(k) && !HOTSPOTS[side][k]).length;
  const zoom = ZOOMS[zoomIx];
  const pick = (k) => setPicked((cur) => (cur === k ? null : k));

  // Place the popover beside its dot (left of it when there is room, else right); on a narrow
  // column it drops under the figure instead.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const dot = picked ? dotRefs.current[picked] : null;
    if (!box || !dot || compact) { setPopPos(null); return; }
    const b = box.getBoundingClientRect();
    const d = dot.getBoundingClientRect();
    const cx = d.left + d.width / 2 - b.left;
    const cy = d.top + d.height / 2 - b.top;
    const left = cx - POP_W - 22 >= 0 ? cx - POP_W - 22 : Math.min(b.width - POP_W, cx + 22);
    setPopPos({ left, top: Math.max(0, cy - 40) });
  }, [picked, side, zoom, compact]);

  const mirror = (children) => (
    <>
      <g>{children}</g>
      <g transform={`translate(${VIEW_W} 0) scale(-1 1)`}>{children}</g>
    </>
  );
  const tint = (k) => (trained(k)
    ? { fill: groupOf(k).color, fillOpacity: (0.28 + (0.5 * now[k]) / max).toFixed(2) }
    : { fill: '#9AA3B5', fillOpacity: 0.12 });
  const skin = 'url(#wkSkin)';
  const regions = MUSCLE_HALF[side];

  const g = picked ? groupOf(picked) : null;
  const beforeKg = before ? before[picked] || 0 : 0;
  const popover = g ? (
    <div role="dialog" aria-label={`${g.label} details`} style={{
      ...(popPos ? { position: 'absolute', left: popPos.left, top: popPos.top } : { position: 'relative', margin: '8px auto 0' }),
      width: POP_W, maxWidth: '100%', background: 'rgba(255,255,255,.96)', border: `1px solid ${COLORS.hairline}`, borderRadius: 16,
      boxShadow: '0 12px 30px rgba(30,50,110,.14)', padding: '12px 14px', fontSize: 12, zIndex: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: g.color }} />{g.label}
        </span>
        <button type="button" onClick={() => setPicked(null)} aria-label="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.muted, fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
      </div>
      <div style={{ color: COLORS.muted, marginTop: 4 }}>{fmtVolume(now[picked], unit)} {unit} lifted, {pct(now[picked] / total)} of the range</div>
      {top[picked] ? <div style={{ marginTop: 4 }}>Top: {top[picked].name}, {fmtVolume(top[picked].kg, unit)} {unit}</div> : null}
      <div style={{ marginTop: 4 }}>
        {!before ? null
          : !beforeCount ? <span style={{ color: COLORS.muted }}>No change shown: no gym sessions {beforeLabel}.</span>
            : beforeKg > 0 ? <Delta kg={now[picked] - beforeKg} unit={unit} suffix={` vs ${beforeLabel}`} />
              : <span style={{ color: COLORS.muted }}>Not trained {beforeLabel}.</span>}
      </div>
      <button type="button" onClick={() => onOpenTrainer(picked)} style={{ marginTop: 8, border: 'none', background: 'transparent', padding: 0, color: W.blue, fontWeight: 600, cursor: 'pointer', font: 'inherit', fontSize: 12 }}>Open in Trainer →</button>
    </div>
  ) : null;

  return (
    <div ref={boxRef} style={{ position: 'relative', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: COLORS.muted }}>
        <span>{total ? 'Muscles worked' : 'Muscles worked: no gym sessions in this range'}</span>
        {onOtherSide ? (
          <button type="button" onClick={() => { setSide(other); setPicked(null); }} style={{ border: `1px solid ${COLORS.hairline}`, background: 'rgba(255,255,255,.8)', borderRadius: 999, padding: '5px 10px', fontSize: 12, color: COLORS.ink, cursor: 'pointer', font: 'inherit' }}>
            +{onOtherSide} trained on the {other}
          </button>
        ) : null}
      </div>
      <div style={{ width: '100%', maxWidth: 340, overflow: 'hidden', position: 'relative' }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={`Body, ${side}: muscles trained in the range`}
          style={{ width: '100%', height: 'auto', display: 'block', transform: `scale(${zoom})`, transformOrigin: '50% 35%', transition: 'transform .2s' }}>
          <defs>
            <radialGradient id="wkSkin" cx="150" cy="230" r="260" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#F7F8FB" /><stop offset=".55" stopColor="#DCE1EA" /><stop offset="1" stopColor="#AEB7C6" />
            </radialGradient>
            <radialGradient id="wkGlow" cx="150" cy="300" r="190" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#7C9BFF" stopOpacity=".28" /><stop offset="1" stopColor="#7C9BFF" stopOpacity="0" />
            </radialGradient>
            <filter id="wkSoft" x="-20%" y="-10%" width="140%" height="120%">
              <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#3B4B7A" floodOpacity=".18" />
            </filter>
          </defs>
          <ellipse cx="150" cy="300" rx="190" ry="260" fill="url(#wkGlow)" />
          <ellipse cx="150" cy="566" rx="118" ry="16" fill="none" stroke="#C9D5F5" strokeWidth="1.5" />
          <ellipse cx="150" cy="566" rx="70" ry="8" fill="#C9D5F5" fillOpacity=".35" />
          <g filter="url(#wkSoft)">
            <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} fill={skin} />
            <path d={NECK} fill={skin} />
            {mirror(
              <>
                {BODY_HALF.map((d) => <path key={d} d={d} fill={skin} />)}
                <ellipse cx={HAND.cx} cy={HAND.cy} rx={HAND.rx} ry={HAND.ry} transform={`rotate(${HAND.rotate} ${HAND.cx} ${HAND.cy})`} fill={skin} />
                <ellipse cx={FOOT.cx} cy={FOOT.cy} rx={FOOT.rx} ry={FOOT.ry} fill={skin} />
              </>,
            )}
          </g>
          {mirror(Object.keys(regions).map((k) => (
            <path key={k} d={regions[k]} {...tint(k)} stroke={picked === k ? COLORS.ink : 'none'} strokeWidth={1.5} onClick={() => trained(k) && pick(k)} style={{ cursor: trained(k) ? 'pointer' : 'default' }} />
          )))}
          {side === 'front' ? <path d={CORE} {...tint('core')} stroke={picked === 'core' ? COLORS.ink : 'none'} strokeWidth={1.5} onClick={() => trained('core') && pick('core')} style={{ cursor: trained('core') ? 'pointer' : 'default' }} /> : null}
          <path d={LINES[side]} fill="none" stroke="#7D879B" strokeOpacity=".28" strokeWidth="1.2" />
          {Object.entries(HOTSPOTS[side]).filter(([k]) => trained(k)).map(([k, [x, y]]) => {
            const r = 5 + 5 * Math.sqrt(now[k] / max);
            const c = groupOf(k).color;
            return (
              <g key={k} ref={(el) => { dotRefs.current[k] = el; }} onClick={() => pick(k)} style={{ cursor: 'pointer' }}>
                <title>{`${groupOf(k).label}: ${fmtVolume(now[k], unit)} ${unit}`}</title>
                {picked === k ? <circle cx={x} cy={y} r={r + 7} fill={c} fillOpacity=".18" /> : null}
                <circle cx={x} cy={y} r={r + 8} fill="transparent" />
                <circle cx={x} cy={y} r={r} fill={c} stroke="#fff" strokeWidth="3" />
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ position: 'absolute', left: 0, top: popPos || !g ? undefined : 36, bottom: popPos || !g ? 72 : undefined, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" style={roundButton()} aria-label="Zoom in" disabled={zoomIx === ZOOMS.length - 1} onClick={() => setZoomIx((i) => Math.min(ZOOMS.length - 1, i + 1))}><Icon name="plus" /></button>
        <button type="button" style={roundButton()} aria-label="Zoom out" disabled={zoomIx === 0} onClick={() => setZoomIx((i) => Math.max(0, i - 1))}><Icon name="minus" /></button>
      </div>
      {popover}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 12, color: COLORS.muted }}>
        <button type="button" style={roundButton(28)} aria-label="Show the other side" onClick={() => { setSide(other); setPicked(null); }}><Icon name="left" size={14} /></button>
        <span style={{ minWidth: 34, textAlign: 'center' }}>{side === 'front' ? 'Front' : 'Back'}</span>
        <button type="button" style={roundButton(28)} aria-label="Show the other side" onClick={() => { setSide(other); setPicked(null); }}><Icon name="right" size={14} /></button>
      </div>
    </div>
  );
}
