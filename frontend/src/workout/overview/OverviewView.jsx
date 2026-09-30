import React, { useLayoutEffect, useRef, useState } from 'react';
import Icon from '../icons';
import BodyViewer from './BodyViewer';
import DayStrip from './DayStrip';
import { Highlights, LastSessionCard, MiniCards } from './SideCards';
import { longestStreak, muscleShares, recordsInRange, sessionLengths, shiftDay, stripDays, topExercises } from './select';
import { inRange, toUnit } from '../strength';
import { muscleVolume } from '../muscles';
import { monthDay } from '../ptParts';
import { templateForSession } from '../art';
import TemplateBanner from '../TemplateBanner';
import { num } from '../../shared/format';
import { COLORS } from '../../shared/styles';
import { W, glassCard, hatch, iconDisc, statPill } from '../theme';

// The Overview view (picked by the user on 2026-09-29 from two mockups; artifact
// https://claude.ai/artifact/EgVG5xnUgNbrvZ12DAvUEG, option A):
//   left    profile card (the last gym workout's app art, stat pills, the date, three counts) and
//           the Session length card (avg, range, one bar per session, the longest hatched)
//   centre  BodyFigure: muscles trained in the range, a popover per group
//   right   Last session, Highlights, Volume + Balance
//   bottom  DayStrip across the full width
// Three columns from 1060px of content width, two from 660px (the right column wraps under),
// one below that. Every number comes from the range's sessions or the gym sessions with sets.
const MAX_BARS = 40;

function useWidth(ref) {
  const [w, setW] = useState(1200);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function ProfileCard({ date, profile, weightKg, weightDeltaKg, unit, latest, sessions, gymCount, streak, rangeSub }) {
  const banner = templateForSession(latest);
  const d = new Date(`${date}T12:00:00`);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDayLong = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const hours = sessions.reduce((t, s) => t + (s.duration_s || 0), 0) / 3600;
  const delta = weightDeltaKg && Math.abs(toUnit(weightDeltaKg, unit)) >= 0.05 ? toUnit(weightDeltaKg, unit) : 0;
  const sex = profile.is_male === true ? 'Male' : profile.is_male === false ? 'Female' : null;
  const stat = (label, value, subText) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: COLORS.muted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 12, color: COLORS.muted }}>{subText}</div>
    </div>
  );
  return (
    <div style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
      {banner ? (
        // The latest workout's own banner from the app (the Workouts grid art).
        <TemplateBanner name={banner} sub={latest.kind === 'gym' ? undefined : 'Home workout'} radius={0} size={17} />
      ) : <div style={{ height: 104, background: `linear-gradient(135deg, ${W.blueSoft}, ${W.blueWash})` }} />}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 16px', marginTop: 14 }}>
        {sex ? <span style={statPill} title={sex}>{sex === 'Male' ? '♂' : '♀'}</span> : null}
        {weightKg ? (
          <span style={statPill} title={delta ? `${delta > 0 ? '+' : ''}${num(delta, 1)} ${unit} ${rangeSub}` : 'Latest weigh-in'}>
            {num(toUnit(weightKg, unit), 1)}<small style={{ fontSize: 10, color: COLORS.muted, fontWeight: 500 }}>{unit}</small>
            {delta ? <small style={{ fontSize: 10, fontWeight: 600, color: delta > 0 ? COLORS.danger : COLORS.done, marginLeft: 2 }}>{delta > 0 ? '▲' : '▼'}{num(Math.abs(delta), 1)}</small> : null}
          </span>
        ) : null}
        {profile.height_cm ? <span style={statPill}>{num(profile.height_cm / 2.54)}<small style={{ fontSize: 10, color: COLORS.muted, fontWeight: 500 }}>in</small></span> : null}
        {profile.age ? <span style={statPill}>{profile.age}<small style={{ fontSize: 10, color: COLORS.muted, fontWeight: 500 }}>years old</small></span> : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: '16px 20px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.12, letterSpacing: -0.3 }}>{weekday},<br />{monthDayLong}</div>
        {sex ? <span style={{ fontSize: 12, color: COLORS.muted }}>{sex}</span> : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: '12px 8px', padding: '14px 20px 18px' }}>
        {stat('Workouts', sessions.length, `${gymCount} gym · ${sessions.length - gymCount} home`)}
        {stat('Hours', sessions.length ? num(hours, 1) : '-', rangeSub)}
        {stat('Streak', streak.days || '-', streak.days ? `day${streak.days === 1 ? '' : 's'}, longest` : 'no workouts')}
      </div>
    </div>
  );
}

function SessionLengthCard({ sessions, compact }) {
  const { rows: all, avg, min, max } = sessionLengths(sessions);
  const rows = all.slice(-MAX_BARS);
  const peak = rows.length ? rows.reduce((b, r) => (r.min > b.min ? r : b), rows[0]) : null;
  // Label at most five bars (three on a phone), evenly, always including the last.
  const every = Math.max(1, Math.ceil(rows.length / (compact ? 3 : 5)));
  const figure = (label, value) => (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: COLORS.muted }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>{value}<span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500, letterSpacing: 0, marginLeft: 3 }}>min</span></div>
    </div>
  );
  return (
    <div style={glassCard}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={iconDisc()}><Icon name="clock" size={17} /></span>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Session length</span>
      </div>
      {rows.length ? (
        <>
          <div style={{ display: 'flex', gap: 28, marginTop: 14 }}>
            {figure('Avg', Math.round(avg))}
            {figure('Range', min === max ? Math.round(min) : `${Math.round(min)}-${Math.round(max)}`)}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: rows.length > 20 ? 3 : 6, height: 132, marginTop: 38 }}>
            {rows.map((r, i) => {
              const isPeak = r === peak;
              return (
                <div key={`${r.date}-${i}`} title={`${monthDay(r.date)}, ${r.title}: ${Math.round(r.min)} min`} style={{
                  flex: 1, minWidth: 0, position: 'relative', height: `${Math.max(6, (r.min / max) * 100)}%`,
                  borderRadius: '8px 8px 4px 4px', background: isPeak ? hatch('#6D93FA') : W.blueSoft,
                }}>
                  {isPeak ? (
                    <>
                      <span style={{ position: 'absolute', top: -4, left: '50%', width: 8, height: 8, marginLeft: -4, borderRadius: '50%', background: W.blue, border: '2px solid #FFFFFF' }} />
                      <span style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', background: COLORS.ink, color: '#FFFFFF', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{Math.round(r.min)} min</span>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: rows.length > 20 ? 3 : 6, marginTop: 6 }}>
            {rows.map((r, i) => (
              <span key={`${r.date}-${i}`} style={{ flex: 1, minWidth: 0, fontSize: 10, color: COLORS.muted, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible' }}>
                {(rows.length - 1 - i) % every === 0 ? monthDay(r.date) : ''}
              </span>
            ))}
          </div>
          {all.length > rows.length ? <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6 }}>Latest {rows.length} of {all.length} sessions.</div> : null}
        </>
      ) : <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 10 }}>No workouts in this range.</div>}
    </div>
  );
}

export default function OverviewView({ date, profile, weights, sessions, rangeStart, rangeEnd, rangeSub, lifetime, strength, stripSessions, stripStart, stripEnd, onOpenTrainer, muscle, onMuscle }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  const cols = width >= 1060 ? 3 : width >= 660 ? 2 : 1;

  const unit = (strength && strength.weight_unit) || (profile.shows_kg ? 'kg' : 'lb');
  const bodyUnit = profile.shows_kg ? 'kg' : 'lb';
  const allGym = (strength && strength.sessions) || [];
  const gymInRange = inRange(allGym, rangeStart, rangeEnd);
  const strengthById = new Map(allGym.map((s) => [s.id, s]));
  const gymCount = sessions.filter((s) => s.kind === 'gym').length;
  const streak = longestStreak(sessions.map((s) => s.date));

  // Muscles: this range against the same number of days right before it (none for Lifetime).
  const span = Math.round((Date.parse(`${rangeEnd}T12:00:00`) - Date.parse(`${rangeStart}T12:00:00`)) / 86400000) + 1;
  const beforeStart = shiftDay(rangeStart, -span);
  const beforeEnd = shiftDay(rangeStart, -1);
  const beforeGym = lifetime ? [] : inRange(allGym, beforeStart, beforeEnd);
  const now = muscleVolume(gymInRange);
  const before = lifetime ? null : muscleVolume(beforeGym);
  const beforeLabel = span === 1 ? `on ${monthDay(beforeEnd)}` : `in the ${span} days before`;

  // Weight: the latest weigh-in on or before the shown day; change = last minus first inside the range.
  const known = weights.filter((w) => w.kg !== null && w.kg !== undefined && w.date <= rangeEnd);
  const latest = known.length ? known[known.length - 1] : null;
  const inRangeW = known.filter((w) => w.date >= rangeStart);
  const weightDeltaKg = inRangeW.length >= 2 ? inRangeW[inRangeW.length - 1].kg - inRangeW[0].kg : 0;

  const last = sessions.length ? sessions[0] : null; // the API lists newest first
  const gymOldestFirst = [...sessions].filter((s) => s.kind === 'gym' && s.total_weight_kg).reverse();
  const bandStart = [shiftDay(rangeEnd, -6), rangeStart].sort()[1];

  const left = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <ProfileCard date={date} profile={profile} weightKg={latest ? latest.kg : profile.current_weight_kg} weightDeltaKg={weightDeltaKg} unit={bodyUnit}
        latest={last} sessions={sessions} gymCount={gymCount} streak={streak} rangeSub={rangeSub} />
      <SessionLengthCard sessions={sessions} compact={cols === 1} />
    </div>
  );
  const figure = (
    <BodyViewer now={now} before={before} beforeCount={beforeGym.length} beforeLabel={beforeLabel} unit={unit}
      top={topExercises(gymInRange)} onOpenTrainer={onOpenTrainer} compact={cols === 1} />
  );
  const right = (
    <div style={cols === 2
      ? { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, alignItems: 'start' }
      : { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
      <LastSessionCard session={last} unit={unit} />
      <Highlights records={recordsInRange(allGym, rangeStart, rangeEnd)} streak={streak} count={sessions.length} gymCount={gymCount} unit={unit} />
      <MiniCards gymSessions={gymOldestFirst} shares={muscleShares(now)} unit={unit}
        radar={{ now, before, beforeLabel, selected: muscle, onSelect: (m) => onMuscle(muscle === m ? null : m) }} />
    </div>
  );

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
      <div style={{
        display: 'grid', gap: 18, alignItems: 'start',
        gridTemplateColumns: cols === 3 ? 'minmax(250px, 300px) minmax(0, 1fr) minmax(250px, 300px)' : cols === 2 ? 'minmax(250px, 300px) minmax(0, 1fr)' : 'minmax(0, 1fr)',
      }}>
        {left}
        {figure}
        {right}
      </div>
      <DayStrip days={stripDays(stripStart, stripEnd, stripSessions, strengthById)} date={date} bandStart={bandStart} bandEnd={rangeEnd} />
    </div>
  );
}
