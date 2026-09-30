import React, { useLayoutEffect, useRef, useState } from 'react';
import Icon from '../icons';
import { MUSCLE_GROUPS, groupOf } from '../muscles';
import { fmtVolume } from '../ptParts';
import { COLORS } from '../../shared/styles';
import { roundButton } from '../theme';
import MusclePopover, { POP_W } from './MusclePopover';
import { BACK_ONLY, FIGURE_FALLBACK, FIGURE_RATIO, FIGURE_SRC, SPOTS } from './figureSpots';

// The Overview's figure since 2026-09-29: the user's own render of the body, shown as it is, with the
// heat map painted over it ("just use this image for now"; a generated 3D mesh was rejected).
//   heat    one soft radial glow per spot of every trained group (figureSpots.js), yellow -> orange ->
//           red by the group's share of the busiest group, in a layer masked by the image's own alpha so
//           it never leaves the silhouette, blended so the satin shading shows through
//   dots    one per trained group at its first spot; a dot opens MusclePopover
//   back    the picture is a front view: back, glutes and hamstrings are chips under it
//   zoom    + / - scale the figure inside its frame
// A failed image load calls onFail and BodyViewer shows the SVG figure.
const ZOOMS = [1, 1.25, 1.5, 1.8];
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
const YELLOW = [255, 214, 74];
const ORANGE = [255, 138, 31];
const RED = [230, 46, 30];
// Heat colour for a group at `w` (its volume over the busiest group's, 0..1].
export const heatColor = (w) => (w < 0.5 ? mix(YELLOW, ORANGE, w / 0.5) : mix(ORANGE, RED, (w - 0.5) / 0.5));
const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
const glow = (w) => {
  const c = heatColor(w);
  const a = 0.55 + 0.45 * w;
  return `radial-gradient(circle, ${rgba(c, 0.9 * a)} 0%, ${rgba(mix(c, YELLOW, 0.5), 0.55 * a)} 42%, ${rgba(YELLOW, 0)} 72%)`;
};

export default function BodyImage({ now, before, beforeCount, beforeLabel, unit, top, onOpenTrainer, compact, onFail }) {
  const [src, setSrc] = useState(FIGURE_SRC);
  const [zoomIx, setZoomIx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [popPos, setPopPos] = useState(null);
  const boxRef = useRef(null);
  const dotRefs = useRef({});

  const max = Math.max(1, ...MUSCLE_GROUPS.map((g) => now[g.key] || 0));
  const total = MUSCLE_GROUPS.reduce((t, g) => t + (now[g.key] || 0), 0);
  const trained = (k) => (now[k] || 0) > 0;
  const onFront = Object.keys(SPOTS).filter(trained);
  const onBack = BACK_ONLY.filter(trained);
  const zoom = ZOOMS[zoomIx];
  const pick = (k) => setPicked((cur) => (cur === k ? null : k));

  // Beside its dot (left when there is room, else right); in the flow on a phone or for a back chip.
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
  }, [picked, zoom, compact]);

  const mask = `url(${src}) center / 100% 100% no-repeat`;
  const popover = picked ? (
    <MusclePopover muscle={picked} now={now} total={total} before={before} beforeCount={beforeCount} beforeLabel={beforeLabel} unit={unit} top={top}
      onClose={() => setPicked(null)} onOpenTrainer={onOpenTrainer} pos={popPos} />
  ) : null;

  return (
    <div ref={boxRef} style={{ position: 'relative', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ alignSelf: 'stretch', fontSize: 12, color: COLORS.muted }}>
        {total ? 'Muscles worked' : 'Muscles worked: no gym sessions in this range'}
      </div>
      <div style={{ width: '100%', maxWidth: compact ? 300 : 400, overflow: 'hidden', position: 'relative', marginTop: 6 }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: `${FIGURE_RATIO}`, transform: `scale(${zoom})`, transformOrigin: '50% 32%', transition: 'transform .2s' }}>
          <img
            src={src}
            alt="Body figure with the trained muscles glowing"
            onError={() => (src === FIGURE_SRC ? setSrc(FIGURE_FALLBACK) : onFail('image'))}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', filter: 'drop-shadow(0 0 16px rgba(255,255,255,.95)) drop-shadow(0 0 42px rgba(255,255,255,.7))' }}
          />
          {/* The heat, clipped to the body by the image's own alpha. */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, WebkitMask: mask, mask, mixBlendMode: 'hard-light', pointerEvents: 'none' }}>
            {onFront.flatMap((k) => SPOTS[k].map((s, i) => (
              <div key={`${k}-${i}`} style={{
                position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, width: `${s.r * 2.6}%`, aspectRatio: '1', transform: 'translate(-50%, -50%)',
                background: glow((now[k] || 0) / max), borderRadius: '50%',
              }} />
            )))}
          </div>
          {onFront.map((k) => {
            const s = SPOTS[k][0];
            const g = groupOf(k);
            const d = 12 + 8 * Math.sqrt((now[k] || 0) / max);
            return (
              <button key={k} ref={(el) => { dotRefs.current[k] = el; }} type="button" onClick={() => pick(k)}
                title={`${g.label}: ${fmtVolume(now[k], unit)} ${unit}`} aria-label={`${g.label} details`}
                style={{
                  position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, width: d, height: d, transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                  borderRadius: '50%', padding: 0, cursor: 'pointer', background: g.color, border: '3px solid #FFFFFF',
                  boxShadow: picked === k ? `0 0 0 7px ${g.color}33` : '0 2px 6px rgba(30,50,110,.25)',
                }} />
            );
          })}
        </div>
      </div>
      {onBack.length ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: COLORS.muted }}>
          <span>Also trained, back of the body:</span>
          {onBack.map((k) => {
            const g = groupOf(k);
            const c = heatColor((now[k] || 0) / max);
            return (
              <button key={k} type="button" onClick={() => { setPopPos(null); pick(k); }} aria-label={`${g.label} details`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${COLORS.hairline}`, background: picked === k ? '#FFFFFF' : 'rgba(255,255,255,.75)', borderRadius: 999, padding: '4px 10px', cursor: 'pointer', font: 'inherit', fontSize: 12, color: COLORS.ink }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: `radial-gradient(circle, ${rgba(c, 1)} 0%, ${rgba(c, 0.35)} 100%)` }} />
                {g.label} <span style={{ color: COLORS.muted }}>{fmtVolume(now[k], unit)} {unit}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {popover}
      <div style={{ position: 'absolute', left: 0, top: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button type="button" style={roundButton()} aria-label="Zoom in" disabled={zoomIx === ZOOMS.length - 1} onClick={() => setZoomIx((i) => Math.min(ZOOMS.length - 1, i + 1))}><Icon name="plus" /></button>
        <button type="button" style={roundButton()} aria-label="Zoom out" disabled={zoomIx === 0} onClick={() => setZoomIx((i) => Math.max(0, i - 1))}><Icon name="minus" /></button>
      </div>
    </div>
  );
}
