import React, { useState } from 'react';
import { ok, Center, Para } from './common';
import { Leaderboard } from './Home';
import { PageContainer, PageTitle, TabStrip, EmptyState, BlueButton, HexBadge, Avatar, DataTable, TileCard, InfoDot } from '../../garmin';
import GarminIcon from '../GarminIcon';
import { G, title22 } from '../../../garminTheme';
import { metersToMiles } from '../../../utils/garminFormat';
import { num } from '../../../shared/format';

const hms = (sec) => { if (!sec && sec !== 0) return '--'; const s = Math.round(sec); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`; };
const selectStyle = { border: `1px solid ${G.faint}`, borderRadius: 4, padding: '4px 10px', fontSize: 11, display: 'inline-flex', gap: 8, background: 'white' };

export function Gear({ results }) {
  const [tabv, setTab] = useState('gear');
  const gear = ok(results, 'gear'); const list = Array.isArray(gear) ? gear : [];
  const shown = list.filter((g) => tabv === 'gear' ? !g.dateEnd : tabv === 'retired' ? !!g.dateEnd : false);
  return (
    <PageContainer narrow>
      <PageTitle info={false} right={<BlueButton style={{ fontSize: 12 }}>+ Add Gear</BlueButton>}>Gear</PageTitle>
      <TabStrip tabs={[{ key: 'gear', label: 'Gear' }, { key: 'coll', label: 'Collections' }, { key: 'retired', label: 'Retired' }]} value={tabv} onChange={setTab} style={{ marginBottom: 24 }} />
      {shown.length ? shown.map((g) => <div key={g.uuid} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${G.border}`, fontSize: 13 }}><span>{g.customMakeModel || g.displayName}</span><span style={{ color: G.muted, fontSize: 11 }}>{g.gearTypeName}{g.maximumMeters ? ` · ${num(metersToMiles(g.maximumMeters))} mi max` : ''}</span></div>) : (
        <EmptyState icon="gear" title={tabv === 'coll' ? 'No collections' : tabv === 'retired' ? 'No retired gear' : 'Start tracking your gear'} sub={tabv === 'gear' ? 'Add your shoes, bikes and other gear here to monitor how much you use them, see when they\'re ready to be replaced and more.' : null} button={tabv === 'gear' ? <BlueButton style={{ fontSize: 12 }}>Add Gear</BlueButton> : null} />
      )}
    </PageContainer>
  );
}

export function Insights() {
  return (
    <PageContainer flush style={{ background: 'transparent' }}>
      <div style={{ ...title22, fontSize: 18 }}>Insights <InfoDot /></div>
      <Center style={{ marginTop: 30 }}>
        <GarminIcon name="insights" color={G.text} size={48} />
        <div style={{ fontSize: 18, fontWeight: 300, marginTop: 8 }}>Get Insights into Your Fitness</div>
        <Para style={{ maxWidth: 300, margin: '8px auto 14px', color: G.text }}>When you use Insights, we send you motivational messages and suggestions to help you reach your goals, and you can see how you compare to the Connect community.</Para>
        <BlueButton style={{ fontSize: 12 }}>Get Insights</BlueButton>
      </Center>
    </PageContainer>
  );
}

export function Friends({ dateISO, results, profile }) {
  const [tabv, setTab] = useState('followers');
  const name = (profile && profile.full_name) || 'You';
  return (
    <PageContainer style={{ padding: 'clamp(16px, 3vw, 30px)' }}>
      <PageTitle info={false} right={null} small style={{ marginBottom: 4 }}>Friends</PageTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)', gap: 20 }}>
        <div>
          <TabStrip tabs={[{ key: 'followers', label: 'Followers' }, { key: 'following', label: 'Following' }, { key: 'suggested', label: 'Suggested' }]} value={tabv} onChange={setTab} right={<span style={{ color: G.muted }}>🔍</span>} />
          <EmptyState icon="friends" title={tabv === 'followers' ? 'No Followers' : tabv === 'following' ? 'Not following anyone' : 'No suggestions yet'} sub="You can share your profile with others to get started." button={<BlueButton style={{ fontSize: 12 }}>⇪ Share Profile</BlueButton>} />
        </div>
        <Leaderboard dateISO={dateISO} results={results} name={name} />
      </div>
    </PageContainer>
  );
}

export function Groups() {
  const [tabv, setTab] = useState('mine');
  return (
    <PageContainer narrow>
      <PageTitle info={false} right={null} small style={{ marginBottom: 4 }}>Groups</PageTitle>
      <TabStrip tabs={[{ key: 'mine', label: 'My Groups' }, { key: 'search', label: 'Search Groups' }]} value={tabv} onChange={setTab} right={<span style={{ fontSize: 11, color: G.text }}>+ Create a Group</span>} />
      <EmptyState icon="groups" title="Find your people" sub="You're not yet a member of any groups. Get started by joining an existing group or creating your own." button={<BlueButton style={{ fontSize: 11, padding: '4px 12px' }}>Search Groups</BlueButton>} />
    </PageContainer>
  );
}

export function Badges({ results, profile }) {
  const [tabv, setTab] = useState('earned');
  const earned = ok(results, 'earned') || []; const available = ok(results, 'available') || []; const prof = ok(results, 'profile') || {};
  const points = earned.reduce((n, b) => n + (b.badgePoints || 0), 0);
  const level = Math.floor(points / 50) + 1; const toNext = 50 - (points % 50);
  const list = tabv === 'earned' ? earned : available;
  const name = (profile && profile.full_name) || (earned[0] && earned[0].fullName) || prof.fullName || 'You';
  return (
    <PageContainer style={{ padding: 'clamp(16px, 3vw, 30px)' }}>
      <PageTitle info={false} right={null} small>Badges</PageTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(220px, 1fr)', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 30, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}><Avatar name={name} size={72} /><div style={{ fontSize: 12, marginTop: 6 }}>{name}</div><div style={{ fontSize: 11, color: G.muted }}>Level <span style={{ background: G.green, color: 'white', borderRadius: '50%', padding: '1px 6px', fontSize: 10 }}>{level}</span> {points} pts</div></div>
            <div style={{ flex: 1, minWidth: 160 }}><div style={{ background: G.border, height: 6, borderRadius: 3 }}><div style={{ width: `${((points % 50) / 50) * 100}%`, height: '100%', background: G.metric.stress, borderRadius: 3 }} /></div><div style={{ fontSize: 10, color: G.muted, marginTop: 4, textAlign: 'right' }}>{toNext} pts to next level</div></div>
          </div>
          <TabStrip tabs={[{ key: 'earned', label: 'Earned' }, { key: 'available', label: 'Available' }]} value={tabv} onChange={setTab} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, margin: '12px 0' }}>Filter by <span style={selectStyle}>Badge Type ⌄</span><span style={selectStyle}>Badge Points ⌄</span><span style={{ ...selectStyle, background: G.border }}>Clear All</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 6px' }}>
            {list.length ? list.slice(0, 60).map((b, i) => <HexBadge key={b.badgeId || i} name={b.badgeName} index={b.badgeCategoryId || i} points={b.badgePoints} earned={tabv === 'earned'} />) : <Para style={{ color: G.muted }}>No badges here yet.</Para>}
          </div>
        </div>
        <div style={{ border: `1px solid ${G.border}`, borderRadius: 4, padding: 14 }}><div style={{ fontSize: 14, marginBottom: 6 }}>Badge Leaderboard</div><div style={{ fontSize: 11, color: G.muted }}>Looks like you haven't followed anyone yet. <span style={{ color: G.blue }}>Follow others</span>, and they'll show up here.</div></div>
      </div>
    </PageContainer>
  );
}

const PR_TYPES = {
  1: ['Run 1K', 'running', 'time'], 2: ['Run 1 mi', 'running', 'time'], 3: ['Run 5K', 'running', 'time'], 4: ['Run 10K', 'running', 'time'], 5: ['Run Half Marathon', 'running', 'time'], 6: ['Run Marathon', 'running', 'time'], 7: ['Longest Run', 'running', 'dist'],
  8: ['Ride 40K', 'cycling', 'time'], 9: ['Longest Ride', 'cycling', 'dist'], 10: ['Max Avg Power (20 min)', 'cycling', 'watts'], 11: ['Swim 100 m', 'swim', 'time'], 12: ['Most Steps in a Day', 'steps', 'steps'], 13: ['Most Steps in a Week', 'steps', 'steps'], 14: ['Most Steps in a Month', 'steps', 'steps'], 15: ['Longest Goal Streak', 'steps', 'days'], 16: ['Current Goal Streak', 'steps', 'days'],
};
const fmtPR = (kind, v) => (v === null || v === undefined || (kind === 'days' && !v) ? '--' : kind === 'time' ? hms(v) : kind === 'dist' ? `${num(metersToMiles(v), 2)} mi` : kind === 'steps' ? num(v) : kind === 'days' ? `${num(v)} days` : kind === 'watts' ? `${num(v)} W` : num(v));
const fmtDate = (s) => { if (!s) return '--'; const d = new Date(String(s).replace(' ', 'T')); return Number.isNaN(d.getTime()) ? String(s).slice(0, 10) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
export function PersonalRecords({ results }) {
  const [tabv, setTab] = useState('steps');
  const prs = ok(results, 'prs') || [];
  const rows = prs.map((p) => { const t = PR_TYPES[p.typeId] || [`Record type ${p.typeId}`, 'other', 'raw']; return { key: p.id, category: t[0], group: t[1], record: fmtPR(t[2], p.value), date: t[2] === 'days' && !p.value ? '--' : fmtDate(p.prStartTimeLocalFormatted || p.actStartDateTimeInGMTFormatted), activity: p.activityName }; }).filter((r) => r.group === tabv);
  return (
    <PageContainer style={{ padding: 'clamp(16px, 3vw, 30px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div style={title22}>Personal Records <InfoDot /></div>
        <TabStrip tabs={[{ key: 'steps', label: 'Steps' }, { key: 'running', label: 'Running' }, { key: 'cycling', label: 'Cycling' }, { key: 'swim', label: 'Pool Swimming' }, { key: 'strength', label: 'Strength' }]} value={tabv} onChange={setTab} style={{ borderBottom: 'none' }} />
      </div>
      <div style={{ textAlign: 'right', fontSize: 11, margin: '10px 0' }}>Customize List ⌄</div>
      <DataTable columns={[{ key: 'category', label: 'Category' }, { key: 'record', label: 'Record', bold: true }, { key: 'date', label: 'Date' }]} rows={rows} empty="No records in this category yet." />
    </PageContainer>
  );
}

export function Goals({ results }) {
  const [tabv, setTab] = useState('active');
  const list = ok(results, tabv) || [];
  return (
    <PageContainer narrow>
      <div style={title22}>Goals <InfoDot /></div>
      <TabStrip tabs={[{ key: 'active', label: 'Active Goals' }, { key: 'future', label: 'Future Goals' }, { key: 'past', label: 'Past Goals' }]} value={tabv} onChange={setTab} right={<span style={{ fontSize: 11 }}>+ Create a New Goal</span>} style={{ margin: '8px 0 16px' }} />
      {list.length ? list.map((g, i) => <div key={i} style={{ padding: '10px 0', borderBottom: `1px solid ${G.border}`, fontSize: 13 }}>{g.goalName || g.name || `Goal ${i + 1}`}</div>) : (
        <Center>
          <Para>You don't have any {tabv === 'active' ? 'Active' : tabv === 'future' ? 'Future' : 'Past'} Goals.</Para>
          <div style={{ fontSize: 20, fontWeight: 300, margin: '14px 0 20px' }}>Set some goals - then demolish them.</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[['Running', 'activity', 'Create a Running Goal'], ['Cycling', 'gear', 'Create a Cycling Goal'], ['Swimming', 'hydration', 'Create a Swimming Goal'], ['Custom', 'goals', 'Create your own goals']].map(([t, ic, c]) => <TileCard key={t} title={t} icon={ic} caption={c} />)}
          </div>
        </Center>
      )}
    </PageContainer>
  );
}
