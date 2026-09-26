import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopNav from '../components/TopNav';
import HealthCard from '../components/health/HealthCard';
import StatTile, { tileGrid } from '../components/health/StatTile';
import Sparkline from '../components/health/Sparkline';
import EndpointExplorer from '../components/health/EndpointExplorer';
import { getGarminDay, getGarminStatus } from '../services/api';
import { longDate } from '../utils/dayInfo';
import {
  num, metersToMiles, gramsToLbs, mlToOz, secondsToHm, clock, localOffset, series, titleCase,
} from '../utils/garminFormat';
import { COLORS, uppercaseHeading, outlineButton } from '../styles';

const MAX_WIDTH = 1500;

const pick = (r, key) => (r && r[key] && r[key].ok ? r[key].data : null);
const first = (v) => (Array.isArray(v) ? v[0] : v);

// Sleep stage swatches: one ink ramp, darkest = deepest. Always labeled.
const STAGES = [
  { key: 'deepSleepSeconds', label: 'Deep', color: COLORS.ink },
  { key: 'lightSleepSeconds', label: 'Light', color: COLORS.muted },
  { key: 'remSleepSeconds', label: 'REM', color: COLORS.accent },
  { key: 'awakeSleepSeconds', label: 'Awake', color: COLORS.hairline },
];

export default function HealthView() {
  const { date } = useParams();
  const [bundle, setBundle] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExplorer, setShowExplorer] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([getGarminStatus(), getGarminDay(date, { refresh })]);
      setStatus(s);
      setBundle(b);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { setBundle(null); load(); }, [load]);

  const r = bundle && bundle.results;
  const summary = pick(r, 'summary');
  const sleep = pick(r, 'sleep');
  const sleepDto = sleep && sleep.dailySleepDTO;
  const hr = pick(r, 'heart_rate');
  const stress = pick(r, 'stress');
  const bb = first(pick(r, 'body_battery'));
  const hrv = pick(r, 'hrv');
  const hrvSummary = hrv && hrv.hrvSummary;
  const spo2 = pick(r, 'spo2');
  const resp = pick(r, 'respiration');
  const readiness = first(pick(r, 'training_readiness'));
  const tstatus = pick(r, 'training_status');
  const maxMet = first(pick(r, 'max_metrics'));
  const fitAge = pick(r, 'fitness_age');
  const activities = pick(r, 'activities') || [];
  const weighIns = pick(r, 'weigh_ins');
  const weight = weighIns && Array.isArray(weighIns.dateWeightList) ? weighIns.dateWeightList[0] : null;
  const hydration = pick(r, 'hydration');
  const im = pick(r, 'intensity_minutes');
  const steps = pick(r, 'steps') || [];

  const failed = r ? Object.entries(r).filter(([, v]) => !v.ok) : [];
  const authFailed = failed.some(([, v]) => v.code === 'auth' || v.code === 'mfa_required');
  const connected = status && status.connected;

  const vo2 = (maxMet && maxMet.generic && maxMet.generic.vo2MaxValue)
    || (tstatus && tstatus.mostRecentVO2Max && tstatus.mostRecentVO2Max.generic && tstatus.mostRecentVO2Max.generic.vo2MaxValue)
    || null;
  const trainingPhrase = (() => {
    const d = tstatus && tstatus.mostRecentTrainingStatus && tstatus.mostRecentTrainingStatus.latestTrainingStatusData;
    const firstDevice = d && Object.values(d)[0];
    return firstDevice ? titleCase(firstDevice.trainingStatusFeedbackPhrase || firstDevice.trainingStatus) : null;
  })();

  const stepPoints = steps.map((b) => [Date.parse(`${String(b.startGMT).replace(/\.\d+$/, '')}Z`), b.steps]).filter((p) => !Number.isNaN(p[0]));
  const hasStepSeries = stepPoints.some((p) => p[1] > 0);
  const stageTotal = sleepDto ? STAGES.reduce((n, s) => n + (sleepDto[s.key] || 0), 0) : 0;
  const sleepScore = sleepDto && sleepDto.sleepScores && sleepDto.sleepScores.overall ? sleepDto.sleepScores.overall.value : null;

  const shell = (inner) => (
    <div>
      <TopNav dateISO={date} section="health" />
      <div style={{ maxWidth: MAX_WIDTH, margin: '0 auto', padding: '32px min(24px, 4vw) 64px min(24px, 4vw)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={uppercaseHeading}>Health</div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>{longDate(date)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: COLORS.muted }}>
            {bundle && bundle.fetched_at ? <span>Garmin data as of {new Date(bundle.fetched_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span> : null}
            <button disabled={loading || !connected} onClick={() => load(true)} style={outlineButton(COLORS.ink, { small: true, disabled: loading || !connected })}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        {inner}
      </div>
    </div>
  );

  if (error) return shell(<div style={{ color: COLORS.danger }}>Error: {error}</div>);
  if (!bundle && loading) return shell(<div style={{ color: COLORS.muted }}>Loading Garmin data...</div>);

  if (status && (!connected || authFailed)) {
    return shell(
      <div style={{ background: COLORS.paper, border: `1px solid ${COLORS.ink}`, padding: 20, maxWidth: 560, fontSize: 13, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Garmin Connect is not signed in.</div>
        {!status.configured ? (
          <div>Add <code>GARMIN_EMAIL</code> and <code>GARMIN_PASSWORD</code> to <code>backend/.env</code> on the server, then sign in from Settings.</div>
        ) : !status.python_ok ? (
          <div>The Garmin Python client is missing on the server. See the Garmin section of <code>deploy/README.md</code>.</div>
        ) : (
          <div>Open <strong>Settings</strong> in the header and click <strong>Sign in</strong> under Garmin Connect.</div>
        )}
      </div>
    );
  }

  const stressPts = series(stress && stress.stressValuesArray).filter((p) => p[1] >= 0);
  const bbPts = series(bb && bb.bodyBatteryValuesArray);
  const hrPts = series(hr && hr.heartRateValues);

  return shell(
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
        <HealthCard title="Day Summary" span={2} empty={!summary}>
          {summary ? (
            <div style={tileGrid(120)}>
              <StatTile label="Steps" value={num(summary.totalSteps)} sub={summary.dailyStepGoal ? `goal ${num(summary.dailyStepGoal)}` : null} />
              <StatTile label="Distance" value={num(metersToMiles(summary.totalDistanceMeters), 2)} unit="mi" />
              <StatTile label="Active Cal" value={num(summary.activeKilocalories)} sub={summary.totalKilocalories ? `${num(summary.totalKilocalories)} total` : null} />
              <StatTile label="Floors" value={num(summary.floorsAscended)} sub={summary.userFloorsAscendedGoal ? `goal ${summary.userFloorsAscendedGoal}` : null} />
              <StatTile label="Intensity Min" value={num((summary.moderateIntensityMinutes || 0) + 2 * (summary.vigorousIntensityMinutes || 0))} sub={im && im.weekGoal ? `${num(im.weeklyTotal)} of ${num(im.weekGoal)} this week` : null} />
              <StatTile label="Resting HR" value={num(summary.restingHeartRate)} unit="bpm" sub={summary.lastSevenDaysAvgRestingHeartRate ? `7-day avg ${summary.lastSevenDaysAvgRestingHeartRate}` : null} />
              <StatTile label="Avg Stress" value={num(summary.averageStressLevel)} sub={summary.maxStressLevel ? `max ${summary.maxStressLevel}` : null} />
              <StatTile label="Body Battery" value={summary.bodyBatteryHighestValue !== undefined && summary.bodyBatteryHighestValue !== null ? `${summary.bodyBatteryHighestValue} / ${summary.bodyBatteryLowestValue}` : null} sub="high / low" />
              <StatTile label="Active Time" value={secondsToHm(summary.activeSeconds)} sub={summary.sedentarySeconds ? `${secondsToHm(summary.sedentarySeconds)} sedentary` : null} />
            </div>
          ) : null}
          {hasStepSeries ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.muted, marginBottom: 4 }}>Steps per 15 minutes</div>
              <Sparkline points={stepPoints} bars offset={localOffset(hr || stress || summary)} min={0} />
            </div>
          ) : null}
        </HealthCard>

        <HealthCard title="Sleep" empty={!sleepDto || !sleepDto.sleepTimeSeconds}>
          {sleepDto && sleepDto.sleepTimeSeconds ? (
            <>
              <div style={tileGrid(100)}>
                <StatTile label="Duration" value={secondsToHm(sleepDto.sleepTimeSeconds)} />
                <StatTile label="Score" value={sleepScore} sub={sleepDto.sleepScores && sleepDto.sleepScores.overall ? titleCase(sleepDto.sleepScores.overall.qualifierKey) : null} />
                <StatTile label="Bedtime" value={clock(sleepDto.sleepStartTimestampLocal)} size={16} />
                <StatTile label="Wake" value={clock(sleepDto.sleepEndTimestampLocal)} size={16} />
              </div>
              {stageTotal ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', height: 14, gap: 2 }}>
                    {STAGES.map((s) => (sleepDto[s.key] ? (
                      <div key={s.key} title={`${s.label} ${secondsToHm(sleepDto[s.key])}`} style={{ flex: sleepDto[s.key], background: s.color, borderRadius: 2 }} />
                    ) : null))}
                  </div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 11, color: COLORS.muted }}>
                    {STAGES.map((s) => (
                      <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 10, height: 10, background: s.color, borderRadius: 2, display: 'inline-block' }} />
                        {s.label} {secondsToHm(sleepDto[s.key] || 0)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </HealthCard>

        <HealthCard title="Heart Rate" empty={!hr || (!hrPts.length && !hr.restingHeartRate)}>
          {hr ? (
            <>
              <div style={tileGrid(90)}>
                <StatTile label="Resting" value={num(hr.restingHeartRate)} unit="bpm" />
                <StatTile label="Min" value={num(hr.minHeartRate)} unit="bpm" />
                <StatTile label="Max" value={num(hr.maxHeartRate)} unit="bpm" />
                <StatTile label="7-day RHR" value={num(hr.lastSevenDaysAvgRestingHeartRate)} unit="bpm" />
              </div>
              <div style={{ marginTop: 14 }}><Sparkline points={hrPts} offset={localOffset(hr)} unit=" bpm" /></div>
            </>
          ) : null}
        </HealthCard>

        <HealthCard title="Stress" empty={!stress || (!stressPts.length && stress.avgStressLevel === null)}>
          {stress ? (
            <>
              <div style={tileGrid(90)}>
                <StatTile label="Average" value={num(stress.avgStressLevel)} />
                <StatTile label="Max" value={num(stress.maxStressLevel)} />
                <StatTile label="Rest" value={summary && summary.restStressPercentage !== null ? `${num(summary.restStressPercentage)}%` : null} sub="of day" />
                <StatTile label="Stressed" value={summary && summary.stressPercentage !== null ? `${num(summary.stressPercentage)}%` : null} sub="of day" />
              </div>
              <div style={{ marginTop: 14 }}><Sparkline points={stressPts} offset={localOffset(stress)} min={0} max={100} color={COLORS.muted} /></div>
            </>
          ) : null}
        </HealthCard>

        <HealthCard title="Body Battery" empty={!bb || (!bbPts.length && !bb.charged && !bb.drained)}>
          {bb ? (
            <>
              <div style={tileGrid(90)}>
                <StatTile label="Charged" value={num(bb.charged)} />
                <StatTile label="Drained" value={num(bb.drained)} />
                <StatTile label="High" value={bbPts.length ? Math.max(...bbPts.map((p) => p[1])) : (summary ? summary.bodyBatteryHighestValue : null)} />
                <StatTile label="Low" value={bbPts.length ? Math.min(...bbPts.map((p) => p[1])) : (summary ? summary.bodyBatteryLowestValue : null)} />
              </div>
              <div style={{ marginTop: 14 }}><Sparkline points={bbPts} offset={localOffset(bb)} min={0} max={100} color={COLORS.garmin} /></div>
            </>
          ) : null}
        </HealthCard>

        <HealthCard title="Recovery" empty={!hrvSummary && !(spo2 && spo2.averageSpO2) && !(resp && (resp.avgWakingRespirationValue || resp.avgSleepRespirationValue))}>
          <div style={tileGrid(110)}>
            <StatTile label="HRV last night" value={num(hrvSummary && hrvSummary.lastNightAvg)} unit="ms" sub={hrvSummary && hrvSummary.status ? titleCase(hrvSummary.status) : null} />
            <StatTile label="HRV 7-day" value={num(hrvSummary && hrvSummary.weeklyAvg)} unit="ms" sub={hrvSummary && hrvSummary.baseline ? `baseline ${hrvSummary.baseline.balancedLow} to ${hrvSummary.baseline.balancedUpper}` : null} />
            <StatTile label="SpO2 avg" value={num(spo2 && spo2.averageSpO2)} unit="%" sub={spo2 && spo2.lowestSpO2 ? `low ${spo2.lowestSpO2}%` : null} />
            <StatTile label="SpO2 sleep" value={num(spo2 && spo2.avgSleepSpO2)} unit="%" />
            <StatTile label="Resp. awake" value={num(resp && resp.avgWakingRespirationValue)} unit="brpm" />
            <StatTile label="Resp. sleep" value={num(resp && resp.avgSleepRespirationValue)} unit="brpm" sub={resp && resp.lowestRespirationValue ? `${resp.lowestRespirationValue} to ${resp.highestRespirationValue}` : null} />
          </div>
        </HealthCard>

        <HealthCard title="Training" empty={!readiness && !trainingPhrase && !vo2 && !(fitAge && fitAge.fitnessAge)}>
          <div style={tileGrid(110)}>
            <StatTile label="Readiness" value={readiness ? readiness.score : null} sub={readiness && readiness.level ? titleCase(readiness.level) : null} />
            <StatTile label="Status" value={trainingPhrase} size={15} />
            <StatTile label="VO2 max" value={num(vo2)} />
            <StatTile label="Fitness age" value={fitAge && fitAge.fitnessAge ? num(fitAge.fitnessAge) : null} sub={fitAge && fitAge.chronologicalAge ? `actual ${fitAge.chronologicalAge}, achievable ${num(fitAge.achievableFitnessAge)}` : null} />
          </div>
        </HealthCard>

        <HealthCard title="Body and Hydration" empty={!weight && !(hydration && (hydration.valueInML || hydration.goalInML))}>
          <div style={tileGrid(110)}>
            <StatTile label="Weight" value={weight ? num(gramsToLbs(weight.weight), 1) : null} unit="lb" sub={weight && weight.bmi ? `BMI ${num(weight.bmi, 1)}` : null} />
            <StatTile label="Body fat" value={weight && weight.bodyFat ? num(weight.bodyFat, 1) : null} unit="%" />
            <StatTile label="Water" value={hydration ? num(mlToOz(hydration.valueInML)) : null} unit="oz" sub={hydration && hydration.goalInML ? `goal ${num(mlToOz(hydration.goalInML))} oz` : null} />
            <StatTile label="Sweat loss" value={hydration && hydration.sweatLossInML ? num(mlToOz(hydration.sweatLossInML)) : null} unit="oz" />
          </div>
        </HealthCard>

        <HealthCard title="Activities" span={2} empty={activities.length === 0} aside={activities.length ? `${activities.length} recorded` : null}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: COLORS.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'left' }}>
                  {['Time', 'Activity', 'Type', 'Duration', 'Distance', 'Avg HR', 'Calories'].map((h) => (
                    <th key={h} style={{ padding: '4px 8px 6px 0', borderBottom: `1px solid ${COLORS.hairline}`, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.activityId} style={{ borderBottom: `1px solid ${COLORS.hairline}` }}>
                    <td style={{ padding: '6px 8px 6px 0', whiteSpace: 'nowrap' }}>{a.startTimeLocal ? clock(Date.parse(`${String(a.startTimeLocal).replace(' ', 'T')}Z`)) : '-'}</td>
                    <td style={{ padding: '6px 8px 6px 0' }}>
                      <a href={`https://connect.garmin.com/modern/activity/${a.activityId}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{a.activityName || 'Activity'}</a>
                    </td>
                    <td style={{ padding: '6px 8px 6px 0' }}>{a.activityType ? titleCase(a.activityType.typeKey) : '-'}</td>
                    <td style={{ padding: '6px 8px 6px 0', whiteSpace: 'nowrap' }}>{secondsToHm(a.duration) || '-'}</td>
                    <td style={{ padding: '6px 8px 6px 0', whiteSpace: 'nowrap' }}>{a.distance ? `${num(metersToMiles(a.distance), 2)} mi` : '-'}</td>
                    <td style={{ padding: '6px 8px 6px 0' }}>{a.averageHR ? `${num(a.averageHR)} bpm` : '-'}</td>
                    <td style={{ padding: '6px 8px 6px 0' }}>{num(a.calories) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HealthCard>
      </div>

      {failed.length && !authFailed ? (
        <div style={{ marginTop: 12, fontSize: 11, color: COLORS.danger }}>
          Garmin did not return: {failed.map(([k, v]) => `${k} (${v.error || v.code})`).join(', ')}
        </div>
      ) : null}

      <section style={{ marginTop: 32, background: COLORS.paper, border: `1px solid ${COLORS.ink}`, padding: '12px 16px' }}>
        <button
          type="button"
          onClick={() => setShowExplorer((s) => !s)}
          style={{ width: '100%', background: 'transparent', border: 'none', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: COLORS.ink }}
        >
          <span style={{ fontStyle: 'italic', fontSize: 13, fontWeight: 500 }}>All Garmin Endpoints</span>
          <span style={{ color: COLORS.accent, fontSize: 14 }}>{showExplorer ? '▾' : '▸'}</span>
        </button>
        {showExplorer ? <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.ink}`, paddingTop: 8 }}><EndpointExplorer dateISO={date} /></div> : null}
      </section>
      <div style={{ marginTop: 10, fontSize: 11, color: COLORS.faint }}>
        Data from <Link to={`/agenda/${date}`} style={{ textDecoration: 'underline' }}>the agenda's</Link> date, pulled from connect.garmin.com through the Planner backend.
      </div>
    </>
  );
}
