import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '../icons';
import { MUSCLE_GROUPS, groupOf } from '../muscles';
import { fmtVolume } from '../ptParts';
import { COLORS } from '../../shared/styles';
import { roundButton } from '../theme';
import MusclePopover, { POP_W } from './MusclePopover';
import { FIGURE, FIGURE_RATIO, SPOTS } from './figureSpots';

// The Overview's figure since 2026-09-29: the user's own renders of the body, front and back, shown as they
// are with the heat map painted over them ("just use this image for now"; a generated 3D mesh was rejected).
//   heat    one soft radial glow per spot of every trained group (figureSpots.js), yellow -> orange -> red
//           by the group's share of the busiest group, in a layer masked by that image's own alpha so it
//           never leaves the silhouette, blended so the satin shading shows through
//   turn    < Front / Back > or a sideways drag turns him around: the two images are the faces of a card
//           that rotates about the vertical axis (a crossfade under reduced motion)
//   dots    one per trained group at its first spot on the side shown; a dot opens MusclePopover, placed
//           clear of the body (left of the silhouette, else right, else under the figure), never over it
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
// Where the body is, row by row: for ROWS bands of the image, the leftmost and rightmost opaque x as
// fractions of its width (null for an empty row), read once from the image's own alpha.
const ROWS = 120;
const ORIGIN_Y = 0.32; // the zoom's transform origin, matching transformOrigin below
function silhouetteRows(img) {
  try {
    const w = 200;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = ROWS;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, ROWS);
    const px = ctx.getImageData(0, 0, w, ROWS).data;
    const rows = [];
    for (let y = 0; y < ROWS; y += 1) {
      let l = -1;
      let r = -1;
      for (let x = 0; x < w; x += 1) {
        if (px[(y * w + x) * 4 + 3] > 40) { if (l < 0) l = x; r = x; }
      }
      rows.push(l < 0 ? null : [l / w, (r + 1) / w]);
    }
    return rows;
  } catch (err) {
    return null; // a tainted or undecodable image: the dot-relative placement takes over
  }
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function BodyImage({ now, before, beforeCount, beforeLabel, unit, top, onOpenTrainer, compact, onFail, rangeControl }) {
  const [side, setSide] = useState('front');
  const [srcs, setSrcs] = useState({ front: FIGURE.front.src, back: FIGURE.back.src });
  const [zoomIx, setZoomIx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [popPos, setPopPos] = useState(null);
  const boxRef = useRef(null);
  const frameRef = useRef(null);
  const rowsRef = useRef({});
  const [layoutTick, setLayoutTick] = useState(0); // a resize or a silhouette read re-places the popover
  const dotRefs = useRef({});
  const drag = useRef(null);
  const [reduced] = useState(reducedMotion);

  const max = Math.max(1, ...MUSCLE_GROUPS.map((g) => now[g.key] || 0));
  const total = MUSCLE_GROUPS.reduce((t, g) => t + (now[g.key] || 0), 0);
  const trained = (k) => (now[k] || 0) > 0;
  const other = side === 'front' ? 'back' : 'front';
  const onlyOther = Object.keys(SPOTS[other]).filter((k) => trained(k) && !SPOTS[side][k]).length;
  const zoom = ZOOMS[zoomIx];
  const pick = (k) => setPicked((cur) => (cur === k ? null : k));
  const turn = () => { setSide(other); setPicked(null); };

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setLayoutTick((t) => t + 1));
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  const readRows = (s, img) => {
    if (!img || !img.complete || !img.naturalWidth || rowsRef.current[s]) return;
    rowsRef.current[s] = silhouetteRows(img);
    setLayoutTick((t) => t + 1);
  };

  // At the dot's height but clear of the body (the user's rule, 2026-10-03: the box goes on the side
  // where it does not cover the model): left of the silhouette's widest point across the box's
  // height, else right of it, else in the flow under the figure (always on a phone).
  useLayoutEffect(() => {
    const box = boxRef.current;
    const frame = frameRef.current;
    const dot = picked ? dotRefs.current[`${side}-${picked}`] : null;
    if (!box || !frame || !dot || compact) { setPopPos(null); return; }
    const b = box.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    const d = dot.getBoundingClientRect();
    const cx = d.left + d.width / 2 - b.left;
    const cy = d.top + d.height / 2 - b.top;
    const top = Math.max(0, cy - 40);
    const dialog = box.querySelector('[role="dialog"]');
    const height = dialog ? dialog.offsetHeight : 150;
    const rows = rowsRef.current[side];
    const gap = 14;
    if (!rows) {
      setPopPos({ left: cx - POP_W - 22 >= 0 ? cx - POP_W - 22 : Math.min(b.width - POP_W, cx + 22), top });
      return;
    }
    // Image fraction <-> box px, through the zoom (scaled about 50% / ORIGIN_Y, clipped by the frame).
    const fl = f.left - b.left;
    const ft = f.top - b.top;
    const toX = (u) => Math.min(fl + f.width, Math.max(fl, fl + f.width * (0.5 + (u - 0.5) * zoom)));
    const toV = (y) => ORIGIN_Y + ((y - ft) / f.height - ORIGIN_Y) / zoom;
    const v0 = Math.max(0, toV(Math.max(top, ft)));
    const v1 = Math.min(1, toV(Math.min(top + height, ft + f.height)));
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = Math.floor(v0 * ROWS); i <= Math.min(ROWS - 1, Math.floor(v1 * ROWS)); i += 1) {
      if (rows[i]) { lo = Math.min(lo, rows[i][0]); hi = Math.max(hi, rows[i][1]); }
    }
    const bodyL = lo === Infinity ? cx : toX(lo);
    const bodyR = hi === -Infinity ? cx : toX(hi);
    if (bodyL - gap - POP_W >= 0) setPopPos({ left: bodyL - gap - POP_W, top });
    else if (bodyR + gap + POP_W <= b.width) setPopPos({ left: bodyR + gap, top });
    else setPopPos(null);
  }, [picked, zoom, compact, side, layoutTick]);

  // A sideways drag of 50 px or more turns him around (clicks on dots and buttons are left alone).
  const onPointerDown = (e) => { if (e.target.closest('button')) return; drag.current = e.clientX; };
  const onPointerUp = (e) => {
    if (drag.current === null) return;
    const dx = e.clientX - drag.current;
    drag.current = null;
    if (Math.abs(dx) >= 50) turn();
  };

  const face = (s) => {
    const src = srcs[s];
    const mask = `url(${src}) center / 100% 100% no-repeat`;
    const spots = SPOTS[s];
    const groups = Object.keys(spots).filter(trained);
    const shown = side === s;
    return (
      <div key={s} aria-hidden={!shown} style={{
        position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', isolation: 'isolate',
        transform: reduced ? 'none' : (s === 'back' ? 'rotateY(180deg)' : 'none'),
        opacity: reduced ? (shown ? 1 : 0) : 1, transition: reduced ? 'opacity .3s' : 'none', pointerEvents: shown ? 'auto' : 'none',
      }}>
        <img
          ref={(el) => readRows(s, el)}
          onLoad={(e) => readRows(s, e.currentTarget)}
          src={src}
          alt={shown ? `Body figure, ${s}, with the trained muscles glowing` : ''}
          draggable={false}
          onError={() => (src === FIGURE[s].src ? setSrcs((x) => ({ ...x, [s]: FIGURE[s].fallback })) : onFail('image'))}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', filter: 'drop-shadow(0 0 16px rgba(255,255,255,.95)) drop-shadow(0 0 42px rgba(255,255,255,.7))', userSelect: 'none' }}
        />
        {/* The heat, clipped to the body by the image's own alpha. */}
        <div style={{ position: 'absolute', inset: 0, WebkitMask: mask, mask, mixBlendMode: 'hard-light', pointerEvents: 'none' }}>
          {groups.flatMap((k) => spots[k].map((p, i) => (
            <div key={`${k}-${i}`} style={{
              position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: `${p.r * 2.6}%`, aspectRatio: '1', transform: 'translate(-50%, -50%)',
              background: glow((now[k] || 0) / max), borderRadius: '50%',
            }} />
          )))}
        </div>
        {groups.map((k) => {
          const p = spots[k][0];
          const g = groupOf(k);
          const d = 12 + 8 * Math.sqrt((now[k] || 0) / max);
          return (
            <button key={k} ref={(el) => { dotRefs.current[`${s}-${k}`] = el; }} type="button" onClick={() => pick(k)} tabIndex={shown ? 0 : -1}
              title={`${g.label}: ${fmtVolume(now[k], unit)} ${unit}`} aria-label={`${g.label} details`}
              style={{
                position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, width: d, height: d, transform: `translate(-50%, -50%) scale(${1 / zoom})`,
                borderRadius: '50%', padding: 0, cursor: 'pointer', background: g.color, border: '3px solid #FFFFFF',
                boxShadow: picked === k ? `0 0 0 7px ${g.color}33` : '0 2px 6px rgba(30,50,110,.25)',
              }} />
          );
        })}
      </div>
    );
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: COLORS.muted }}>
        <span>{total ? 'Muscles worked · drag to turn' : 'Muscles worked: no gym sessions in this range'}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {rangeControl}
          {onlyOther ? (
            <button type="button" onClick={turn} style={{ border: `1px solid ${COLORS.hairline}`, background: 'rgba(255,255,255,.8)', borderRadius: 999, padding: '5px 10px', fontSize: 12, color: COLORS.ink, cursor: 'pointer', font: 'inherit' }}>
              +{onlyOther} trained on the {other}
            </button>
          ) : null}
        </span>
      </div>
      {/* The figure and its Front / Back row, centered in whatever height the cell gives (the Overview's
          middle column spans both grid rows); the caption stays at the top. */}
      <div style={{ flex: 1, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div ref={frameRef} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = null; }}
        style={{ width: '100%', maxWidth: compact ? 300 : 400, overflow: 'hidden', position: 'relative', marginTop: 6, perspective: 1600, touchAction: 'pan-y', cursor: 'grab' }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: `${FIGURE_RATIO}`, transform: `scale(${zoom})`, transformOrigin: '50% 32%', transition: 'transform .2s' }}>
          <div data-side={side} style={{
            position: 'absolute', inset: 0, transformStyle: 'preserve-3d',
            transform: reduced || side === 'front' ? 'none' : 'rotateY(180deg)', transition: reduced ? 'none' : 'transform .6s cubic-bezier(.4, 0, .2, 1)',
          }}>
            {face('front')}
            {face('back')}
          </div>
        </div>
      </div>
      {picked ? (
        <MusclePopover muscle={picked} now={now} total={total} before={before} beforeCount={beforeCount} beforeLabel={beforeLabel} unit={unit} top={top}
          onClose={() => setPicked(null)} onOpenTrainer={onOpenTrainer} pos={popPos} />
      ) : null}
      <div style={{ position: 'absolute', left: 0, top: 36, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2 }}>
        <button type="button" style={roundButton()} aria-label="Zoom in" disabled={zoomIx === ZOOMS.length - 1} onClick={() => setZoomIx((i) => Math.min(ZOOMS.length - 1, i + 1))}><Icon name="plus" /></button>
        <button type="button" style={roundButton()} aria-label="Zoom out" disabled={zoomIx === 0} onClick={() => setZoomIx((i) => Math.max(0, i - 1))}><Icon name="minus" /></button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 12, color: COLORS.muted }}>
        <button type="button" style={roundButton(28)} aria-label="Turn him around" onClick={turn}><Icon name="left" size={14} /></button>
        <span style={{ minWidth: 34, textAlign: 'center' }}>{side === 'front' ? 'Front' : 'Back'}</span>
        <button type="button" style={roundButton(28)} aria-label="Turn him around" onClick={turn}><Icon name="right" size={14} /></button>
      </div>
      </div>
    </div>
  );
}
