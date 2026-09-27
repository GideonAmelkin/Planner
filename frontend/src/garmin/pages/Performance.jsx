import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MetricFrame, DailyBars, ok, first, Center, Para, pageTo } from './common';
import { PageContainer, Banner, SideIndex, RangeControl, EmptyState, StatPair, StatRow, ArcGauge, InfoDot, DateControls, LinkButton } from '../primitives';
import GarminIcon from '../GarminIcon';
import { G, title22 } from '../theme';
import { num } from '../../shared/format';

const REPORT_RANGES = [{ key: '4w', label: 'Most Recent' }, { key: '4w2', label: '4 Weeks' }, { key: '6m', label: '6 Months' }, { key: '1y', label: '1 Year' }];
const hms = (sec) => { if (!sec && sec !== 0) return '--'; const s = Math.round(sec); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`; };

const INDEX = (dateISO) => [
  { key: 'all', label: 'All Activities', to: `/garmin/${dateISO}/reports`, children: ['Activities', 'Activity Calories', 'Average Heart Rate', 'Average Pace', 'Average Speed', 'Fitness Age', 'FTP', 'HRV Status', 'Max Heart Rate', 'Total Activity Time', 'Total Distance', 'VO2 Max'].map((l) => ({ key: `all:${l}`, label: l })) },
  { key: 'cycling', label: 'Cycling' },
  { key: 'health', label: 'Health & Fitness' },
  { key: 'running', label: 'Running', children: [['Activities'], ['Activity Calories'], ['Average GCT Balance'], ['Average Ground Contact Time'], ['Average Heart Rate'], ['Average Pace'], ['Average Run Cadence'], ['Average Speed'], ['Average Stride Length'], ['Average Vertical Oscillation'], ['Average Vertical Ratio'], ['HRV Status', 'hrv-status'], ['Lactate Threshold'], ['Max Heart Rate'], ['Race Predictor', 'race-predictor'], ['Total Activity Time'], ['Total Ascent'], ['Total Distance'], ['Training Effect', 'training-effect'], ['VO2 Max', 'vo2-max']].map(([l, slug]) => ({ key: slug || `run:${l}`, label: l, to: slug ? `/garmin/${dateISO}/${slug}` : null })) },
  { key: 'progress', label: 'Progress Summary' },
];

// The Reports frame: banner, "Reports" title, side index, right panel.
function ReportsFrame({ dateISO, active, title, children, ranges = true, exportLink = false }) {
  const [r, setR] = useState('4w');
  return (
    <PageContainer style={{ padding: 'clamp(16px, 3vw, 30px)' }}>
      <Banner link={{ href: 'https://connect.garmin.com/modern/', label: 'Join Garmin Connect+' }}>Use Performance Dashboard to customize how you view your training stats</Banner>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 190px) minmax(0, 1fr)', gap: 24 }}>
        <div>
          <div style={{ ...title22, marginBottom: 12 }}>Reports</div>
          <SideIndex groups={INDEX(dateISO)} active={active} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 300, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{title} <InfoDot /></div>
            {exportLink ? <span style={{ fontSize: 11, color: G.blue }}>Export ⤓</span> : null}
          </div>
          {ranges ? <div style={{ display: 'flex', justifyContent: 'flex-end', borderBottom: `1px solid ${G.border}`, paddingBottom: 12, marginBottom: 20 }}><RangeControl options={REPORT_RANGES} value={r} onChange={setR} /></div> : null}
          {children}
        </div>
      </div>
    </PageContainer>
  );
}

export function HrvStatus({ dateISO, range, setRange, results, slug }) {
  const hrv = (ok(results, 'hrv') || {}).hrvSummary || null; const rangeData = ok(results, 'range') || {};
  const list = rangeData.hrvSummaries || [];
  return (
    <MetricFrame title="HRV Status" slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w']}>
      {!hrv && !list.length ? <EmptyState icon="hrv" title="No HRV status data" sub="You have no data for this time period." /> : range === '1d' && hrv ? (
        <StatRow>
          <StatPair value={num(hrv.lastNightAvg)} unit="ms" label="Last Night Avg" />
          <StatPair value={num(hrv.weeklyAvg)} unit="ms" label="7-Day Avg" />
          <StatPair value={hrv.status ? hrv.status.replace(/_/g, ' ') : null} label="Status" />
          <StatPair value={hrv.baseline ? `${hrv.baseline.balancedLow} - ${hrv.baseline.balancedUpper}` : null} unit="ms" label="Baseline" />
        </StatRow>
      ) : <DailyBars rows={list.map((x) => ({ calendarDate: x.calendarDate, value: x.lastNightAvg || x.weeklyAvg || 0 }))} valueKey="value" color={G.metric.hrv} unit=" ms" title="HRV by night" />}
    </MetricFrame>
  );
}

export function RacePredictor({ dateISO, results }) {
  const r = ok(results, 'race') || {};
  const races = [['5K', r.time5K, G.blue], ['10K', r.time10K, G.green], ['Half', r.timeHalfMarathon, G.metric.stress], ['Marathon', r.timeMarathon, G.metric.heart]];
  return (
    <ReportsFrame dateISO={dateISO} active="race-predictor" title="Race Predictor">
      <Center>
        <GarminIcon name="activity" color={G.blue} size={40} />
        <Para style={{ maxWidth: 420, margin: '10px auto 24px' }}>Based on your current performance, we predict that you can complete these race distances with the following times. The more runs you track, the more accurate the predictions will become.</Para>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
          {races.map(([l, v, c]) => <div key={l} style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 300 }}>{hms(v)}</div><div style={{ fontSize: 12, marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, background: c, display: 'inline-block', transform: l === '10K' ? 'rotate(45deg)' : 'none', borderRadius: l === '5K' ? '50%' : 0 }} />{l}</div></div>)}
        </div>
        {r.calendarDate ? <div style={{ fontSize: 11, color: G.muted, marginTop: 18 }}>As of {r.calendarDate}</div> : null}
      </Center>
    </ReportsFrame>
  );
}

export function VO2Max({ dateISO, results }) {
  const list = ok(results, 'range') || []; const latest = [...(Array.isArray(list) ? list : [])].reverse().find((m) => m.generic && m.generic.vo2MaxValue) || first(list) || {};
  const v = latest.generic ? latest.generic.vo2MaxValue : null;
  const label = v === null ? null : v >= 50 ? 'Excellent' : v >= 43 ? 'Good' : v >= 38 ? 'Fair' : 'Poor';
  return (
    <ReportsFrame dateISO={dateISO} active="vo2-max" title="VO₂ Max" exportLink>
      <Center>
        {v === null ? <EmptyState icon="training" title="No VO2 Max data" sub="Record runs with heart rate to estimate VO2 max." /> : (
          <>
            <div style={{ display: 'inline-block' }}><ArcGauge value={v} /></div>
            <div style={{ fontSize: 16, marginTop: 8 }}>{label}</div>
            <Para style={{ maxWidth: 380, margin: '8px auto' }}>Your VO₂ Max is <strong>{v}</strong> which is {label ? label.toLowerCase() : ''} for men ages 30-39. You are in the <strong>top {v >= 50 ? '15%' : v >= 43 ? '35%' : '60%'}</strong> for your age and gender.</Para>
            <Link to={`/garmin/${dateISO}/fitness-age`} style={{ fontSize: 12, color: G.blue }}>View Your Fitness Age</Link>
          </>
        )}
      </Center>
    </ReportsFrame>
  );
}

export function TrainingEffect({ dateISO, results, slug }) {
  const status = ok(results, 'status') || {}; const readiness = first(ok(results, 'readiness'));
  const d = status.mostRecentTrainingStatus && status.mostRecentTrainingStatus.latestTrainingStatusData; const dev = d && Object.values(d)[0];
  return (
    <ReportsFrame dateISO={dateISO} active="training-effect" title="Training Effect" ranges={false}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${G.border}`, paddingBottom: 12, marginBottom: 24 }}>
        <DateControls dateISO={dateISO} to={pageTo(slug)} step={7} showToday={false} />
        <RangeControl options={[{ key: '7d', label: '7 Days' }, { key: '4w', label: '4 Weeks' }]} value="7d" onChange={() => {}} />
      </div>
      <Center>
        {dev || readiness ? (
          <StatRow style={{ display: 'inline-grid', textAlign: 'left' }}>
            <StatPair value={dev ? (dev.trainingStatusFeedbackPhrase || dev.trainingStatus || '').replace(/_/g, ' ') : null} label="Training Status" />
            <StatPair value={dev && dev.loadLevelTrend ? String(dev.loadLevelTrend).replace(/_/g, ' ') : null} label="Load Trend" />
            <StatPair value={readiness ? readiness.score : null} label="Training Readiness" />
            <StatPair value={readiness && readiness.level ? readiness.level.replace(/_/g, ' ') : null} label="Readiness Level" />
          </StatRow>
        ) : (
          <>
            <Para style={{ fontSize: 16, fontWeight: 300, maxWidth: 420, margin: '20px auto 14px', lineHeight: 1.5 }}>Training Effect is measured from 0 to 5 and tells you how a specific activity has impacted your overall training.</Para>
            <LinkButton href="https://support.garmin.com/" style={{ ...{ background: G.blue, color: 'white', padding: '6px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600 } }}>Learn More</LinkButton>
          </>
        )}
      </Center>
    </ReportsFrame>
  );
}

export function Reports({ dateISO, results, slug }) {
  const prog = ok(results, 'progress') || {};
  const stats = Array.isArray(prog.stats) ? prog.stats : (prog.stats ? Object.values(prog.stats) : []);
  return (
    <ReportsFrame dateISO={dateISO} active="all:Activities" title="Activities" ranges={false}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${G.border}`, paddingBottom: 12, marginBottom: 24 }}>
        <DateControls dateISO={dateISO} to={pageTo(slug)} step={7} showToday={false} />
        <RangeControl options={[{ key: '7d', label: '7 Days' }, { key: '4w', label: '4 Weeks' }, { key: '6m', label: '6 Months' }, { key: '1y', label: '1 Year' }]} value="7d" onChange={() => {}} />
      </div>
      {stats.length ? (
        <StatRow>{stats.slice(0, 8).map((st, i) => <StatPair key={i} value={num(st.count || st.value)} label={(st.activityType || st.key || 'Activities').replace(/_/g, ' ')} />)}</StatRow>
      ) : <Center style={{ fontSize: 14, fontWeight: 300, padding: '20px 0' }}>You have no data for this time period.</Center>}
    </ReportsFrame>
  );
}
