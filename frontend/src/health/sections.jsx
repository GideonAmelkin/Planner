import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Glyph from '../shared/Glyph';
import { RouteTrace, WeekBars, DotStrip, CHART } from '../shared/charts';
import { COLORS, card } from '../shared/styles';
import HealthCard from './HealthCard';
import { CARDS } from './cards';
import { miles, clockDuration, pacePerMile, dayLetter, lastDays, weekOf, rangeLabel, intNum } from './format';

const heading = { fontSize: 20, fontWeight: 600, letterSpacing: -0.3, margin: '26px 0 12px' };
const mutedLine = { fontSize: 13, color: COLORS.muted };

const isRun = (t) => /run/i.test(t || '');
const isWalk = (t) => /walk|hik/i.test(t || '');
const isStrength = (t) => /strength/i.test(t || '');
const glyphFor = (t) => (isRun(t) ? 'run' : isWalk(t) ? 'walk' : isStrength(t) ? 'strength' : 'activity');
const colorFor = (t) => (isRun(t) || isStrength(t) ? CHART.orange : isWalk(t) ? CHART.green : CHART.blue);

// 1. One card per activity recorded on the day.
export function TodayActivity({ activities, date }) {
  return (
    <>
      <div style={heading}>Today's Activity</div>
      {activities.length === 0 ? <div style={{ ...card, ...mutedLine }}>No activities recorded on this day.</div> : null}
      <div style={{ display: 'grid', gap: 12 }}>
        {activities.map((a) => {
          const run = isRun(a.type);
          const primary = run ? `${miles(a.distance_m)} mi` : clockDuration(a.duration_s);
          const facts = run
            ? [clockDuration(a.duration_s), a.duration_s && a.distance_m ? pacePerMile(a.distance_m / a.duration_s) : null]
            : [a.sets !== null && a.sets !== undefined ? `${a.sets} ${a.sets === 1 ? 'Set' : 'Sets'}` : null, a.calories !== null && a.calories !== undefined ? `${intNum(a.calories)} Calories` : null, a.avg_hr ? `${a.avg_hr} bpm avg` : null];
          const trace = run && a.polyline ? JSON.parse(a.polyline) : null;
          return (
            <Link key={a.activity_id} to={`/garmin/${date}/activity/${a.activity_id}`} style={{ ...card, textDecoration: 'none', color: COLORS.ink, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, marginBottom: 8 }}>{a.name || a.type}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 52, height: 52, borderRadius: '50%', background: colorFor(a.type), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Glyph name={glyphFor(a.type)} color="white" size={26} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{primary || '--'}</div>
                    <div style={{ ...mutedLine, marginTop: 4 }}>{facts.filter(Boolean).join(' • ')}</div>
                  </div>
                </div>
              </div>
              {trace ? <RouteTrace points={trace} width={110} height={80} /> : null}
            </Link>
          );
        })}
      </div>
    </>
  );
}

// 2. All activities this week: total time, seven bars, four weeks of dots.
export function InFocus({ date, history, finalDays }) {
  const week = weekOf(date);
  const acts = history.activities || [];
  const perDay = (d) => acts.filter((a) => a.date === d).reduce((t, a) => t + (a.duration_s || 0), 0);
  const total = week.reduce((t, d) => t + (d <= date ? perDay(d) : 0), 0);
  const days = week.map((d) => ({ letter: dayLetter(d), value: d <= date ? perDay(d) : 0, current: d === date, hollow: d < date && !finalDays.has(d), title: d }));
  const dots28 = lastDays(date, 28);
  const covered = dots28.filter((d) => d === date || finalDays.has(d)).length;
  const dotValues = dots28.map((d) => (d === date || finalDays.has(d) ? perDay(d) : null));
  return (
    <>
      <div style={heading}>In Focus</div>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Glyph name="fitness" color={CHART.red} size={18} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>All Activities</span>
          <span style={mutedLine}>• {rangeLabel(week[0], week[6])}</span>
        </div>
        <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', margin: '4px 0 18px' }}>{clockDuration(total) || '0:00'}</div>
        <WeekBars days={days} color={CHART.blue} height={120} />
        <div style={{ borderTop: `1px solid ${COLORS.hairline}`, margin: '16px 0 12px' }} />
        {covered >= 28 ? (
          <DotStrip values={dotValues} currentIndex={27} accent={COLORS.accent} />
        ) : (
          <div style={{ ...mutedLine, height: 14 }}>{`Last 4 weeks: ${covered} of 28 days stored; the strip draws once history covers them.`}</div>
        )}
        <div style={{ ...mutedLine, marginTop: 8 }}>Last 4w</div>
      </div>
    </>
  );
}

// Four cards across above 1100px of viewport, two below; the card anatomy and order
// never change with the width.
const WIDE_QUERY = '(min-width: 1100px)';
function useWide() {
  const [wide, setWide] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(WIDE_QUERY).matches : true));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = (e) => setWide(e.matches);
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange); };
  }, []);
  return wide;
}

// 3. The card grid, from the declared array.
export function Glance({ date, metrics, history }) {
  const wide = useWide();
  const days = history.days || {};
  const ctx = {
    date,
    last7: (metric) => lastDays(date, 7).map((d) => ({ date: d, value: (days[d] && days[d][metric] && days[d][metric].value) || null, final: !!(days[d] && days[d][metric] && days[d][metric].final) })),
    readingDate: (ms) => (ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : date),
  };
  return (
    <>
      <div style={heading}>At a Glance</div>
      <div className="health-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${wide ? 4 : 2}, minmax(0, 1fr))`, gap: 12 }}>
        {CARDS.map((spec) => <HealthCard key={spec.key} spec={spec} row={metrics[spec.metric]} ctx={ctx} />)}
      </div>
    </>
  );
}

// 4. The seven-day list.
export function LastSeven({ date, history }) {
  const dates = lastDays(date, 7);
  const days = history.days || {};
  const acts = (history.activities || []).filter((a) => dates.includes(a.date));
  const workouts = acts.filter((a) => !isRun(a.type) && !isWalk(a.type));
  const runs = acts.filter((a) => isRun(a.type));
  const avg = (metric, pick) => {
    const vals = dates.map((d) => { const v = days[d] && days[d][metric] && days[d][metric].value; return v ? pick(v) : null; }).filter((x) => typeof x === 'number');
    return vals.length ? { value: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length } : null;
  };
  const steps = avg('steps', (v) => v.value);
  const rhr = avg('heart_rate', (v) => v.resting);
  const cal = avg('calories', (v) => v.total);
  const rows = [
    { glyph: 'strength', color: CHART.orange, label: `${workouts.length} ${workouts.length === 1 ? 'Workout' : 'Workouts'}`, value: workouts.length ? clockDuration(workouts.reduce((t, a) => t + (a.duration_s || 0), 0)) : '--' },
    { glyph: 'run', color: CHART.orange, label: `${runs.length} ${runs.length === 1 ? 'Run' : 'Runs'}`, value: runs.length ? `${miles(runs.reduce((t, a) => t + (a.distance_m || 0), 0), 1)} mi` : '--' },
    { glyph: 'steps', color: CHART.blue, label: 'Steps', value: steps ? `${intNum(steps.value)} Avg` : '--', n: steps && steps.n },
    { glyph: 'heart', color: CHART.red, label: 'Heart Rate', value: rhr ? `${Math.round(rhr.value)} Avg Resting` : '--', n: rhr && rhr.n },
    { glyph: 'calories', color: CHART.green, label: 'Calories Burned', value: cal ? `${intNum(cal.value)} Avg` : '--', n: cal && cal.n },
  ];
  return (
    <>
      <div style={heading}>Last 7 Days</div>
      <div style={{ ...card, padding: 0 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderTop: i ? `1px solid ${COLORS.hairline}` : 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, fontWeight: 600 }}><Glyph name={r.glyph} color={r.color} size={20} />{r.label}</span>
            <span style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{r.value}{r.n && r.n < 7 ? <span style={{ ...mutedLine, marginLeft: 6 }}>of {r.n} days</span> : null}</span>
          </div>
        ))}
      </div>
    </>
  );
}
