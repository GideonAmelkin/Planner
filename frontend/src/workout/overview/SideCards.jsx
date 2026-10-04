import React from 'react';
import Icon from '../icons';
import { MUSCLE_GROUPS, groupOf } from '../muscles';
import { e1rmText, fmtVolume, monthDay, nameOf } from '../ptParts';
import { COLORS } from '../../shared/styles';
import { W, glassCard, iconDisc } from '../theme';
import BalanceRadar from '../BalanceRadar';

// The Overview's right column: Highlights (new records in the range, else the streak and the count;
// one full-width row each, no heading, since 2026-10-03), the small Volume (area over the gym sessions)
// and Balance (the top three groups' shares as pies) tiles, and the Muscles card. The last session lives in the profile card now
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
const tileIcon = { flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };

export function Highlights({ records, streak, count, gymCount, unit }) {
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
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 10 }}>
        {tiles.map((t) => (
          <div key={t.key} style={tile(t.colors[0], t.colors[1])}>
            <span style={tileIcon}><Icon name={t.icon} size={15} /></span>
            <div style={{ minWidth: 0, flex: 1 }} title={`${t.value}: ${t.sub}`}>
              <div style={{ fontSize: 12, ...oneLine }}>{t.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25, ...oneLine }}>{t.value}</div>
              <div style={{ fontSize: 11, ...oneLine }}>{t.sub}</div>
            </div>
          </div>
        ))}
      </div>
      {records.length ? null : <div style={{ ...sub, margin: '8px 4px 0' }}>Record tiles show here when an exercise beats an earlier session; none has in this range.</div>}
    </div>
  );
}

function Pie({ share, color }) {
  const a = share * 2 * Math.PI;
  const x = 18 + 16 * Math.sin(a);
  const y = 18 - 16 * Math.cos(a);
  return (
    <svg viewBox="0 0 36 36" width="40" height="40" aria-hidden="true">
      <circle cx="18" cy="18" r="16" fill="#EEF1F7" />
      {share >= 0.999 ? <circle cx="18" cy="18" r="16" fill={color} />
        : <path d={`M18 18 L18 2 A16 16 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`} fill={color} />}
    </svg>
  );
}

const miniHead = (icon, text) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={iconDisc(28)}><Icon name={icon} size={14} /></span>
    <span style={{ fontWeight: 600, fontSize: 13 }}>{text}</span>
  </div>
);

export function MiniCards({ gymSessions, shares, unit }) {
  // Volume: one point per gym session, oldest first (the export's total_weight_kg).
  const pts = gymSessions.map((s) => s.total_weight_kg || 0);
  let chart = null;
  if (pts.length >= 2) {
    const lo = Math.min(...pts) * 0.85;
    const hi = Math.max(...pts) * 1.05;
    const X = (i) => 4 + (i * 112) / (pts.length - 1);
    const Y = (v) => 52 - ((v - lo) / (hi - lo || 1)) * 44;
    const line = pts.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
    chart = (
      <svg viewBox="0 0 120 60" width="100%" height="56" preserveAspectRatio="none" role="img" aria-label="Volume per gym session" style={{ display: 'block' }}>
        <defs><linearGradient id="wkVolArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={W.blue} stopOpacity=".45" /><stop offset="1" stopColor={W.green} stopOpacity=".05" /></linearGradient></defs>
        <path d={`${line} L${X(pts.length - 1)} 60 L4 60 Z`} fill="url(#wkVolArea)" />
        <path d={line} fill="none" stroke={W.blue} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const top3 = shares.slice(0, 3);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gridAutoRows: '1fr', gap: 10 }}>
      <div style={{ ...glassCard, padding: 14 }}>
        {miniHead('dumbbell', 'Volume')}
        {pts.length ? (
          <>
            <div style={big}>{fmtVolume(pts[pts.length - 1], unit)}<span style={unitStyle}>{unit}</span></div>
            {chart}
            <div style={sub}>{pts.length === 1 ? 'latest gym session' : `latest of ${pts.length} gym sessions`}</div>
          </>
        ) : <div style={{ ...sub, marginTop: 10 }}>No gym sessions in this range.</div>}
      </div>
      <div style={{ ...glassCard, padding: 14 }}>
        {miniHead('pie', 'Balance')}
        {top3.length ? (
          <>
            <div style={big}>{Math.round(top3[0].share * 100)}<span style={unitStyle}>% {groupOf(top3[0].key).label.toLowerCase()}</span></div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
              {top3.map((s) => (
                <div key={s.key} style={{ textAlign: 'center', fontSize: 10, color: COLORS.muted }} title={`${groupOf(s.key).label}: ${Math.round(s.share * 100)}%`}>
                  <Pie share={s.share} color={groupOf(s.key).color} /><br />{groupOf(s.key).label}
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
// Trainer's chart and ticker follow). Its own card since 2026-10-03, the size of the Session length card
// (`height`, measured by OverviewView; null where the layout has no card beside it to match).
export function MusclesCard({ now, before, beforeLabel, selected, onSelect, height, style }) {
  const count = MUSCLE_GROUPS.filter((g) => (now[g.key] || 0) > 0).length;
  return (
    <div style={{ ...glassCard, height: height || undefined, display: 'flex', flexDirection: 'column', minHeight: 0, ...style }} title={before ? `Filled: this range. Dashed: ${beforeLabel.replace(/^(in|on) /, '')}.` : 'This range'}>
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
