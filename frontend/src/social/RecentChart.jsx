import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { COLORS } from '../shared/styles';
import { CHART } from '../shared/charts/palette';
import { todayISO, shiftISO, isoToDate } from '../shared/dayInfo';
import { num } from '../shared/format';
import { shortDate } from './format';

// The TikTok Data card's line chart: views of every video posted in the last 30 days (the same
// window as the "Posts, last 30 days" tile), x = post date, one dot per video, a dashed line at the
// window's median. Hover or tap a dot for its numbers and opening line; click opens the video.
const WINDOW_DAYS = 30;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 44 };
const DAY_MS = 24 * 60 * 60 * 1000;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
// Three round y ticks from 0 to just above the max.
function yTicks(max) {
  if (!max) return [0, 1];
  const step0 = max / 2;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= step0);
  return [0, step, step * 2];
}
const shortNum = (v) => (v >= 1000 ? `${num(v / 1000, v % 1000 ? 1 : 0)}k` : num(v));
const monthDay = (iso) => isoToDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function RecentChart({ videos }) {
  const wrap = useRef(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const today = todayISO();
  const start = shiftISO(today, -WINDOW_DAYS);
  const points = useMemo(() => (videos || [])
    .filter((v) => v.date_posted && v.date_posted >= start)
    .map((v) => ({ ...v, views: Number(v.views) || 0 }))
    .sort((a, b) => (a.date_posted === b.date_posted ? String(a.video_id).localeCompare(String(b.video_id)) : a.date_posted < b.date_posted ? -1 : 1)),
  [videos, start]);

  useEffect(() => { setHover(null); }, [points]);

  if (!points.length) {
    return <div ref={wrap} style={{ color: COLORS.muted, fontSize: 13, margin: '4px 0 16px' }}>No posts in the last 30 days.</div>;
  }

  const t0 = isoToDate(start).getTime();
  const t1 = isoToDate(today).getTime();
  const ticks = yTicks(Math.max(...points.map((p) => p.views)));
  const yMax = ticks[ticks.length - 1];
  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  // Two posts on one day sit a few pixels apart so both dots stay reachable.
  const sameDay = new Map();
  const xy = points.map((p) => {
    const k = sameDay.get(p.date_posted) || 0;
    sameDay.set(p.date_posted, k + 1);
    const x = PAD.left + ((isoToDate(p.date_posted).getTime() - t0) / (t1 - t0)) * innerW + k * 6;
    const y = PAD.top + innerH - (p.views / yMax) * innerH;
    return { p, x, y };
  });
  const med = median(points.map((p) => p.views));
  const medY = PAD.top + innerH - (med / yMax) * innerH;
  const line = xy.map((d, i) => `${i ? 'L' : 'M'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ');
  // Date ticks from the window's start: weekly, or every 15 days when the plot is phone-narrow.
  const dateTicks = [];
  const tickStep = innerW >= 280 ? 7 : 15;
  for (let d = 0; d <= WINDOW_DAYS; d += tickStep) dateTicks.push(shiftISO(start, d));
  const xOf = (iso) => PAD.left + ((isoToDate(iso).getTime() - t0) / (t1 - t0)) * innerW;
  const span = Math.round((t1 - t0) / DAY_MS);

  const nearest = (clientX) => {
    const rect = wrap.current.getBoundingClientRect();
    const fx = clientX - rect.left;
    let best = 0; let bestD = Infinity;
    xy.forEach((d, i) => { const dist = Math.abs(d.x - fx); if (dist < bestD) { bestD = dist; best = i; } });
    return best;
  };
  const h = hover !== null ? xy[hover] : null;
  const tipLeft = h ? Math.min(Math.max(h.x - 120, 0), Math.max(0, width - 240)) : 0;

  return (
    <div ref={wrap} style={{ position: 'relative', margin: '4px 0 16px' }}
      onMouseMove={(e) => setHover(nearest(e.clientX))} onMouseLeave={() => setHover(null)}
      onTouchStart={(e) => setHover(nearest(e.touches[0].clientX))}>
      {width ? (
        <svg width={width} height={H} role="img" aria-label={`Views of the ${points.length} videos posted in the last ${span} days`} style={{ display: 'block' }}>
          {ticks.map((t) => {
            const y = PAD.top + innerH - (t / yMax) * innerH;
            return (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke={CHART.track} strokeWidth={1} />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize={11} fill={COLORS.muted}>{shortNum(t)}</text>
              </g>
            );
          })}
          {dateTicks.map((iso, i) => (
            <text key={iso} x={xOf(iso)} y={H - 6} textAnchor={i === 0 ? 'start' : iso === today ? 'end' : 'middle'} fontSize={11} fill={COLORS.muted}>{monthDay(iso)}</text>
          ))}
          <line x1={PAD.left} x2={width - PAD.right} y1={medY} y2={medY} stroke={COLORS.muted} strokeWidth={1} strokeDasharray="4 4" />
          <text x={width - PAD.right} y={medY - 4} textAnchor="end" fontSize={11} fill={COLORS.muted}>median {num(med)}</text>
          {h ? <line x1={h.x} x2={h.x} y1={PAD.top} y2={PAD.top + innerH} stroke={COLORS.muted} strokeWidth={1} /> : null}
          <path d={line} fill="none" stroke={CHART.blue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {xy.map((d, i) => (
            <circle key={d.p.video_id} cx={d.x} cy={d.y} r={hover === i ? 5 : 4} fill={CHART.blue} stroke="#fff" strokeWidth={2}
              style={{ cursor: 'pointer' }} onClick={() => d.p.url && window.open(d.p.url, '_blank', 'noopener,noreferrer')} />
          ))}
        </svg>
      ) : <div style={{ height: H }} />}
      {h ? (
        <div style={{ position: 'absolute', top: h.y < H / 2 ? h.y + 14 : Math.max(0, h.y - 110), left: tipLeft, width: 240, pointerEvents: 'none', background: '#fff', border: `1px solid ${COLORS.hairline}`, borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.08)', padding: '8px 10px', fontSize: 12, color: COLORS.ink, lineHeight: 1.45 }}>
          <div style={{ color: COLORS.muted }}>{shortDate(h.p.date_posted)}</div>
          <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{num(h.p.views)} views</div>
          <div style={{ color: COLORS.muted, fontVariantNumeric: 'tabular-nums' }}>{num(h.p.likes)} likes · {num(h.p.saves)} saves · {num(h.p.shares)} shares</div>
          {h.p.hook_summary ? <div style={{ marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>"{h.p.hook_summary}"</div> : null}
        </div>
      ) : null}
    </div>
  );
}
