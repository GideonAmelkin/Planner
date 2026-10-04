import React from 'react';
import Icon from '../icons';
import { MUSCLE_GROUPS, groupOf } from '../muscles';
import { e1rmText, fmtVolume, monthDay, nameOf } from '../ptParts';
import { COLORS } from '../../shared/styles';
import { W, glassCard, iconDisc } from '../theme';
import BalanceRadar from '../BalanceRadar';

// The Overview's right column: Highlights (new records in the range, else the streak and the count;
// one full-width row each, no heading, since 2026-10-03), the small Volume (the range's total against the window before)
// and Balance (the top group's share, one bar split by the top three, a legend) tiles, and the Muscles card. The last session lives in the profile card now
// (SessionStats below), so this column ends above the Session length card's bottom.

const sub = { fontSize: 12, color: COLORS.muted };
const big = { fontSize: 26, fontWeight: 500, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, marginTop: 8 };
const unitStyle = { fontSize: 12, color: COLORS.muted, fontWeight: 500, letterSpacing: 0, marginLeft: 3 };

// The last session's numbers in one row (the profile card shows them under the workout's banner).
export function SessionStats({ session, unit }) {
  return (
    <div style={{ display: 'flex', gap: '4px 14px', flexWrap: 'wrap', fontSize: 13 }}>
      {session.duration_s ? <span><b>{Math.round(session.duration_s / 60)}</b> min</span> : null}
      {session.total_weight_kg ? <span><b>{fmtVolume(session.total_weight_kg, unit)}</b> {unit}</span> : null}
      {session.calories ? <span><b>{session.calories}</b> kcal</span> : null}
      {session.exercise_count ? <span><b>{session.exercise_count}</b> exercises</span> : null}
    </div>
  );
}

export const shortDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// One row per tile (the user's call, 2026-10-03: yellow on one line, blue on the line below).
const tile = (bg, fg) => ({ borderRadius: 18, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, background: bg, color: fg, minWidth: 0 });
const oneLine = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
// Taller rows (filling the column, 2026-10-03) have room for a name over two lines.
const twoLines = { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere' };
const tileIcon = { flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };

// `fill`: the two rows split the height the parent gives them (the Overview's right column at three
// columns, so Volume + Balance sit right above the Muscles card).
export function Highlights({ records, streak, count, gymCount, unit, fill = false }) {
  const colors = [[W.yellowTile, W.yellowInk], [W.blueTile, W.blueInk]];
  const tiles = records.length
    ? records.slice(0, 2).map((r, i) => ({
      key: `${r.action_id}-${r.date}`, icon: 'trophy', label: `New record · ${monthDay(r.date)}`,
      value: nameOf(r), sub: r.point.e1rm_kg ? `${r.kinds.join(', ')} · e1RM ${e1rmText(r.point.e1rm_kg, unit)} ${unit}` : r.kinds.join(', '), colors: colors[i],
    }))
    : [
      { key: 'streak', icon: 'bolt', label: 'Longest streak', value: streak.days ? `${streak.days} day${streak.days === 1 ? '' : 's'}` : '-', sub: streak.days > 1 ? `${monthDay(streak.start)} to ${monthDay(streak.end)}` : streak.days ? monthDay(streak.start) : 'no workouts', colors: colors[0] },
      { key: 'count', icon: 'trophy', label: 'Workouts', value: String(count), sub: `${gymCount} gym · ${count - gymCount} home`, colors: colors[1] },
    ];
  return (
    <div style={fill ? { height: '100%', display: 'flex', flexDirection: 'column' } : undefined}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10, ...(fill ? { flex: 1, gridTemplateRows: '1fr 1fr' } : null) }}>
        {tiles.map((t) => (
          <div key={t.key} style={tile(t.colors[0], t.colors[1])}>
            <span style={tileIcon}><Icon name={t.icon} size={15} /></span>
            <div style={{ minWidth: 0, flex: 1 }} title={`${t.value}: ${t.sub}`}>
              <div style={{ fontSize: 12, ...oneLine }}>{t.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25, ...(fill ? twoLines : oneLine) }}>{t.value}</div>
              <div style={{ fontSize: 11, ...(fill ? twoLines : oneLine) }}>{t.sub}</div>
            </div>
          </div>
        ))}
      </div>
      {records.length ? null : <div style={{ ...sub, margin: '8px 4px 0' }}>Record tiles show here when an exercise beats an earlier session; none has in this range.</div>}
    </div>
  );
}

// Balance (the user's pick, 2026-10-03, option 1 of five): the top group's share as the headline, one 100% bar
// split by the top three groups (the rest grey) so they read as parts of one whole, and a legend with each share.
const TRACK = '#E6E9F2';
function ShareBar({ shares }) {
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: TRACK, marginTop: 10 }} aria-hidden="true">
      {shares.map((s, i) => (
        <span key={s.key} style={{ width: `${s.share * 100}%`, background: groupOf(s.key).color, boxShadow: i ? '-1.5px 0 0 #FFFFFF' : 'none' }} />
      ))}
    </div>
  );
}

const miniHead = (icon, text) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={iconDisc(28)}><Icon name={icon} size={14} /></span>
    <span style={{ fontWeight: 600, fontSize: 13 }}>{text}</span>
  </div>
);

// Volume (the user's pick, 2026-10-04, option 4 of five plus option 1's clean-ups): the range's total pounds
// as the headline, a chip with the change against the same-length window right before it (none for
// Lifetime, like the radar), and a line per window from a zero baseline: this range solid with a dot on
// its last session, the window before dashed behind it, each session placed by its day in its window.
// 10,267 -> 10.3k so the caption fits a 145px tile on one line.
const shortVolume = (kg, unit) => { const v = Number(fmtVolume(kg, unit).replace(/,/g, '')); return Number.isFinite(v) && v >= 1000 ? `${(v / 1000).toFixed(1)}k` : fmtVolume(kg, unit); };
const dayIndex = (from, d) => Math.round((Date.parse(`${d}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86400000);
export function MiniCards({ gymSessions, beforeSessions, rangeStart, beforeStart, span, shares, unit }) {
  const kg = (s) => s.total_weight_kg || 0;
  const pts = gymSessions.map((s) => ({ i: dayIndex(rangeStart, s.date), v: kg(s) }));
  const prior = beforeSessions ? beforeSessions.filter((s) => kg(s) > 0).map((s) => ({ i: dayIndex(beforeStart, s.date), v: kg(s) })).sort((a, b) => a.i - b.i) : null;
  const total = pts.reduce((t, p) => t + p.v, 0);
  const priorTotal = prior ? prior.reduce((t, p) => t + p.v, 0) : 0;
  const change = prior && priorTotal > 0 ? Math.round(((total - priorTotal) / priorTotal) * 100) : null;
  const priorName = span === 1 ? 'day before' : `prior ${span}d`;

  let chart = null;
  if (pts.length) {
    const hi = Math.max(...pts.map((p) => p.v), ...(prior || []).map((p) => p.v)) * 1.1 || 1;
    const X = (i) => 4 + (Math.min(span - 1, Math.max(0, i)) * 112) / Math.max(1, span - 1);
    const Y = (v) => 56 - (v / hi) * 50;
    const path = (list) => list.map((p, n) => `${n ? 'L' : 'M'}${X(p.i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(' ');
    const lastPt = pts[pts.length - 1];
    chart = (
      <div style={{ position: 'relative', marginTop: 8 }}>
        <svg viewBox="0 0 120 60" width="100%" height="56" preserveAspectRatio="none" role="img" aria-label="Volume per gym session, this range and the window before" style={{ display: 'block' }}>
          <defs><linearGradient id="wkVolArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={W.blue} stopOpacity=".35" /><stop offset="1" stopColor={W.blue} stopOpacity=".03" /></linearGradient></defs>
          <line x1="4" x2="116" y1="56" y2="56" stroke={TRACK} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {prior && prior.length >= 2 ? <path d={path(prior)} fill="none" stroke="#9AA3B5" strokeWidth="1.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" /> : null}
          {pts.length >= 2 ? <path d={`${path(pts)} L${X(lastPt.i).toFixed(1)} 56 L${X(pts[0].i).toFixed(1)} 56 Z`} fill="url(#wkVolArea)" /> : null}
          {pts.length >= 2 ? <path d={path(pts)} fill="none" stroke={W.blue} strokeWidth="2" vectorEffect="non-scaling-stroke" /> : null}
        </svg>
        {/* The end dot as HTML so it stays round in the stretched viewBox. */}
        <span style={{ position: 'absolute', left: `${(X(lastPt.i) / 120) * 100}%`, top: `${(Y(lastPt.v) / 60) * 100}%`, width: 8, height: 8, borderRadius: '50%', background: W.blue, border: '2px solid #FFFFFF', transform: 'translate(-50%, -50%)', boxShadow: '0 1px 3px rgba(30,50,110,.3)' }}
          title={`Last session: ${fmtVolume(lastPt.v, unit)} ${unit}`} />
      </div>
    );
  }
  const top3 = shares.slice(0, 3);
  const oneLine = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gridAutoRows: '1fr', gap: 10 }}>
      <div style={{ ...glassCard, padding: 14, minWidth: 0 }}>
        {miniHead('dumbbell', 'Volume')}
        {pts.length ? (
          <>
            <div style={big}>{fmtVolume(total, unit)}<span style={unitStyle}>{unit}</span></div>
            {change !== null ? (
              <div style={{ ...oneLine, fontSize: 11, marginTop: 4, color: COLORS.muted }} title={`${fmtVolume(priorTotal, unit)} ${unit} in the ${span} days before`}>
                <b style={{ color: change > 0 ? W.green : COLORS.muted, fontWeight: 600 }}>{change > 0 ? '+' : ''}{change}%</b> vs {priorName}
              </div>
            ) : null}
            {chart}
            <div style={{ ...sub, ...oneLine, fontSize: 11, marginTop: 6 }}>{pts.length} session{pts.length === 1 ? '' : 's'}, avg {shortVolume(total / pts.length, unit)}</div>
          </>
        ) : <div style={{ ...sub, marginTop: 10 }}>No gym sessions in this range.</div>}
      </div>
      <div style={{ ...glassCard, padding: 14 }}>
        {miniHead('pie', 'Balance')}
        {top3.length ? (
          <>
            <div style={big}>{Math.round(top3[0].share * 100)}%<span style={unitStyle}>{groupOf(top3[0].key).label.toLowerCase()}</span></div>
            <ShareBar shares={top3} />
            <div style={{ display: 'grid', gap: 3, marginTop: 10, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
              {top3.map((s) => (
                <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={`${groupOf(s.key).label}: ${Math.round(s.share * 100)}% of the volume lifted`}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: groupOf(s.key).color, flexShrink: 0 }} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupOf(s.key).label}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{Math.round(s.share * 100)}%</span>
                </div>
              ))}
            </div>
          </>
        ) : <div style={{ ...sub, marginTop: 10 }}>No gym sessions in this range.</div>}
      </div>
    </div>
  );
}

// Muscles: how many of the nine groups the range trained and the labelled radar (this range filled, the
// same-length window before dashed, none for Lifetime); a group's label selects it for the page (the
// Trainer's chart and ticker follow). Its own card since 2026-10-03; at three columns it shares a grid row
// with the Session length card, which makes the two the same size.
export function MusclesCard({ now, before, beforeLabel, selected, onSelect }) {
  const count = MUSCLE_GROUPS.filter((g) => (now[g.key] || 0) > 0).length;
  return (
    <div style={{ ...glassCard, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }} title={before ? `Filled: this range. Dashed: ${beforeLabel.replace(/^(in|on) /, '')}.` : 'This range'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={iconDisc()}><Icon name="radar" size={17} /></span>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Muscles</span>
      </div>
      {count ? (
        <>
          <div style={big}>{count}<span style={unitStyle}>of {MUSCLE_GROUPS.length} groups</span></div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
            <div style={{ width: '100%' }}><BalanceRadar now={now} before={before} selected={selected} onSelect={onSelect} /></div>
          </div>
        </>
      ) : <div style={{ ...sub, marginTop: 10 }}>No gym sessions in this range.</div>}
    </div>
  );
}
