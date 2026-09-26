import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MetricFrame, DailyTimeline, DailyBars, ok, first, Center, Para, pageTo } from './common';
import { PageContainer, PageTitle, TwoCol, SectionHeading, EmptyState, RingGauge, StatPair, StatRow, BlueButton, GrayButton, OutlinedButton, LinkButton, Notice, DateControls, InfoDot } from '../../garmin';
import GarminIcon from '../GarminIcon';
import { G, sectionLabel, dateTitle, pillButton, chevronButton, syncedText } from '../../../garminTheme';
import { metersToMiles, gramsToLbs, clock } from '../../../utils/garminFormat';
import { num, secondsToHm, titleCase } from '../../../shared/format';
import { shiftISO, todayISO, longDate } from '../../../shared/dayInfo';

const hm = (sec) => (sec ? secondsToHm(sec).replace('h ', 'h ').replace(/(\d+)m$/, '$1min') : '--');

export function Steps({ dateISO, range, setRange, results, slug }) {
  const summary = ok(results, 'summary') || {};
  const buckets = ok(results, 'buckets') || [];
  const daily = ok(results, 'daily') || [];
  const total = summary.totalSteps; const goal = summary.dailyStepGoal;
  const empty = !total && !daily.some((d) => d.totalSteps);
  return (
    <MetricFrame title="Steps" slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w', '1y']}>
      {empty ? <EmptyState icon="steps" title="No steps data" sub="You have no data for this time period." /> : range === '1d' ? (
        <TwoCol
          left={<>
            <SectionHeading>Summary</SectionHeading>
            <Center style={{ marginTop: 20 }}><div style={{ display: 'inline-block' }}><RingGauge value={total} goal={goal} color={G.metric.stepsFill} check /></div></Center>
            <StatRow style={{ marginTop: 24 }}>
              <StatPair value={num(metersToMiles(summary.totalDistanceMeters), 1)} unit="mi" label="Distance" />
              <StatPair value={num(summary.totalKilocalories)} label="Calories" />
            </StatRow>
          </>}
          right={<DailyTimeline payload={{ startTimestampGMT: summary.wellnessStartTimeGmt, startTimestampLocal: summary.wellnessStartTimeLocal, pts: buckets.map((b) => [Date.parse(`${String(b.startGMT).replace(/\.\d+$/, '')}Z`), b.steps]) }} arrayKey="pts" bars color={G.metric.stepsFill} min={0} />}
        />
      ) : (
        <>
          <DailyBars rows={daily} valueKey="totalSteps" color={G.metric.stepsFill} title="Steps by day" />
          <StatRow style={{ marginTop: 24 }}>
            <StatPair value={num(daily.reduce((n, d) => n + (d.totalSteps || 0), 0))} label="Total Steps" />
            <StatPair value={num(daily.length ? daily.reduce((n, d) => n + (d.totalSteps || 0), 0) / daily.length : null)} label="Daily Avg" />
            <StatPair value={num(metersToMiles(daily.reduce((n, d) => n + (d.totalDistance || 0), 0)), 1)} unit="mi" label="Distance" />
            <StatPair value={num(first(daily) && first(daily).stepGoal)} label="Daily Goal" />
          </StatRow>
        </>
      )}
    </MetricFrame>
  );
}

export function Floors({ dateISO, range, setRange, results, slug }) {
  const s = ok(results, 'summary') || {};
  const up = s.floorsAscended; const goal = s.userFloorsAscendedGoal;
  return (
    <MetricFrame title="Floors" info={false} slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w', '1y']}>
      {!up && !s.floorsDescended ? <EmptyState icon="floors" title="No floors data" sub="You have no data for this time period." /> : (
        <TwoCol
          left={<>
            <SectionHeading>Summary</SectionHeading>
            <Center style={{ marginTop: 20 }}><div style={{ display: 'inline-block' }}><RingGauge value={Math.round(up || 0)} goal={goal} color={G.metric.stepsFill} check /></div></Center>
            <StatRow style={{ marginTop: 24 }}>
              <StatPair value={num(s.floorsDescended)} label="Down" />
              <StatPair value={num(goal)} label="Daily Goal" />
            </StatRow>
          </>}
          right={<DailyTimeline payload={ok(results, 'floors') || {}} arrayKey="floorValuesArray" bars color={G.metric.stepsFill} min={0} />}
        />
      )}
    </MetricFrame>
  );
}

export function IntensityMinutes({ dateISO, range, setRange, results, slug }) {
  const im = ok(results, 'im') || {};
  const weekly = ok(results, 'weekly') || [];
  const today = (im.moderateMinutes || 0) + 2 * (im.vigorousMinutes || 0);
  return (
    <MetricFrame title="Intensity Minutes" slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w', '1y']}>
      {!im.weeklyTotal && !today ? <EmptyState icon="intensity" title="No intensity minutes data" sub="You have no data for this time period." /> : (
        <TwoCol
          left={<>
            <SectionHeading>Summary</SectionHeading>
            <Center style={{ marginTop: 20 }}><div style={{ display: 'inline-block' }}><RingGauge value={im.weeklyTotal} goal={im.weekGoal} color={G.metric.intensityFill} label={`/ ${num(im.weekGoal)} weekly`} /></div></Center>
            <StatRow style={{ marginTop: 24 }}>
              <StatPair value={num(today)} label="Today" />
              <StatPair value={num(im.moderateMinutes)} label="Moderate" />
              <StatPair value={num(im.vigorousMinutes)} label="Vigorous" />
            </StatRow>
          </>}
          right={<DailyBars rows={weekly.map((w) => ({ calendarDate: w.calendarDate, value: (w.values && w.values.totalIntensityMinutes) || 0 }))} valueKey="value" color={G.metric.intensityFill} title="Weekly" />}
        />
      )}
    </MetricFrame>
  );
}

const STAGES = [['deepSleepSeconds', 'Deep', G.sleep.deep], ['lightSleepSeconds', 'Light', G.sleep.light], ['remSleepSeconds', 'REM', G.sleep.rem], ['awakeSleepSeconds', 'Awake', G.sleep.awake]];
export function Sleep({ dateISO, range, setRange, results, slug }) {
  const [tabv, setTab] = useState('score');
  const dto = (ok(results, 'sleep') || {}).dailySleepDTO || {};
  const daily = ok(results, 'daily') || [];
  const has = !!dto.sleepTimeSeconds;
  const score = dto.sleepScores && dto.sleepScores.overall ? dto.sleepScores.overall.value : null;
  return (
    <MetricFrame title="Sleep" slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w', '1y']} tabs={[{ key: 'score', label: 'Sleep Score' }, { key: 'coach', label: 'Sleep Coach' }]} tabValue={tabv} onTab={setTab}>
      {tabv === 'coach' ? (
        <EmptyState icon="sleep" title="Sleep Coach" sub={dto.sleepNeed ? `Sleep need: ${secondsToHm((dto.sleepNeed.actual || 0) * 60)} (baseline ${secondsToHm((dto.sleepNeed.baseline || 0) * 60)}). ${titleCase(dto.sleepNeed.feedback || '')}` : 'Sleep Coach needs a night of sleep data to make a recommendation.'} learnMore="https://support.garmin.com/" />
      ) : !has && range === '1d' ? (
        <>
          <EmptyState icon="sleep" title="No sleep data" sub="To receive sleep data, wear your Garmin device while sleeping." button={<BlueButton>Add Manual Sleep</BlueButton>} learnMore="https://support.garmin.com/" />
          <div style={{ background: G.border, padding: '10px 14px', fontSize: 12, fontWeight: 600, display: 'flex', justifyContent: 'space-between', maxWidth: 400, margin: '0 auto' }}>Recommended for you <span style={{ color: G.muted, fontWeight: 400 }}>×</span></div>
        </>
      ) : range === '1d' ? (
        <TwoCol
          left={<>
            <SectionHeading>Summary</SectionHeading>
            <Center style={{ marginTop: 20 }}><div style={{ display: 'inline-block' }}><RingGauge value={score} goal={100} color={G.sleep.light} label="Sleep Score" /></div></Center>
            <StatRow style={{ marginTop: 24 }}>
              <StatPair value={secondsToHm(dto.sleepTimeSeconds)} label="Total Sleep" />
              <StatPair value={`${clock(dto.sleepStartTimestampLocal)} to ${clock(dto.sleepEndTimestampLocal)}`} label="Bedtime to Wake" small />
            </StatRow>
          </>}
          right={<>
            <SectionHeading>Sleep Stages</SectionHeading>
            <div style={{ display: 'flex', height: 20, marginTop: 12 }}>{STAGES.map(([k, , c]) => dto[k] ? <div key={k} style={{ flex: dto[k], background: c }} /> : null)}</div>
            <StatRow style={{ marginTop: 16 }}>{STAGES.map(([k, l, c]) => <StatPair key={k} value={secondsToHm(dto[k])} label={l} dot={c} small />)}</StatRow>
          </>}
        />
      ) : (
        <DailyBars rows={daily.map((d) => ({ calendarDate: d.calendarDate, value: d.values ? (d.values.totalSleepSeconds || 0) / 3600 : (d.sleepTimeSeconds || 0) / 3600 }))} valueKey="value" color={G.sleep.light} unit=" h" title="Sleep by day (hours)" />
      )}
    </MetricFrame>
  );
}

export function HealthStatus({ dateISO, results, slug }) {
  const hr = ok(results, 'hr') || {}; const hrv = (ok(results, 'hrv') || {}).hrvSummary || {}; const resp = ok(results, 'resp') || {}; const spo2 = ok(results, 'spo2') || {};
  const rows = [
    ['Heart Rate', hr.restingHeartRate ? `${hr.restingHeartRate} bpm` : null],
    ['HRV', hrv.lastNightAvg ? `${hrv.lastNightAvg} ms` : null],
    ['Respiration', resp.avgSleepRespirationValue ? `${resp.avgSleepRespirationValue} brpm` : null],
    ['Skin Temp', null, 'Not supported'],
    ['Pulse Ox', spo2.avgSleepSpO2 ? `${spo2.avgSleepSpO2}%` : null],
  ];
  const any = rows.some((r) => r[1]);
  return (
    <PageContainer>
      <PageTitle right={<button type="button" style={{ background: 'transparent', border: 'none', color: G.muted, cursor: 'pointer' }} aria-label="Settings"><GarminIcon name="settings" color={G.muted} size={18} /></button>}>Health Status</PageTitle>
      <div style={{ marginBottom: 20 }}><DateControls dateISO={dateISO} to={pageTo(slug)} /></div>
      <TwoCol ratio="1fr 1fr" left={<>
        <SectionHeading>{any ? 'Overnight averages' : 'No data available'}</SectionHeading>
        <Para style={{ color: G.muted }}>{any ? 'Values measured while you slept.' : 'Wear your device while sleeping to reveal your metrics.'}</Para>
      </>} right={<>
        <div style={{ ...sectionLabel, fontSize: 10, marginBottom: 8 }}>{any ? 'Last night' : 'No data'}</div>
        {rows.map(([label, value, note]) => (
          <div key={label} style={{ border: `1px solid ${G.border}`, borderRadius: 4, padding: '10px 14px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: 14 }}>{label}</div><div style={{ fontSize: 11, color: G.muted }}>{note || (value ? 'Within baseline' : 'No data')}</div></div>
            <div style={{ fontSize: 18, fontWeight: 300 }}>{value || '--'}</div>
          </div>
        ))}
      </>} />
    </PageContainer>
  );
}

export function Weight({ dateISO, range, setRange, results, slug }) {
  const rangeData = ok(results, 'range') || {}; const list = rangeData.dateWeightList || [];
  const today = ((ok(results, 'today') || {}).dateWeightList || [])[0];
  return (
    <MetricFrame title="Weight" slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w', '1y']} narrow>
      {!today && !list.length ? <EmptyState icon="weight" title="No weight data" sub="You have no data for this time period." /> : (
        <StatRow style={{ margin: '8px 0 24px' }}>
          <StatPair value={num(gramsToLbs((today || list[0]).weight), 1)} unit="lb" label="Weight" />
          <StatPair value={(today || list[0]).bmi ? num((today || list[0]).bmi, 1) : null} label="BMI" />
          <StatPair value={(today || list[0]).bodyFat ? num((today || list[0]).bodyFat, 1) : null} unit="%" label="Body Fat" />
        </StatRow>
      )}
      <SectionHeading>Weigh-ins</SectionHeading>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <BlueButton>Add Weight</BlueButton>
        <OutlinedButton>✎ Weight Goal</OutlinedButton>
      </div>
      {list.length ? (
        <div style={{ marginTop: 16 }}>{list.slice(0, 20).map((w, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${G.border}`, fontSize: 13, fontWeight: 300 }}><span>{w.calendarDate || (w.date ? new Date(w.date).toLocaleDateString() : '')}</span><span>{num(gramsToLbs(w.weight), 1)} lb</span></div>
        ))}</div>
      ) : null}
    </MetricFrame>
  );
}

export function BloodPressure({ dateISO, range, setRange, results, slug }) {
  const bp = ok(results, 'bp') || {}; const list = bp.measurementSummaries || bp.measurements || [];
  return (
    <MetricFrame title="Blood Pressure" slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w', '1y']}>
      {list.length ? (
        <div>{list.slice(0, 30).map((m, i) => <div key={i} style={{ display: 'flex', gap: 24, padding: '8px 0', borderBottom: `1px solid ${G.border}`, fontSize: 13, fontWeight: 300 }}><span>{m.measurementTimestampLocal || m.calendarDate}</span><span>{m.systolic}/{m.diastolic} mmHg</span><span>{m.pulse ? `${m.pulse} bpm` : ''}</span></div>)}</div>
      ) : <EmptyState icon="heart" iconColor={G.metric.heart} title="You have no data for this time period." />}
      <div style={{ marginTop: 16 }}><GrayButton style={{ fontSize: 12, padding: '6px 12px' }}>Add Reading</GrayButton></div>
      <div style={{ marginTop: 24, background: G.border, padding: 14, maxWidth: 420, fontSize: 12 }}><div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>Recommended for you <span style={{ color: G.muted, fontWeight: 400 }}>×</span></div><div style={{ fontWeight: 600, marginTop: 8 }}>Index™ BPM</div><div style={{ color: G.muted, marginTop: 4 }}>A smart blood pressure monitor that syncs to Garmin Connect.</div></div>
    </MetricFrame>
  );
}

// Daily-summary style header (label, blue date, Today / chevrons, Synced) used by Pulse Ox.
function SummaryHeader({ label, dateISO, slug, synced }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
      <div>
        <div style={{ ...sectionLabel, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{label} <InfoDot /></div>
        <div style={{ ...dateTitle, marginTop: 8 }}><GarminIcon name="calendar" color={G.blue} size={18} /><span>{longDate(dateISO).replace(/(\d+)(st|nd|rd|th)/, '$1,')}</span></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link to={pageTo(slug)(todayISO())} style={pillButton()}>Today</Link>
          <Link to={pageTo(slug)(shiftISO(dateISO, -1))} style={chevronButton}>‹</Link>
          <Link to={pageTo(slug)(shiftISO(dateISO, 1))} style={chevronButton}>›</Link>
        </div>
        {synced ? <span style={syncedText}>{synced}</span> : null}
      </div>
    </div>
  );
}

export function PulseOx({ dateISO, results, slug, synced }) {
  const s = ok(results, 'spo2') || {};
  return (
    <PageContainer flush style={{ background: 'transparent' }}>
      <SummaryHeader label="Pulse Ox" dateISO={dateISO} slug={slug} synced={synced} />
      {!s.averageSpO2 && !s.avgSleepSpO2 ? (
        <div style={{ textAlign: 'center', paddingTop: 30 }}><GarminIcon name="spo2" color={G.metric.heart} size={36} /><div style={{ fontSize: 18, fontWeight: 300, marginTop: 8 }}>No Pulse Ox Data</div></div>
      ) : (
        <StatRow><StatPair value={num(s.averageSpO2)} unit="%" label="Avg SpO2" /><StatPair value={num(s.avgSleepSpO2)} unit="%" label="Sleep Avg" /><StatPair value={num(s.lowestSpO2)} unit="%" label="Lowest" /><StatPair value={num(s.lastSevenDaysAvgSpO2)} unit="%" label="7-day Avg" /></StatRow>
      )}
    </PageContainer>
  );
}

export function PulseOxAcclimation({ dateISO, results, slug }) {
  const s = ok(results, 'spo2') || {};
  const isToday = dateISO === todayISO();
  return (
    <PageContainer flush style={{ background: 'transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ ...sectionLabel, display: 'inline-flex', alignItems: 'center', gap: 6 }}>Pulse Ox Acclimation <InfoDot /></div>
          <div style={{ fontSize: 22, fontWeight: 300, marginTop: 6 }}>{isToday ? 'Today' : longDate(dateISO)}</div>
          <div style={{ fontSize: 11, color: G.muted }}>Last Read{s.latestSpO2TimestampLocal ? ` ${clock(Date.parse(`${s.latestSpO2TimestampLocal}Z`))}` : ''}</div>
        </div>
        <div><Link to={pageTo(slug)(shiftISO(dateISO, -1))} style={chevronButton}>‹</Link><Link to={pageTo(slug)(shiftISO(dateISO, 1))} style={chevronButton}>›</Link></div>
      </div>
      <Center style={{ marginTop: 60, fontSize: 13 }}>
        {s.latestSpO2 ? <div style={{ fontSize: 44, fontWeight: 300 }}>{s.latestSpO2}%</div> : <div>You don't have Pulse Ox data for this day.</div>}
        <div style={{ marginTop: 6 }}><LinkButton href="https://connect.garmin.com/modern/pulse-ox-acclimation">Pulse Ox Acclimation Trends Over Time</LinkButton></div>
      </Center>
    </PageContainer>
  );
}

export function Respiration({ dateISO, range, setRange, results, slug }) {
  const r = ok(results, 'resp') || {};
  return (
    <MetricFrame title="Respiration" info={false} slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w']}>
      <DailyTimeline payload={r} arrayKey="respirationValuesArray" color={G.metric.respiration} unit=" brpm" legend={[{ label: 'Avg Respiration Rate', color: G.text, line: true }, { label: 'High', color: G.metric.respiration }, { label: 'Low', color: G.text }]} />
      <StatRow style={{ marginTop: 28 }}>
        <StatPair value={num(r.lowestRespirationValue)} unit="brpm" label="Lowest" />
        <StatPair value={num(r.highestRespirationValue)} unit="brpm" label="Highest" />
        <StatPair value={num(r.avgWakingRespirationValue)} unit="brpm" label="Awake Avg" />
        <StatPair value={num(r.avgSleepRespirationValue)} unit="brpm" label="Sleep Avg" />
      </StatRow>
    </MetricFrame>
  );
}

export function HeartRate({ dateISO, range, setRange, results, slug }) {
  const hr = ok(results, 'hr') || {}; const s = ok(results, 'summary') || {}; const rhr = ok(results, 'rhr') || [];
  const resting = hr.restingHeartRate || s.restingHeartRate;
  const empty = !resting && !(hr.heartRateValues || []).length && !rhr.length;
  return (
    <MetricFrame title="Heart Rate" info={false} slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w', '1y']}>
      {empty ? <EmptyState icon="heart" iconColor={G.text} title="No heart rate data" sub="You have no data for this time period." /> : range === '1d' ? (
        <>
          <DailyTimeline payload={hr} arrayKey="heartRateValues" color={G.metric.heart} unit=" bpm" legend={[{ label: 'Heart Rate', color: G.metric.heart, line: true }]} />
          <StatRow style={{ marginTop: 28 }}>
            <StatPair value={num(resting)} unit="bpm" label="Resting" />
            <StatPair value={num(hr.maxHeartRate || s.maxHeartRate)} unit="bpm" label="High" />
            <StatPair value={num(hr.minHeartRate || s.minHeartRate)} unit="bpm" label="Low" />
            <StatPair value={num(hr.lastSevenDaysAvgRestingHeartRate || s.lastSevenDaysAvgRestingHeartRate)} unit="bpm" label="7-day Avg Resting" />
          </StatRow>
        </>
      ) : <DailyBars rows={rhr} valueKey="value" color={G.metric.heart} unit=" bpm" title="Resting heart rate by day" />}
    </MetricFrame>
  );
}

export function FitnessAge({ results }) {
  const fa = ok(results, 'fa') || {};
  const comps = fa.components || {};
  const recs = [['vigorousMinutesAvg', 'Increase Vigorous Minutes', 'min per week'], ['vigorousDaysAvg', 'Increase Vigorous Days', 'days per week'], ['bmi', 'Reduce BMI', '']].filter(([k]) => comps[k]).sort((a, b) => (comps[a[0]].priority || 9) - (comps[b[0]].priority || 9));
  const pts = [['Target', fa.achievableFitnessAge], ['Fitness Age', fa.fitnessAge], ['Age', fa.chronologicalAge]];
  return (
    <PageContainer>
      <PageTitle info sub={fa.lastUpdated ? `Updated ${new Date(fa.lastUpdated).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : null}>Fitness Age</PageTitle>
      {!fa.fitnessAge ? <EmptyState icon="training" title="No fitness age yet" sub="Fitness Age needs a week of activity with heart rate data." /> : (
        <>
          <div style={{ position: 'relative', margin: '30px 40px 10px' }}>
            <div style={{ borderTop: `1px solid ${G.faint}`, position: 'absolute', left: 0, right: 0, top: 30 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {pts.map(([l, v]) => <div key={l} style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: G.muted }}>{l}</div><div style={{ width: 8, height: 8, borderRadius: '50%', background: G.text, margin: '10px auto' }} /><div style={{ fontSize: 18, fontWeight: 300 }}>{num(v, l === 'Age' ? 0 : 1)}</div></div>)}
            </div>
          </div>
          <Para style={{ textAlign: 'center' }}>You can reduce your fitness age up to {num((fa.fitnessAge || 0) - (fa.achievableFitnessAge || 0), 1)} years by focusing on the following.</Para>
          <div style={{ border: `1px solid ${G.border}`, borderRadius: 4, padding: '10px 14px', marginTop: 16 }}><div style={{ color: G.blue, fontSize: 14 }}>Add Weight</div><div style={{ fontSize: 11, color: G.muted }}>Manually add your weight or weigh yourself using a Garmin Index Smart Scale.</div></div>
          <div style={{ ...sectionLabel, fontSize: 10, marginTop: 20, marginBottom: 8 }}>Recommendations</div>
          {recs.map(([k, title, unit]) => (
            <div key={k} style={{ border: `1px solid ${G.border}`, borderRadius: 4, padding: '10px 14px', marginBottom: 10 }}>
              <div style={{ fontSize: 14 }}>{title}</div>
              <div style={{ fontSize: 11, color: G.muted }}>{k === 'bmi' ? `Weekly avg: ${num(comps[k].value, 1)}` : `Avg avg: ${num(comps[k].value, 1)} ${unit}`}</div>
              {comps[k].priority === 1 ? <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, background: G.border, borderRadius: 10, padding: '2px 8px' }}>Higher Priority</span> : null}
            </div>
          ))}
          <div style={{ ...sectionLabel, fontSize: 10, marginTop: 10 }}>On Target</div>
          {comps.rhr ? <div style={{ border: `1px solid ${G.border}`, borderRadius: 4, padding: '10px 14px', marginTop: 8 }}><div style={{ fontSize: 14 }}>Resting Heart Rate</div><div style={{ fontSize: 11, color: G.muted }}>{comps.rhr.value} bpm</div></div> : null}
        </>
      )}
    </PageContainer>
  );
}

export function Stress({ dateISO, range, setRange, results, slug }) {
  const st = ok(results, 'stress') || {}; const s = ok(results, 'summary') || {}; const weekly = ok(results, 'weekly') || [];
  const avg = st.avgStressLevel !== undefined && st.avgStressLevel !== null ? st.avgStressLevel : s.averageStressLevel;
  const segs = [['restStressDuration', 'Rest', G.metric.battery], ['lowStressDuration', 'Low', '#f5bf2a'], ['mediumStressDuration', 'Medium', G.metric.stress], ['highStressDuration', 'High', G.metric.heart]];
  const empty = avg === null || avg === undefined || avg < 0;
  return (
    <MetricFrame title="Stress" info={false} slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w', '1y']} right={<button type="button" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} aria-label="Settings"><GarminIcon name="settings" color={G.muted} size={18} /></button>}>
      {empty ? <EmptyState icon="stress" title="No stress data" sub="You have no data for this time period." /> : range === '1d' ? (
        <>
          {!s.sleepingSeconds ? <Notice style={{ marginBottom: 20 }}>It looks like you may not have worn your device to sleep on this day. Wearing your device both day and night will return the most consistent, accurate results.</Notice> : null}
          <TwoCol
            left={<>
              <SectionHeading>Summary</SectionHeading>
              <Center style={{ marginTop: 16 }}><div style={{ display: 'inline-block' }}><RingGauge value={avg} label="Stress Level" segments={segs.map(([k, , c]) => ({ value: s[k] || 0, color: c }))} /></div></Center>
              <StatRow cols="1fr 1fr" style={{ marginTop: 20, maxWidth: 260 }}>{segs.map(([k, l, c]) => <StatPair key={k} value={hm(s[k])} label={l} dot={c} small />)}</StatRow>
              <Para style={{ marginTop: 18 }}>Your stress level was {avg} out of 100.</Para>
              <Para style={{ color: G.muted }}>{avg < 26 ? 'You had many restful moments on this day. This will help keep you energized. Your stress level is determined by your recorded stress reactions throughout the day.' : avg < 51 ? 'You had a balanced day with some stress. Your stress level is determined by your recorded stress reactions throughout the day.' : 'This was a stressful day. Consider a breathing exercise or a walk to recover.'}</Para>
            </>}
            right={<DailyTimeline payload={st} arrayKey="stressValuesArray" color={G.metric.stress} min={0} max={100} />}
          />
        </>
      ) : <DailyBars rows={weekly.map((w) => ({ calendarDate: w.calendarDate, value: (w.values && (w.values.averageStressLevel || w.values.avgStressLevel)) || 0 }))} valueKey="value" color={G.metric.stress} title="Average stress by week" />}
    </MetricFrame>
  );
}

export function BodyBattery({ dateISO, range, setRange, results, slug }) {
  const bb = first(ok(results, 'bb')) || {}; const s = ok(results, 'summary') || {};
  const has = (bb.bodyBatteryValuesArray || []).some((p) => p && p[1] !== null) || s.bodyBatteryMostRecentValue;
  return (
    <MetricFrame title="Body Battery" slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w']}>
      {!has ? <EmptyState icon="battery" title="No Body Battery" sub="You have no data for this time period." /> : (
        <>
          <DailyTimeline payload={bb} arrayKey="bodyBatteryValuesArray" color={G.metric.battery} min={0} max={100} />
          <StatRow style={{ marginTop: 28 }}>
            <StatPair value={s.bodyBatteryMostRecentValue} label="Current" />
            <StatPair value={bb.charged !== undefined ? `+${bb.charged}` : null} label="Charged" />
            <StatPair value={bb.drained !== undefined ? `-${bb.drained}` : null} label="Drained" />
            <StatPair value={s.bodyBatteryHighestValue} label="High" />
            <StatPair value={s.bodyBatteryLowestValue} label="Low" />
          </StatRow>
        </>
      )}
    </MetricFrame>
  );
}

export function HealthSnapshot() {
  return (
    <PageContainer flush style={{ background: 'transparent' }}>
      <div style={{ fontSize: 22, fontWeight: 300, display: 'inline-flex', alignItems: 'center', gap: 8 }}>Health Snapshot <InfoDot /></div>
      <Center style={{ marginTop: 40 }}>
        <GarminIcon name="newsfeed" color={G.metric.heart} size={40} />
        <div style={{ fontSize: 22, fontWeight: 300, marginTop: 10 }}>No Health Snapshots</div>
        <Para style={{ maxWidth: 300, margin: '8px auto 16px', color: G.muted }}>Health Snapshot provides a glimpse of your overall health at a given moment. Take a reading on your device to get started.</Para>
        <BlueButton onClick={() => window.open('https://support.garmin.com/', '_blank')}>Learn More</BlueButton>
      </Center>
    </PageContainer>
  );
}
