import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import GarminCard from './GarminCard';
import GarminIcon from './GarminIcon';
import AutoData from './AutoData';
import { garminBatch, callGarmin } from './api';
import { shiftISO, todayISO, longDate } from '../shared/dayInfo';
import { RANGES, rangeDays, garminUrl } from './nav';
import { G, card, cardBody, column, chevronButton, footerLink, summaryHeader } from './theme';
import PAGE_COMPONENTS from './pages';

const ICON_FOR = {
  'Health Stats': 'heart', Activities: 'activity', Nutrition: 'nutrition', 'Performance Stats': 'performance',
  'Training & Planning': 'planning', Gear: 'gear', Reports: 'reports', Achievements: 'badges', Home: 'home',
  Social: 'friends', Insights: 'insights', Info: 'info',
};
const shortDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Garmin's sub-page header: big thin title, then ‹ › + a gray date pill and the
// 1 Day / 7 Days / 4 Weeks / 1 Year control when the page supports ranges.
export const hasBespoke = (slug) => !!PAGE_COMPONENTS[slug];

export function MetricHeader({ page, slug, dateISO, range, setRange, narrow }) {
  const ranges = page.ranges || [];
  const to = (d) => `/health/${d}/${slug}`;
  const seg = (active) => ({
    padding: '5px 18px', fontSize: 12, fontWeight: active ? 600 : 400, color: active ? G.text : G.muted,
    background: active ? 'white' : 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: G.font,
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
  });
  return (
    <div style={{ ...summaryHeader, flexDirection: 'column', alignItems: 'stretch', gap: 14, padding: narrow ? '16px 16px 12px' : '22px 30px 14px' }}>
      <div style={{ fontSize: 32, fontWeight: 300, lineHeight: 1.1 }}>{page.title}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link to={to(shiftISO(dateISO, -1))} style={{ ...chevronButton, border: `1px solid ${G.faint}`, borderRadius: '50%', width: 30, height: 30, justifyContent: 'center', padding: 0 }} aria-label="Previous">‹</Link>
          <Link to={to(shiftISO(dateISO, 1))} style={{ ...chevronButton, border: `1px solid ${G.faint}`, borderRadius: '50%', width: 30, height: 30, justifyContent: 'center', padding: 0 }} aria-label="Next">›</Link>
          <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, background: G.border, borderRadius: 4, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} title={longDate(dateISO)}>
            <GarminIcon name="calendar" color={G.text} size={14} /> {shortDate(dateISO)}
            <input type="date" value={dateISO} onChange={(e) => { if (e.target.value) window.location.assign(to(e.target.value)); }} aria-label="Date" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
          </label>
          {dateISO !== todayISO() ? <Link to={to(todayISO())} style={{ fontSize: 12, color: G.blue, marginLeft: 6 }}>Today</Link> : null}
        </div>
        {ranges.length ? (
          <div style={{ display: 'flex', background: G.border, borderRadius: 4, padding: 2 }}>
            {RANGES.filter((r) => ranges.includes(r.key)).map((r) => (
              <button key={r.key} type="button" onClick={() => setRange(r.key)} style={seg(range === r.key)}>{r.label}</button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// One sub-page: runs the page's registry calls and shows a card per call.
export default function MetricPage({ page, slug, dateISO, range, setRange, connected, refreshToken, activityId = null, syncedAt = null, profile = null }) {
  const Bespoke = PAGE_COMPONENTS[slug] || null;
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!!page.calls);
  const icon = ICON_FOR[page.group] || 'chart';
  const href = garminUrl(page, dateISO);

  const seq = useRef(0);
  const load = useCallback(async (refresh = false) => {
    if (!page.calls) return;
    const mine = ++seq.current;   // a later load supersedes this one
    setLoading(true);
    setError(null);
    try {
      let profileId = null;
      if (page.prelude && page.prelude.includes('get_user_profile')) {
        const prof = await callGarmin('get_user_profile');
        profileId = prof && prof.ok && prof.data ? prof.data.id : null;
      }
      const end = dateISO;
      const start = shiftISO(dateISO, -rangeDays(range));
      const calls = page.calls({ date: dateISO, start, end, range, profileId, id: activityId });
      if (!calls.length) { if (mine === seq.current) setResults({}); return; }
      const out = await garminBatch(calls, { refresh });
      if (mine === seq.current) setResults(out.results || {});
    } catch (err) {
      if (mine === seq.current) setError(err.message || String(err));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [page, dateISO, range, activityId]);

  useEffect(() => { setResults(null); load(refreshToken > 0); }, [load, refreshToken]);

  if (!page.calls) {
    return (
      <div style={column}>
        <section style={card}>
          <div style={{ ...cardBody, textAlign: 'center', padding: '40px 24px' }}>
            <GarminIcon name={icon} size={40} color={G.faint} />
            <div style={{ fontSize: 18, fontWeight: 300, margin: '12px 0 6px' }}>{page.title} is not available through Garmin's API</div>
            <div style={{ fontSize: 12, color: G.muted, marginBottom: 16 }}>Garmin only shows this section in its own app and website.</div>
            <a href={href} target="_blank" rel="noreferrer" style={footerLink}>Open on Garmin Connect <span aria-hidden="true">›</span></a>
          </div>
        </section>
      </div>
    );
  }
  if (!connected) {
    return (
      <div style={column}>
        <section style={card}><div style={{ ...cardBody, textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 300, marginBottom: 6 }}>Garmin Connect is not signed in</div>
          <div style={{ fontSize: 12, color: G.muted }}>Open Settings (gear icon above) and click Sign in under Garmin Connect.</div>
        </div></section>
      </div>
    );
  }
  if (error) return <div style={column}><section style={card}><div style={{ ...cardBody, color: G.metric.heart }}>{error}</div></section></div>;
  if (!results) return <div style={column}><section style={card}><div style={{ ...cardBody, color: G.muted, fontSize: 13 }}>Pulling {page.title.toLowerCase()} from Garmin Connect...</div></section></div>;

  if (Bespoke) {
    return <Bespoke page={page} slug={slug} dateISO={dateISO} range={range} setRange={setRange} results={results} loading={loading} activityId={activityId} syncedAt={syncedAt} profile={profile} />;
  }
  const entries = Object.entries(results);
  return (
    <div style={column}>
      {entries.length === 0 ? (
        <section style={card}><div style={{ ...cardBody, color: G.muted }}>Nothing to show.</div></section>
      ) : entries.map(([key, r]) => (
        <GarminCard key={key} icon={icon} title={key} href={href} aside={r.ok && r.cached ? 'cached' : (loading ? 'loading' : null)}>
          {r.ok ? <AutoData value={r.data} color={G.blue} /> : (
            <div style={{ fontSize: 13, color: G.metric.heart }}>Garmin did not return this ({r.code || 'error'}): {r.error}</div>
          )}
        </GarminCard>
      ))}
    </div>
  );
}
