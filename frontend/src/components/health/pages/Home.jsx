import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ok, Para } from './common';
import { PageContainer, EmptyState, BlueButton, OutlinedButton, HexBadge, Avatar, RangeControl, SectionHeading } from '../../garmin';
import GarminIcon from '../GarminIcon';
import { G, sectionLabel, pillButton, chevronButton, roundNav } from '../../../garminTheme';
import { num, metersToMiles } from '../../../utils/garminFormat';
import { shiftISO, todayISO } from '../../../utils/dayInfo';

const hms = (sec) => { if (!sec) return '0:00'; const s = Math.round(sec); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`; };
const listOf = (v) => (Array.isArray(v) ? v : (v && (v.badgeChallenges || v.challenges || v.content)) || []);

export function Challenges({ dateISO, results }) {
  const available = listOf(ok(results, 'available')); const inprogress = listOf(ok(results, 'inprogress')); const adhoc = listOf(ok(results, 'adhoc'));
  const card = (c, i) => (
    <div key={c.badgeChallengeId || c.uuid || i} style={{ border: `1px solid ${G.border}`, borderRadius: 4, padding: '12px 10px', width: 118, textAlign: 'center', fontSize: 11 }}>
      <HexBadge name="" index={i} points={null} size={56} />
      <div style={{ fontWeight: 600, minHeight: 30 }}>{c.badgeChallengeName || c.challengeName || c.name || 'Challenge'}</div>
      <div style={{ color: G.muted, fontSize: 10, margin: '4px 0 8px' }}>{c.startDate ? `${c.startDate.slice(5)} - ${(c.endDate || '').slice(5)}` : ''}</div>
      <BlueButton style={{ fontSize: 10, padding: '3px 12px' }}>Join</BlueButton>
    </div>
  );
  return (
    <PageContainer style={{ padding: 'clamp(16px, 3vw, 30px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={sectionLabel}>Challenges</div>
        <BlueButton style={{ fontSize: 11, padding: '4px 12px' }}>+ Challenges</BlueButton>
      </div>
      <div style={{ background: '#fff8e1', border: '1px solid #f3e2a8', padding: '8px 12px', fontSize: 11, marginBottom: 16, display: 'flex', gap: 8 }}><strong>Get access to exclusive badge challenges.</strong><span style={{ color: G.blue }}>Join Garmin Connect+</span></div>
      <SectionHeading right={<span style={{ fontSize: 11, color: G.blue }}>See All ‹ ›</span>}>Join a Challenge</SectionHeading>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '10px 0 24px' }}>{available.length ? available.slice(0, 6).map(card) : <Para style={{ color: G.muted }}>No badge challenges are open to join right now.</Para>}</div>
      <SectionHeading right={<span style={{ fontSize: 11, color: G.blue }}>See All ‹ ›</span>}>Start an Expedition</SectionHeading>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '10px 0 24px' }}>{['Aconcagua', 'Annapurna Circuit', 'Appalachian Trail', 'Camino de Santiago', 'Chilkoot Trail', 'Cradle Mountain', 'McKinley', 'Elbrus'].map((n, i) => <div key={n} style={{ width: 84, textAlign: 'center', fontSize: 10 }}><div style={{ width: 52, height: 52, margin: '0 auto 6px', borderRadius: 8, background: ['#4a8ad6', '#6fb1e8', '#8dc9f5', '#5e9bd8'][i % 4] }} />{n}</div>)}</div>
      <SectionHeading>Current Challenges</SectionHeading>
      {inprogress.length || adhoc.length ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>{[...inprogress, ...adhoc].slice(0, 8).map(card)}</div>
      ) : (
        <EmptyState icon="challenges" title="Start your first challenge!" sub="Get fit using the power of friendly competition. Join a challenge in your activity of choice or create your own by challenging your connections." button={<div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}><BlueButton style={{ fontSize: 11, padding: '4px 12px' }}>Join Now</BlueButton><OutlinedButton style={{ fontSize: 11, padding: '3px 12px', color: G.blue, borderColor: G.blue }}>Create a Challenge</OutlinedButton></div>} />
      )}
    </PageContainer>
  );
}

export function Calendar({ dateISO, results }) {
  const acts = ok(results, 'acts') || [];
  const [view, setView] = useState('month');
  const [y, m] = dateISO.split('-').map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay(); const daysIn = new Date(y, m, 0).getDate();
  const cells = []; for (let i = 0; i < firstDow; i++) cells.push(null); for (let d = 1; d <= daysIn; d++) cells.push(d); while (cells.length % 7) cells.push(null);
  const byDay = {}; acts.forEach((a) => { const d = Number(String(a.startTimeLocal || '').slice(8, 10)); (byDay[d] = byDay[d] || []).push(a); });
  const monthTo = (delta) => `/health/${new Date(y, m - 1 + delta, 1).toISOString().slice(0, 10)}/calendar`;
  const totals = { n: acts.length, dist: acts.reduce((s, a) => s + (a.distance || 0), 0), time: acts.reduce((s, a) => s + (a.duration || 0), 0), cal: acts.reduce((s, a) => s + (a.calories || 0), 0) };
  const today = todayISO();
  return (
    <PageContainer style={{ padding: 'clamp(12px, 2vw, 20px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to={`/health/${today}/calendar`} style={pillButton()}>Today</Link>
          <Link to={monthTo(-1)} style={chevronButton}>‹</Link><Link to={monthTo(1)} style={chevronButton}>›</Link>
          <span style={{ fontSize: 14 }}>{new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        </div>
        <RangeControl options={[{ key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'year', label: 'Year' }]} value={view} onChange={setView} />
      </div>
      <div style={{ fontSize: 11, color: G.muted, marginBottom: 8 }}>▾ Filter by Category <span style={{ background: G.blue, color: 'white', borderRadius: 10, padding: '0 6px', fontSize: 9 }}>2</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: `1px solid ${G.border}`, borderLeft: `1px solid ${G.border}` }}>
        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => <div key={d} style={{ padding: 6, fontSize: 11, fontWeight: 600, textAlign: 'center', borderRight: `1px solid ${G.border}`, borderBottom: `1px solid ${G.border}`, background: G.surface2 }}>{d}</div>)}
        {cells.map((d, i) => {
          const iso = d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
          return (
            <div key={i} style={{ minHeight: 84, padding: 4, borderRight: `1px solid ${G.border}`, borderBottom: `1px solid ${G.border}`, background: d ? 'white' : G.surface2, outline: iso === dateISO ? `2px solid ${G.text}` : 'none', outlineOffset: -2 }}>
              {d ? <div style={{ fontSize: 10, color: G.muted }}>{d}</div> : null}
              {(byDay[d] || []).map((a) => <Link key={a.activityId} to={`/health/${iso}/activity/${a.activityId}`} style={{ display: 'block', fontSize: 9, background: G.green, color: 'white', borderRadius: 2, padding: '2px 4px', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.activityName} · {num(metersToMiles(a.distance), 1)} mi</Link>)}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
        <div><strong>Month Totals</strong> <span style={{ border: `1px solid ${G.faint}`, padding: '2px 8px', borderRadius: 3, marginLeft: 8 }}>All Activities</span> <span style={{ marginLeft: 12 }}><strong>Activities:</strong> {totals.n} <strong style={{ marginLeft: 8 }}>Distance:</strong> {num(metersToMiles(totals.dist), 2)} mi <strong style={{ marginLeft: 8 }}>Time:</strong> {hms(totals.time)} <strong style={{ marginLeft: 8 }}>Calories:</strong> {num(totals.cal)}</span></div>
        <label style={{ color: G.muted }}><input type="checkbox" /> Weekly Totals</label>
      </div>
      <div style={{ marginTop: 16, borderTop: `1px solid ${G.border}`, paddingTop: 10, fontSize: 13 }}>⌃ Goals<div style={{ fontSize: 11, color: G.blue, marginTop: 6 }}>Add a Goal</div></div>
    </PageContainer>
  );
}

// Right-hand "Weekly Leaderboard" card (News Feed and Friends).
export function Leaderboard({ dateISO, results, name }) {
  const daily = ok(results, 'week') || [];
  const d = new Date(`${dateISO}T00:00:00`); const start = shiftISO(dateISO, -d.getDay()); const end = shiftISO(start, 6);
  const steps = daily.filter((x) => x.calendarDate >= start && x.calendarDate <= end).reduce((n, x) => n + (x.totalSteps || 0), 0);
  const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <div style={{ border: `1px solid ${G.border}`, borderRadius: 4, padding: 14, background: 'white' }}>
      <div style={{ fontSize: 16, fontWeight: 300, marginBottom: 10 }}>Weekly Leaderboard</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 10 }}><span style={roundNav}>‹</span><span>{fmt(start)}-{fmt(end).replace(/^\w+ /, '')}</span><span style={roundNav}>›</span></div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>{['All', 'Steps'].map((o) => <div key={o} style={{ flex: 1, border: `1px solid ${G.faint}`, borderRadius: 3, padding: '4px 8px', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>{o}<span>⌄</span></div>)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: G.surface2, padding: '6px 8px', fontSize: 12 }}><span>1</span><Avatar name={name} size={24} /><span style={{ flex: 1 }}>{name}</span><span>{num(steps)}</span><GarminIcon name="info" color={G.muted} size={10} /></div>
    </div>
  );
}

export function NewsFeed({ dateISO, results, profile }) {
  const name = (profile && profile.full_name) || 'You';
  return (
    <PageContainer style={{ padding: 'clamp(16px, 3vw, 30px)' }}>
      <div style={{ ...sectionLabel, marginBottom: 16 }}>News Feed</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)', gap: 20 }}>
        <div style={{ border: `1px solid ${G.border}`, borderRadius: 4, background: 'white' }}>
          <EmptyState icon="friends" title="You're not following anyone" sub="Review your friend suggestions to get started." button={<BlueButton style={{ fontSize: 12 }}>Review Suggestions</BlueButton>} style={{ padding: '50px 16px' }} />
        </div>
        <Leaderboard dateISO={dateISO} results={results} name={name} />
      </div>
    </PageContainer>
  );
}
