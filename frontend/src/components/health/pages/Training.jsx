import React, { useState } from 'react';
import { ok, Center, Para } from './common';
import { PageContainer, PageTitle, TabStrip, EmptyState, BlueButton, GrayButton, OutlinedButton, Illustration, MapView, Notice, InfoDot } from '../../garmin';
import GarminIcon from '../GarminIcon';
import { G, sectionLabel, title22 } from '../../../garminTheme';
import { titleCase } from '../../../shared/format';

const lastPos = (results) => { const a = ok(results, 'last'); return a && a.startLatitude ? [a.startLatitude, a.startLongitude] : [25.79, -80.13]; };
const inputStyle = { border: `1px solid ${G.faint}`, borderRadius: 4, padding: '6px 10px', fontSize: 12, fontFamily: G.font, background: 'white' };
const selectStyle = { ...inputStyle, display: 'inline-flex', justifyContent: 'space-between', gap: 8, minWidth: 120, color: G.text };

export function Workouts({ results }) {
  const [tabv, setTab] = useState('mine');
  const list = ok(results, 'list') || []; const next = ok(results, 'next');
  return (
    <PageContainer narrow>
      <PageTitle info={false} right={<BlueButton style={{ fontSize: 12, padding: '6px 14px' }}>Create a Workout</BlueButton>}>Workouts</PageTitle>
      <TabStrip tabs={[{ key: 'mine', label: 'My Workouts' }, { key: 'bench', label: 'Benchmark Exercises' }, { key: 'find', label: 'Find a Workout' }]} value={tabv} onChange={setTab} style={{ marginBottom: 24 }} />
      {tabv === 'mine' && list.length ? (
        <div>{list.map((w) => <div key={w.workoutId} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${G.border}`, fontSize: 13 }}><span>{w.workoutName}</span><span style={{ color: G.muted, fontSize: 11 }}>{titleCase((w.sportType || {}).sportTypeKey)}</span></div>)}{next && next.workoutId ? <Para>Next scheduled: {next.workoutName}</Para> : null}</div>
      ) : (
        <Center style={{ padding: '10px 0 30px' }}>
          <Illustration icon="workout" color={G.green} size={110} />
          <Para style={{ fontSize: 13 }}>{tabv === 'bench' ? 'Benchmark exercises measure your strength on key lifts.' : tabv === 'find' ? 'Browse Garmin\'s library of workouts.' : 'Get step-by-step guidance on your device. You can browse existing workouts or create your own.'}</Para>
        </Center>
      )}
    </PageContainer>
  );
}

export function CoachPlans({ results }) {
  const [tabv, setTab] = useState('find');
  const plans = ok(results, 'plans'); const list = Array.isArray(plans) ? plans : (plans && plans.trainingPlanList) || [];
  return (
    <PageContainer narrow>
      <PageTitle info={false} right={null} style={{ marginBottom: 6 }}>Garmin Coach</PageTitle>
      <TabStrip tabs={[{ key: 'active', label: 'Active Plan' }, { key: 'find', label: 'Find a Plan' }, { key: 'done', label: 'Completed Plans' }]} value={tabv} onChange={setTab} style={{ marginBottom: 20 }} />
      {tabv === 'find' ? (
        <>
          <div style={{ fontSize: 14, fontWeight: 300, marginBottom: 12 }}>What kind of plan would you like to set up?</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {[['Running', 'activity', 'linear-gradient(135deg,#8ec5ff,#f4b183)'], ['Cycling', 'gear', 'linear-gradient(135deg,#8fd3a6,#3b7dd8)']].map(([l, ic, bg]) => (
              <div key={l} style={{ width: 220, border: `1px solid ${G.border}`, borderRadius: 4, overflow: 'hidden' }}><div style={{ height: 120, background: bg }} /><div style={{ padding: '8px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}><GarminIcon name={ic} color={G.text} size={14} />{l}</div></div>
            ))}
          </div>
          <div style={{ textAlign: 'right', marginTop: 16 }}><GrayButton style={{ fontSize: 11, padding: '5px 12px' }}>Browse All Plans</GrayButton></div>
        </>
      ) : list.length ? list.map((p, i) => <div key={i} style={{ padding: '10px 0', borderBottom: `1px solid ${G.border}`, fontSize: 13 }}>{p.trainingPlanName || p.name}</div>) : <EmptyState icon="planning" title={tabv === 'active' ? 'No active plan' : 'No completed plans'} sub="Find a plan to get started with Garmin Coach." />}
    </PageContainer>
  );
}

export function RacesEvents() {
  const [tabv, setTab] = useState('mine');
  return (
    <PageContainer style={{ padding: 'clamp(16px, 3vw, 30px)' }}>
      <div style={{ ...sectionLabel, marginBottom: 6 }}>Races &amp; Events</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><div style={title22}>My Race Events</div><BlueButton style={{ fontSize: 11, padding: '5px 12px' }}>Create Event</BlueButton></div>
      <TabStrip tabs={[{ key: 'mine', label: 'My Events' }, { key: 'past', label: 'Past Events' }, { key: 'find', label: 'Find an Event' }]} value={tabv} onChange={setTab} style={{ marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <input placeholder="Event Name or Keyword" style={{ ...inputStyle, flex: 1, minWidth: 180 }} /><input placeholder="City, State or Zip" style={{ ...inputStyle, flex: 1, minWidth: 180 }} /><BlueButton style={{ fontSize: 11, padding: '5px 14px' }}>Search 🔍</BlueButton>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
        <span style={{ ...selectStyle, minWidth: 0 }}>▾ Filters</span>
        {['Date Range Sep 26, 2026 - Sep 26, 2027', 'Official Event', 'Verified Source'].map((c) => <span key={c} style={{ background: G.border, borderRadius: 12, padding: '4px 10px' }}>{c} ×</span>)}
      </div>
      <Center style={{ padding: 40 }}><span style={{ color: G.faint, fontSize: 22 }}>◌</span><Para style={{ color: G.muted }}>{tabv === 'find' ? 'Search for official race events near you.' : tabv === 'past' ? 'No past events.' : 'No upcoming events. Create an event to plan a race.'}</Para></Center>
    </PageContainer>
  );
}

// Map page shell: left panel + full-height map.
const isNarrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;

function MapPage({ left, center, leftWidth = 320, height = 640 }) {
  const narrow = isNarrow();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : `minmax(0, ${leftWidth}px) minmax(0, 1fr)`, margin: narrow ? -16 : -30, minHeight: narrow ? 0 : height }}>
      <div style={{ background: 'white', padding: 16, borderRight: narrow ? 'none' : `1px solid ${G.border}`, minWidth: 0, overflow: 'hidden' }}>{left}</div>
      <MapView center={center} zoom={12} height={narrow ? 360 : height} />
    </div>
  );
}

export function Courses({ results }) {
  const [tabv, setTab] = useState('mine');
  return <MapPage center={lastPos(results)} left={<>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><div style={{ fontSize: 18, fontWeight: 300 }}>Courses</div><div style={{ display: 'flex', gap: 6 }}><BlueButton style={{ fontSize: 10, padding: '4px 10px' }}>⤒ Import</BlueButton><BlueButton style={{ fontSize: 10, padding: '4px 10px' }}>+ Create New</BlueButton></div></div>
    <div style={{ fontSize: 10, color: G.muted }}>Search here</div>
    <input placeholder="Address, postal code, city, or landmark" style={{ ...inputStyle, width: '100%', marginBottom: 10 }} />
    <TabStrip tabs={[{ key: 'mine', label: 'My Courses' }, { key: 'fav', label: 'Favorites' }, { key: 'near', label: 'Nearby Courses' }]} value={tabv} onChange={setTab} />
    <Para style={{ color: G.muted, marginTop: 20 }}>{tabv === 'mine' ? 'No courses yet. Create one from an activity or draw it on the map.' : tabv === 'fav' ? 'No favorite courses.' : 'Search a location to find nearby courses.'}</Para>
  </>} />;
}

export function PacePro() {
  return (
    <PageContainer narrow>
      <div style={{ ...title22, marginBottom: 8 }}>PacePro <InfoDot /></div>
      <GrayButton style={{ fontSize: 11, padding: '5px 12px', marginBottom: 30 }}>+ Create PacePro Strategy</GrayButton>
      <Center>
        <Illustration icon="planning" color={G.metric.battery} size={110} />
        <div style={{ fontSize: 18, fontWeight: 300 }}>Plan your race strategy with PacePro.</div>
        <Para style={{ color: G.muted, maxWidth: 380, margin: '8px auto' }}>Tell us a few details about the course and your goals, and PacePro will create a customized race pacing strategy for your Garmin device.</Para>
      </Center>
    </PageContainer>
  );
}

export function Segments({ results }) {
  const [tabv, setTab] = useState('mine');
  return (
    <div style={{ margin: isNarrow() ? -16 : -30 }}>
      <div style={{ display: 'flex', gap: 8, padding: 10, background: 'white', borderBottom: `1px solid ${G.border}`, flexWrap: 'wrap' }}>
        <input placeholder="Location" style={{ ...inputStyle, width: 160 }} />
        {['Activity Type', 'Segment Type', 'Surface', 'Avg Grade'].map((f) => <span key={f} style={selectStyle}>▾ {f}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isNarrow() ? 'minmax(0, 1fr)' : 'minmax(0, 320px) minmax(0, 1fr)', minHeight: isNarrow() ? 0 : 600 }}>
        <div style={{ background: 'white', padding: 12, borderRight: `1px solid ${G.border}`, minWidth: 0, overflow: 'hidden' }}>
          <TabStrip tabs={[{ key: 'mine', label: 'Your Segments' }, { key: 'fav', label: 'Favorites' }, { key: 'near', label: 'Nearby Segments' }]} value={tabv} onChange={setTab} />
          <Para style={{ textAlign: 'center', marginTop: 30, color: G.text }}>Create segments from your activities to compete in the places that you ride or run.</Para>
        </div>
        <MapView center={lastPos(results)} zoom={12} height={isNarrow() ? 360 : 600} />
      </div>
    </div>
  );
}

export function Trails({ results }) {
  const [tabv, setTab] = useState('near');
  return <MapPage center={lastPos(results)} left={<>
    <Notice style={{ marginBottom: 12 }}><strong>Navigate Garmin Trails from your device</strong> <span style={{ color: G.blue }}>Join Garmin Connect+</span></Notice>
    <div style={{ fontSize: 18, fontWeight: 300, marginBottom: 6 }}>Garmin Trails</div>
    <div style={{ fontSize: 10, color: G.muted }}>Search here</div>
    <input placeholder="Trail, City, Landmark, Park..." style={{ ...inputStyle, width: '100%', marginBottom: 10 }} />
    <TabStrip tabs={[{ key: 'near', label: 'Nearby' }, { key: 'saved', label: 'Saved' }]} value={tabv} onChange={setTab} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, margin: '10px 0' }}><OutlinedButton style={{ fontSize: 10, padding: '3px 10px' }}>▾ Filters</OutlinedButton><span>Sort by <span style={selectStyle}>Most Recent ▾</span></span></div>
    <div style={{ fontSize: 10, color: G.muted, textAlign: 'right' }}>Showing 0 Trails</div>
    <Para style={{ color: G.muted, marginTop: 20 }}>Garmin does not expose trail search through its API. Open Garmin Trails on connect.garmin.com to browse trails near you.</Para>
  </>} />;
}

export function Heatmap({ results }) {
  return (
    <div style={{ margin: isNarrow() ? -16 : -30, position: 'relative' }}>
      <MapView center={lastPos(results)} zoom={11} height={isNarrow() ? 420 : 660} />
      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 8, zIndex: 500 }}>
        <input placeholder="Location" style={{ ...inputStyle, width: 150 }} /><span style={selectStyle}>▾ Running</span>
      </div>
      <div style={{ position: 'absolute', top: 44, left: 10, background: 'white', border: `1px solid ${G.border}`, borderRadius: 4, padding: '8px 10px', fontSize: 11, zIndex: 500 }}><div style={{ color: G.blue }}>Find a Course</div><div style={{ color: G.blue }}>Create a New Course</div></div>
      <div style={{ position: 'absolute', top: 10, right: 10, background: 'white', border: `1px solid ${G.border}`, borderRadius: 4, padding: '6px 8px', fontSize: 10, zIndex: 500 }}>▾ Google Maps<div style={{ display: 'flex', gap: 6, marginTop: 4 }}><span style={{ width: 40, height: 28, background: '#2c3e50', display: 'inline-block' }} /><span style={{ width: 40, height: 28, background: '#8ab17d', display: 'inline-block' }} /></div><div style={{ marginTop: 4, color: G.muted }}>Bike Lanes &amp; Trails</div></div>
    </div>
  );
}
