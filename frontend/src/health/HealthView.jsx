import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AgendaRail from '../shared/AgendaRail';
import { COLORS, card, navButton } from '../shared/styles';
import { headlineLong, shiftISO } from '../shared/dayInfo';
import { getHealthDay, getHealthStatus, runHealthFetch } from './api';
import { TodayActivity, InFocus, Glance, LastSeven } from './sections';
import { timeOfDay } from './format';
import { useViewDate } from '../shared/today';

// The Health tab: the day's Garmin data from the Health store, never live from Garmin.
// Four sections: Today's Activity, In Focus, At a Glance (the declared card grid), Last
// 7 Days. Two columns and up on wide screens, stacked on narrow ones. The look keeps the
// four sections and components of the dark mobile layout it was specified from, but
// renders in the planner's light Agenda theme; that is intentional, not a regression.

// The line under the headline: what the store knows about its own freshness.
export function statusLine(status) {
  if (!status) return { text: 'Garmin: checking the store', color: COLORS.muted };
  const last = status.last_run;
  if (status.paused) return { text: 'Garmin needs a sign-in code (Settings) before the store can fetch again', color: COLORS.danger };
  if (status.stuck) return { text: `Garmin: a fetch started ${timeOfDay(last.started_at)} has not finished`, color: COLORS.danger };
  if (status.failed_streak >= status.fail_streak_red_at) {
    const code = last && last.errors && last.errors.length ? last.errors[0].code : 'error';
    return { text: `Garmin: ${status.failed_streak} fetches in a row failed (${code}); last try ${timeOfDay(last.started_at)}`, color: COLORS.danger };
  }
  const t = status.today || {};
  const when = t.last_fetched_at ? timeOfDay(t.last_fetched_at) : null;
  const direct = last ? `${last.calls_garmin} direct call${last.calls_garmin === 1 ? '' : 's'} in the last run` : 'no run yet';
  const base = when ? `Garmin: updated ${when} today, ${t.metrics_with_value} of ${t.metrics_declared} metrics, ${direct}` : `Garmin: nothing stored for today yet, ${direct}`;
  const nf = status.never_final || {};
  if (nf.count > 0) return { text: `${base}; ${nf.count} stored day${nf.count === 1 ? '' : 's'} older than ${nf.after_days} days ${nf.count === 1 ? 'is' : 'are'} not final (${nf.days.slice(0, 3).join(', ')}${nf.count > 3 ? ', ...' : ''}), the finalize rule may have stopped firing`, color: COLORS.warn };
  const r = status.rate || {};
  if (r.direct_calls_last_hour > r.red_above_per_hour) return { text: `${base}; ${r.direct_calls_last_hour} Garmin calls in the last hour, over ${r.red_above_per_hour} (3x the measured ${r.measured_safe_per_hour}/h)`, color: COLORS.danger };
  if (status.level === 'warn') return { text: `${base}; ${r.direct_calls_last_hour} Garmin calls in the last hour, over ${r.amber_above_per_hour} (1.5x the measured ${r.measured_safe_per_hour}/h)`, color: COLORS.warn };
  return { text: base, color: COLORS.muted };
}

export default function HealthView() {
  const date = useViewDate();
  const navigate = useNavigate();
  const [day, setDay] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [fetchNote, setFetchNote] = useState(null);

  useEffect(() => {
    let alive = true;
    setDay(null); setError(null);
    getHealthDay(date).then((d) => { if (alive) setDay(d); }).catch((err) => { if (alive) setError(err.message || String(err)); });
    getHealthStatus().then((s) => { if (alive) setStatus(s); }).catch(() => {});
    return () => { alive = false; };
  }, [date]);

  const onFetch = async () => {
    const out = await runHealthFetch();
    setFetchNote(out.status === 202 ? 'Fetch started; the page refreshes in 20 s' : out.status === 429 ? `A fetch ran recently; try again in ${Math.ceil(out.retry_after_seconds / 60)} min` : out.error);
    if (out.status === 202) setTimeout(() => { getHealthDay(date).then(setDay).catch(() => {}); getHealthStatus().then(setStatus).catch(() => {}); setFetchNote(null); }, 20000);
  };

  const arrowStyle = { ...navButton, width: 32, padding: '5px 0', textAlign: 'center', fontSize: 16, lineHeight: 1.2 };
  const dateInputStyle = { background: COLORS.paper, color: COLORS.ink, border: `1px solid ${COLORS.hairline}`, padding: '4px 8px', borderRadius: 8, fontSize: 13, colorScheme: 'light' };
  const line = statusLine(status);
  const finalDays = new Set(Object.entries((day && day.history && day.history.days) || {}).filter(([, m]) => m.steps && m.steps.final).map(([d]) => d));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: COLORS.page }}>
      <AgendaRail dateISO={date} section="health" />
      <main style={{ flex: 1, minWidth: 0, padding: '24px clamp(16px, 3vw, 40px) 48px', maxWidth: 1240 }}>
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.1 }}>{headlineLong(date)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Link to={`/health/${shiftISO(date, -1)}`} style={arrowStyle} title="Previous day">‹</Link>
              <input type="date" value={date} onChange={(e) => { if (e.target.value) navigate(`/health/${e.target.value}`); }} style={dateInputStyle} />
              <Link to={`/health/${shiftISO(date, 1)}`} style={arrowStyle} title="Next day">›</Link>
              <button type="button" onClick={onFetch} style={{ ...navButton, cursor: 'pointer' }} title="Refetch today from Garmin (at most once per 30 minutes)">Fetch now</button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: line.color, marginTop: 8 }}>{line.text}{fetchNote ? <span style={{ color: COLORS.muted }}> · {fetchNote}</span> : null}</div>
        </div>

        {error ? <div style={{ ...card, marginTop: 16, color: COLORS.danger }}>Could not load the Health store: {error}</div> : null}
        {!day && !error ? <div style={{ ...card, marginTop: 16, color: COLORS.muted }}>Loading</div> : null}
        {day ? (
          <>
            <TodayActivity activities={day.activities || []} date={date} />
            <InFocus date={date} history={day.history || {}} finalDays={finalDays} />
            <Glance date={date} metrics={day.metrics || {}} history={day.history || {}} />
            <LastSeven date={date} history={day.history || {}} />
          </>
        ) : null}
      </main>
    </div>
  );
}
