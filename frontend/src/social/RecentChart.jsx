import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { COLORS } from '../shared/styles';
import { CHART } from '../shared/charts/palette';
import { todayISO, isoToDate } from '../shared/dayInfo';
import { num } from '../shared/format';
import { shortDate } from './format';
import { METRICS, RANGES, rangeStart, windowPosts, totals, seriesPoints, median, niceTicks } from './studioSeries';

// The TikTok Data card's chart, drawn like TikTok Studio's "Key metrics" (option 1 of
// https://claude.ai/artifact/GL5Dga9hH8g1P7mTTaFV82, picked 2026-10-10): a range picker, a tab per
// metric with its total for the range, then a thin line with a light fill under it. The line has a
// point for every day of the range through today (every week on Max): that day's posts summed
// (lifetime counts), 0 when nothing was posted. Hover or tap for the day, click opens its most
// viewed video. Metric and range are remembered per browser.
const H = 200;
const PAD = { top: 10, right: 44, bottom: 24, left: 4 };
const METRIC_KEY = 'planner.social.chartMetric';
const RANGE_KEY = 'planner.social.chartRange';
const TAB_MIN = 112;   // the strip scrolls sideways inside the card below six of these

const load = (key, ok, fallback) => { try { const v = localStorage.getItem(key); return ok(v) ? v : fallback; } catch (_) { return fallback; } };
const save = (key, v) => { try { localStorage.setItem(key, String(v)); } catch (_) { /* ignore */ } };
const shortNum = (v) => {
  if (v >= 1e6) return `${num(v / 1e6, v % 1e6 ? 1 : 0)}M`;
  if (v >= 1e4) return `${num(v / 1e3)}K`;
  if (v >= 1e3) return `${num(v / 1e3, v % 1e3 ? 1 : 0)}K`;
  return num(v);
};
const monthDay = (iso) => isoToDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const monthDayYear = (iso) => isoToDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const rangeLabel = (r) => (r === 'max' ? 'all time' : r === 365 ? 'last year' : `last ${r} days`);
const rangeButtonText = (r) => (r === 'max' ? 'Max' : `${r} days`);
const parseRange = (v) => (v === 'max' ? 'max' : Number(v));

const rangeButton = (on) => ({
  border: 0, background: on ? COLORS.page : COLORS.paper, color: on ? COLORS.ink : COLORS.muted,
  fontSize: 12, fontWeight: on ? 700 : 500, padding: '5px 11px', cursor: 'pointer', fontFamily: 'inherit',
});
const tabStyle = (on, last) => ({
  position: 'relative', display: 'grid', gap: 4, justifyItems: 'center', padding: '16px 10px 14px',
  border: 0, borderRight: last ? 0 : `1px solid ${COLORS.hairline}`, borderBottom: `1px solid ${on ? 'transparent' : COLORS.hairline}`,
  background: on ? COLORS.paper : COLORS.page, color: COLORS.ink, cursor: 'pointer', fontFamily: 'inherit',
});

export default function RecentChart({ videos }) {
  const wrap = useRef(null);
  const gradId = `studio-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState(null);
  const [metric, setMetric] = useState(() => load(METRIC_KEY, (v) => METRICS.some((m) => m.key === v), 'views'));
  const [range, setRange] = useState(() => parseRange(load(RANGE_KEY, (v) => RANGES.includes(parseRange(v)), '28')));

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
  const start = rangeStart(today, range, videos);
  const weekly = range === 'max';
  const posts = useMemo(() => windowPosts(videos, start, today), [videos, start, today]);
  const sums = useMemo(() => totals(posts), [posts]);
  const points = useMemo(() => seriesPoints(posts, metric, start, today, weekly ? 'week' : 'day'), [posts, metric, start, today, weekly]);
  const m = METRICS.find((x) => x.key === metric);

  useEffect(() => { setHover(null); }, [points]);

  const pickMetric = (key) => { setMetric(key); save(METRIC_KEY, key); };
  const pickRange = (days) => { setRange(days); save(RANGE_KEY, days); };

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.ink }}>Key metrics</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <span style={{ fontSize: 12, color: COLORS.muted, fontVariantNumeric: 'tabular-nums' }}>{start === today ? monthDayYear(today) : `${(start.slice(0, 4) === today.slice(0, 4) ? monthDay : monthDayYear)(start)} - ${monthDayYear(today)}`}</span>
      <div role="group" aria-label="Date range" style={{ display: 'inline-flex', border: `1px solid ${COLORS.hairline}`, borderRadius: 8, overflow: 'hidden' }}>
        {RANGES.map((d, i) => (
          <button key={d} type="button" aria-pressed={d === range} onClick={() => pickRange(d)}
            style={{ ...rangeButton(d === range), borderLeft: i ? `1px solid ${COLORS.hairline}` : 0 }}>{rangeButtonText(d)}</button>
        ))}
      </div>
      </div>
    </div>
  );

  const tabs = (
    <div style={{ overflowX: 'auto' }}>
      <div role="tablist" style={{ display: 'grid', gridTemplateColumns: `repeat(${METRICS.length}, minmax(${TAB_MIN}px, 1fr))`, minWidth: METRICS.length * TAB_MIN, border: `1px solid ${COLORS.hairline}`, borderBottom: 0, borderRadius: '10px 10px 0 0', overflow: 'hidden' }}>
        {METRICS.map((x, i) => {
          const on = x.key === metric;
          return (
            <button key={x.key} type="button" role="tab" aria-selected={on} onClick={() => pickMetric(x.key)} style={tabStyle(on, i === METRICS.length - 1)}>
              {on ? <span style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 4, background: CHART.blue }} /> : null}
              <span style={{ fontSize: 13, fontWeight: 500 }}>{x.label}</span>
              <span style={{ fontSize: 22, fontWeight: 500, color: on ? CHART.blue : COLORS.ink, fontVariantNumeric: 'tabular-nums' }}>{shortNum(sums[x.key])}</span>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{rangeLabel(range)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const boxStyle = { border: `1px solid ${COLORS.hairline}`, borderTop: 0, borderRadius: '0 0 10px 10px', padding: '12px 4px 4px 12px' };

  const ticks = niceTicks(Math.max(...points.map((p) => p.value)));
  const yMax = ticks[ticks.length - 1];
  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = H - PAD.top - PAD.bottom;
  // Points are evenly spaced (one per day, or per week on Max), first at the left edge, today's at the right.
  const xAt = (i) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2);
  const yOf = (v) => PAD.top + innerH - (v / yMax) * innerH;
  const xy = points.map((p, i) => ({ p, x: xAt(i), y: yOf(p.value) }));
  const base = PAD.top + innerH;
  const line = xy.map((d, i) => `${i ? 'L' : 'M'}${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ');
  const area = `${line} L${xy[xy.length - 1].x.toFixed(1)},${base} L${xy[0].x.toFixed(1)},${base} Z`;
  // The median of the days (weeks) you posted, so the zero days don't pull it to 0.
  const posted = points.filter((p) => p.posts.length);
  const med = posted.length ? median(posted.map((p) => p.value)) : null;
  const medY = med !== null ? yOf(med) : 0;
  // Evenly spaced date labels, one per ~110 px; the year is added from 60 days up, as Studio does.
  const labelCount = Math.min(points.length - 1, Math.max(2, Math.min(6, Math.floor(innerW / 110))));
  const dateTicks = [];
  for (let k = 0; k <= labelCount && labelCount > 0; k += 1) {
    const idx = Math.round(((points.length - 1) * k) / labelCount);
    dateTicks.push({ iso: points[idx].date, x: xAt(idx), k });
  }
  const dateLabel = range === 'max' || range >= 60 ? monthDayYear : monthDay;
  const last = xy[xy.length - 1];
  const unit = weekly ? 'weeks' : 'days';

  const nearest = (clientX) => {
    const rect = wrap.current.getBoundingClientRect();
    const fx = clientX - rect.left;
    let best = 0; let bestD = Infinity;
    xy.forEach((d, i) => { const dist = Math.abs(d.x - fx); if (dist < bestD) { bestD = dist; best = i; } });
    return best;
  };
  const h = hover !== null ? xy[hover] : null;
  const tipLeft = h ? Math.min(Math.max(h.x - 120, 0), Math.max(0, width - 240)) : 0;
  const open = (d) => { const top = d.p.posts[0]; if (top && top.url) window.open(top.url, '_blank', 'noopener,noreferrer'); };   // a zero day has none
  const sum = (ps, k) => ps.reduce((s, p) => s + p[k], 0);

  return (
    <div style={{ margin: '4px 0 16px' }}>
      {header}{tabs}
      <div style={boxStyle}>
        <div ref={wrap} style={{ position: 'relative' }}
          onMouseMove={(e) => setHover(nearest(e.clientX))} onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => setHover(nearest(e.touches[0].clientX))}
          onClick={() => { if (h) open(h); }}>
          {width ? (
            <svg width={width} height={H} role="img" aria-label={`${m.label} per ${weekly ? 'week' : 'day'}, ${points.length} ${unit}, ${rangeLabel(range)}`} style={{ display: 'block', cursor: h && h.p.posts.length ? 'pointer' : 'default' }}>
              <defs>
                <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={CHART.blue} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={CHART.blue} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={PAD.left + innerW} y1={yOf(t)} y2={yOf(t)} stroke={CHART.track} strokeWidth={1} strokeDasharray={t ? '2 3' : undefined} />
                  {t ? <text x={width - 6} y={yOf(t) + 4} textAnchor="end" fontSize={11} fill={COLORS.muted}>{shortNum(t)}</text> : null}
                </g>
              ))}
              {dateTicks.map(({ iso, x, k }) => (
                <text key={iso} x={x} y={H - 6} textAnchor={k === 0 ? 'start' : k === labelCount ? 'end' : 'middle'} fontSize={11} fill={COLORS.muted}>{dateLabel(iso)}</text>
              ))}
              <path d={area} fill={`url(#${gradId})`} />
              {med !== null ? (
                <>
                  <line x1={PAD.left} x2={PAD.left + innerW} y1={medY} y2={medY} stroke={COLORS.faint} strokeWidth={1} strokeDasharray="4 4" />
                  <text x={PAD.left + innerW - 2} y={medY - 4} textAnchor="end" fontSize={11} fill={COLORS.muted}>median {shortNum(med)} per post {weekly ? 'week' : 'day'}</text>
                </>
              ) : null}
              <path d={line} fill="none" stroke={CHART.blue} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={last.x} cy={last.y} r={3.5} fill={COLORS.paper} stroke={CHART.blue} strokeWidth={1.5} />
              {h ? (
                <>
                  <line x1={h.x} x2={h.x} y1={PAD.top} y2={base} stroke={COLORS.faint} strokeWidth={1} />
                  <circle cx={h.x} cy={h.y} r={4.5} fill={COLORS.paper} stroke={CHART.blue} strokeWidth={2} />
                </>
              ) : null}
            </svg>
          ) : <div style={{ height: H }} />}
          {h ? (
            <div style={{ position: 'absolute', top: h.y < H / 2 ? h.y + 14 : Math.max(0, h.y - 110), left: tipLeft, width: 240, pointerEvents: 'none', background: COLORS.paper, border: `1px solid ${COLORS.hairline}`, borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.08)', padding: '8px 10px', fontSize: 12, color: COLORS.ink, lineHeight: 1.45 }}>
              <div style={{ color: COLORS.muted }}>{weekly ? `Week of ${monthDayYear(h.p.date)}` : shortDate(h.p.date)}{h.p.posts.length > 1 ? ` · ${h.p.posts.length} posts` : ''}</div>
              {!h.p.posts.length ? <div style={{ fontWeight: 600 }}>No posts</div> : null}
              {h.p.posts.length ? <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{num(h.p.value)} {m.label.toLowerCase()}</div> : null}
              {h.p.posts.length ? <div style={{ color: COLORS.muted, fontVariantNumeric: 'tabular-nums' }}>{num(sum(h.p.posts, 'views'))} views · {num(sum(h.p.posts, 'likes'))} likes · {num(sum(h.p.posts, 'saves'))} saves · {num(sum(h.p.posts, 'shares'))} shares</div> : null}
              {h.p.posts.length === 1 && h.p.posts[0].hook_summary ? <div style={{ marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>"{h.p.posts[0].hook_summary}"</div> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
