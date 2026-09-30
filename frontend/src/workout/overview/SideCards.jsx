import React from 'react';
import Icon from '../icons';
import { groupOf } from '../muscles';
import { e1rmText, fmtVolume, monthDay, nameOf } from '../ptParts';
import { templateHeader } from '../art';
import { COLORS } from '../../shared/styles';
import { W, glassCard, iconDisc } from '../theme';

// The Overview's right column: Last session (with the app's art), Highlights (new records in the
// range, else the streak and the count), and two small cards, Volume (area over the gym sessions)
// and Balance (the top three groups' shares as pies).

const shortDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const title = { fontSize: 16, fontWeight: 600 };
const sub = { fontSize: 12, color: COLORS.muted };
const big = { fontSize: 26, fontWeight: 500, letterSpacing: -1, fontVariantNumeric: 'tabular-nums', lineHeight: 1.05, marginTop: 8 };
const unitStyle = { fontSize: 12, color: COLORS.muted, fontWeight: 500, letterSpacing: 0, marginLeft: 3 };

export function LastSessionCard({ session, unit }) {
  if (!session) {
    return (
      <div style={glassCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={iconDisc()}><Icon name="dumbbell" size={17} /></span><span style={title}>Last session</span></div>
        <div style={{ ...sub, marginTop: 10 }}>No workouts in this range.</div>
      </div>
    );
  }
  const art = session.kind === 'gym' ? templateHeader(session.title) : null;
  const name = session.title || session.focus || 'Workout';
  return (
    <div style={glassCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={iconDisc()}><Icon name={session.kind === 'gym' ? 'dumbbell' : 'home'} size={17} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={sub}>Last session · {shortDay(session.date)}</div>
          <div style={title}>{name}</div>
        </div>
      </div>
      {art ? (
        <div role="img" aria-label={`${name} art from the Home Workouts app`} style={{ height: 112, borderRadius: 16, background: `url(${art}) center / cover`, marginTop: 12 }} />
      ) : (
        <div style={{ height: 112, borderRadius: 16, marginTop: 12, background: W.blueWash, color: W.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontWeight: 600 }}>
          <Icon name={session.kind === 'gym' ? 'dumbbell' : 'home'} size={26} />{session.kind === 'gym' ? 'Gym' : 'Home'} workout
        </div>
      )}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontSize: 13 }}>
        {session.duration_s ? <span><b>{Math.round(session.duration_s / 60)}</b> min</span> : null}
        {session.total_weight_kg ? <span><b>{fmtVolume(session.total_weight_kg, unit)}</b> {unit}</span> : null}
        {session.calories ? <span><b>{session.calories}</b> kcal</span> : null}
        {session.exercise_count ? <span><b>{session.exercise_count}</b> exercises</span> : null}
      </div>
    </div>
  );
}

const tile = (bg, fg) => ({ borderRadius: 20, padding: 14, minHeight: 104, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8, background: bg, color: fg, minWidth: 0 });
const tileIcon = { width: 30, height: 30, borderRadius: '50%', background: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };

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
      <div style={{ ...title, margin: '0 0 10px 4px' }}>Highlights</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
        {tiles.map((t) => (
          <div key={t.key} style={tile(t.colors[0], t.colors[1])}>
            <span style={tileIcon}><Icon name={t.icon} size={15} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12 }}>{t.label}</div>
              <div style={{ fontSize: records.length ? 15 : 19, fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{t.value}</div>
              <div style={{ fontSize: 11 }}>{t.sub}</div>
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
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
