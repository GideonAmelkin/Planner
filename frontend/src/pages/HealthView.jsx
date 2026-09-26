import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TopNav from '../components/TopNav';
import GarminCard from '../components/health/GarminCard';
import GarminIcon from '../components/health/GarminIcon';
import { Headline, Stat, HeadlineRow } from '../components/health/GarminStat';
import ProgressBar from '../components/health/ProgressBar';
import ActivityCard from '../components/health/ActivityCard';
import Sparkline from '../components/health/Sparkline';
import EndpointExplorer from '../components/health/EndpointExplorer';
import { getGarminDay, getGarminStatus } from '../services/api';
import { longDate } from '../utils/dayInfo';
import {
  num, metersToMiles, gramsToLbs, mlToOz, secondsToHm, clock, localOffset, series, titleCase,
} from '../utils/garminFormat';
import { G, page, headerBand, sectionLabel, dateTitle, syncedText, outlineButton, card, cardBody, pillButton } from '../garminTheme';

const COLUMN = 760;

const pick = (r, key) => (r && r[key] && r[key].ok ? r[key].data : null);
const first = (v) => (Array.isArray(v) ? v[0] : v);
const orNull = (v) => (v === undefined ? null : v);

const STAGES = [
  { key: 'deepSleepSeconds', label: 'Deep', color: G.sleep.deep },
  { key: 'lightSleepSeconds', label: 'Light', color: G.sleep.light },
  { key: 'remSleepSeconds', label: 'REM', color: G.sleep.rem },
  { key: 'awakeSleepSeconds', label: 'Awake', color: G.sleep.awake },
];

const detailsBlock = (label, node) => (
  <div>
    <div style={{ ...sectionLabel, fontSize: 10, marginBottom: 6 }}>{label}</div>
    {node}
  </div>
);

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
  const summary = pick(r, 'summary') || {};
  const sleepDto = (pick(r, 'sleep') || {}).dailySleepDTO || null;
  const hr = pick(r, 'heart_rate') || {};
  const stress = pick(r, 'stress') || {};
  const bb = first(pick(r, 'body_battery')) || {};
  const hrvSummary = (pick(r, 'hrv') || {}).hrvSummary || null;
  const spo2 = pick(r, 'spo2') || {};
  const resp = pick(r, 'respiration') || {};
  const readiness = first(pick(r, 'training_readiness')) || null;
  const tstatus = pick(r, 'training_status') || {};
  const maxMet = first(pick(r, 'max_metrics')) || {};
  const fitAge = pick(r, 'fitness_age') || {};
  const activities = [...(pick(r, 'activities') || [])].sort((a, b) => String(a.startTimeLocal || '').localeCompare(String(b.startTimeLocal || '')));
  const weighIns = pick(r, 'weigh_ins');
  const weight = weighIns && Array.isArray(weighIns.dateWeightList) ? weighIns.dateWeightList[0] : null;
  const hydration = pick(r, 'hydration') || {};
  const im = pick(r, 'intensity_minutes') || {};
  const steps = pick(r, 'steps') || [];

  const failed = r ? Object.entries(r).filter(([, v]) => !v.ok) : [];
  const authFailed = failed.some(([, v]) => v.code === 'auth' || v.code === 'mfa_required');
  const connected = status && status.connected;

  const vo2 = (maxMet.generic && maxMet.generic.vo2MaxValue)
    || (tstatus.mostRecentVO2Max && tstatus.mostRecentVO2Max.generic && tstatus.mostRecentVO2Max.generic.vo2MaxValue)
    || null;
  const trainingPhrase = (() => {
    const d = tstatus.mostRecentTrainingStatus && tstatus.mostRecentTrainingStatus.latestTrainingStatusData;
    const dev = d && Object.values(d)[0];
    return dev ? titleCase(dev.trainingStatusFeedbackPhrase || dev.trainingStatus) : null;
  })();

  const stepPoints = steps.map((b) => [Date.parse(`${String(b.startGMT).replace(/\.\d+$/, '')}Z`), b.steps]).filter((p) => !Number.isNaN(p[0]));
  const hasStepSeries = stepPoints.some((p) => p[1] > 0);
  const stressPts = series(stress.stressValuesArray).filter((p) => p[1] >= 0);
  const bbPts = series(bb.bodyBatteryValuesArray);
  const hrPts = series(hr.heartRateValues);
  const stageTotal = sleepDto ? STAGES.reduce((n, s) => n + (sleepDto[s.key] || 0), 0) : 0;
  const sleepScore = sleepDto && sleepDto.sleepScores && sleepDto.sleepScores.overall ? sleepDto.sleepScores.overall.value : null;
  const intensityToday = (im.moderateMinutes || 0) + 2 * (im.vigorousMinutes || 0);
  const syncedAt = bundle && bundle.fetched_at
    ? new Date(bundle.fetched_at).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  const shell = (inner) => (
    <div className="garmin-page" style={page}>
      <TopNav dateISO={date} section="health" theme="garmin" />
      <div style={headerBand}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={sectionLabel}>Daily Summary</div>
            <div style={{ ...dateTitle, marginTop: 6 }}>
              <GarminIcon name="calendar" color={G.blue} size={18} />
              <span>{longDate(date).replace(/(\d+)(st|nd|rd|th)/, '$1,')}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {syncedAt ? <span style={syncedText}>Synced {syncedAt}</span> : null}
            <button disabled={loading || !connected} onClick={() => load(true)} style={outlineButton(loading || !connected)}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '20px min(24px, 4vw) 64px' }}>
        {inner}
      </div>
    </div>
  );

  const notice = (title, body) => (
    <section style={{ ...card, maxWidth: COLUMN }}>
      <div style={{ ...cardBody, textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: 18, fontWeight: 300, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 12, color: G.muted, lineHeight: 1.6 }}>{body}</div>
      </div>
    </section>
  );

  if (error) return shell(notice('Something went wrong', error));
  if (!bundle && loading) return shell(notice('Loading', 'Pulling the day from Garmin Connect...'));

  if (status && (!connected || authFailed)) {
    return shell(notice('Garmin Connect is not signed in', (
      !status.configured
        ? <>Add <code>GARMIN_EMAIL</code> and <code>GARMIN_PASSWORD</code> to <code>backend/.env</code> on the server, then sign in from Settings.</>
        : !status.python_ok
          ? <>The Garmin Python client is missing on the server. See the Garmin section of <code>deploy/README.md</code>.</>
          : <>Open <strong>Settings</strong> in the header and click <strong>Sign in</strong> under Garmin Connect.</>
    )));
  }

  const offset = localOffset(hr.startTimestampGMT ? hr : stress.startTimestampGMT ? stress : summary);

  return shell(
    <>
      <div style={{ maxWidth: COLUMN, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {activities.length ? activities.map((a) => <ActivityCard key={a.activityId} activity={a} />) : (
          notice('No activities recorded', 'Activities recorded on this day show here as green cards.')
        )}

        <GarminCard icon="heart" title="Heart Rate" details={hrPts.length ? detailsBlock('Heart rate through the day', <Sparkline points={hrPts} offset={offset} unit=" bpm" color={G.metric.heart} />) : null}>
          <HeadlineRow
            headline={<Headline value={num(hr.restingHeartRate || summary.restingHeartRate)} unit="bpm" caption="Resting" />}
            stats={<>
              <Stat label="7-day Avg" value={num(orNull(hr.lastSevenDaysAvgRestingHeartRate))} unit="bpm" />
              <Stat label="High" value={num(orNull(hr.maxHeartRate || summary.maxHeartRate))} unit="bpm" />
              <Stat label="Low" value={num(orNull(hr.minHeartRate || summary.minHeartRate))} unit="bpm" />
            </>}
          />
        </GarminCard>

        <GarminCard icon="battery" title="Body Battery" details={bbPts.length ? detailsBlock('Body Battery through the day', <Sparkline points={bbPts} offset={localOffset(bb)} min={0} max={100} color={G.metric.battery} />) : null}>
          <HeadlineRow
            headline={<Headline value={orNull(summary.bodyBatteryMostRecentValue)} caption="/100" />}
            stats={<>
              <Stat label="Charged" value={bb.charged !== undefined ? `+${bb.charged}` : orNull(summary.bodyBatteryChargedValue)} />
              <Stat label="Drained" value={bb.drained !== undefined ? `-${bb.drained}` : orNull(summary.bodyBatteryDrainedValue)} />
              <Stat label="High" value={orNull(summary.bodyBatteryHighestValue)} />
              <Stat label="Low" value={orNull(summary.bodyBatteryLowestValue)} />
            </>}
          />
        </GarminCard>

        <GarminCard icon="stress" title="Stress" details={stressPts.length ? detailsBlock('Stress through the day', <Sparkline points={stressPts} offset={localOffset(stress)} min={0} max={100} color={G.metric.stress} />) : null}>
          <HeadlineRow
            headline={<Headline value={orNull(stress.avgStressLevel !== undefined ? stress.avgStressLevel : summary.averageStressLevel)} />}
            stats={<>
              <Stat label="Rest" value={secondsToHm(orNull(summary.restStressDuration))} />
              <Stat label="Low" value={secondsToHm(orNull(summary.lowStressDuration))} />
              <Stat label="Medium" value={secondsToHm(orNull(summary.mediumStressDuration))} />
              <Stat label="High" value={secondsToHm(orNull(summary.highStressDuration))} />
            </>}
          />
        </GarminCard>

        <GarminCard icon="intensity" title="Intensity Minutes">
          <ProgressBar value={im.weeklyTotal || 0} goal={im.weekGoal || summary.intensityMinutesGoal || 150} color={G.metric.intensityFill} style={{ marginBottom: 14 }} />
          <HeadlineRow
            headline={<Headline value={num(orNull(im.weeklyTotal))} caption="/week" />}
            stats={<>
              <Stat label="Today" value={num(intensityToday)} />
              <Stat label="Moderate Today" value={num(orNull(im.moderateMinutes))} />
              <Stat label="Vigorous Today" value={num(orNull(im.vigorousMinutes))} />
              <Stat label="Weekly Goal" value={num(im.weekGoal || summary.intensityMinutesGoal)} />
            </>}
          />
        </GarminCard>

        <GarminCard icon="steps" title="Steps" details={hasStepSeries ? detailsBlock('Steps per 15 minutes', <Sparkline points={stepPoints} bars offset={offset} min={0} color={G.metric.stepsFill} />) : null}>
          <ProgressBar value={summary.totalSteps || 0} goal={summary.dailyStepGoal || 0} color={G.metric.stepsFill} style={{ marginBottom: 14 }} />
          <HeadlineRow
            headline={<Headline value={num(orNull(summary.totalSteps))} />}
            stats={<>
              <Stat label="Distance" value={summary.totalDistanceMeters !== undefined ? `${num(metersToMiles(summary.totalDistanceMeters), 1)} mi` : null} />
              <Stat label="Daily Goal" value={num(orNull(summary.dailyStepGoal))} />
              <Stat label="Active Time" value={secondsToHm(orNull(summary.activeSeconds))} />
            </>}
          />
        </GarminCard>

        <GarminCard icon="floors" title="Floors">
          <ProgressBar value={summary.floorsAscended || 0} goal={summary.userFloorsAscendedGoal || 0} color={G.metric.floors} style={{ marginBottom: 14 }} />
          <HeadlineRow
            headline={<Headline value={summary.floorsAscended !== undefined ? num(summary.floorsAscended) : null} caption={summary.userFloorsAscendedGoal ? `/${summary.userFloorsAscendedGoal}` : null} />}
            stats={<>
              <Stat label="Climbed" value={summary.floorsAscended !== undefined ? num(summary.floorsAscended) : null} />
              <Stat label="Descended" value={summary.floorsDescended !== undefined ? num(summary.floorsDescended) : null} />
              <Stat label="Daily Goal" value={num(orNull(summary.userFloorsAscendedGoal))} />
            </>}
          />
        </GarminCard>

        <GarminCard icon="calories" title="Calories">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <Headline value={num(orNull(summary.totalKilocalories))} caption="Total Calories" />
            <span style={{ fontSize: 28, fontWeight: 300, color: G.muted }}>=</span>
            <Stat label="Resting" value={num(orNull(summary.bmrKilocalories))} />
            <span style={{ fontSize: 28, fontWeight: 300, color: G.muted }}>+</span>
            <Stat label="Active" value={num(orNull(summary.activeKilocalories))} />
          </div>
        </GarminCard>

        <GarminCard icon="sleep" title="Sleep" aside={sleepScore !== null ? `Score ${sleepScore}` : null}>
          <div style={{ display: 'flex', height: 20, background: G.border, marginBottom: 14 }}>
            {stageTotal ? STAGES.map((s) => (sleepDto[s.key] ? (
              <div key={s.key} title={`${s.label} ${secondsToHm(sleepDto[s.key])}`} style={{ flex: sleepDto[s.key], background: s.color }} />
            ) : null)) : null}
          </div>
          <HeadlineRow
            headline={<Headline value={sleepDto && sleepDto.sleepTimeSeconds ? secondsToHm(sleepDto.sleepTimeSeconds) : null} size={40} caption={sleepDto && sleepDto.sleepStartTimestampLocal ? `${clock(sleepDto.sleepStartTimestampLocal)} to ${clock(sleepDto.sleepEndTimestampLocal)}` : null} />}
            stats={STAGES.map((s) => (
              <div key={s.key} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 300 }}>{sleepDto && sleepDto[s.key] ? secondsToHm(sleepDto[s.key]) : '--'}</div>
                <div style={{ fontSize: 12, color: G.muted, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, background: s.color, display: 'inline-block', borderRadius: 2 }} />{s.label}
                </div>
              </div>
            ))}
          />
        </GarminCard>

        <GarminCard icon="spo2" title="Pulse Ox">
          <HeadlineRow
            headline={<Headline value={num(orNull(spo2.averageSpO2))} unit="%" caption="Avg SpO2" />}
            stats={<>
              <Stat label="Sleep Avg" value={num(orNull(spo2.avgSleepSpO2))} unit="%" />
              <Stat label="Lowest" value={num(orNull(spo2.lowestSpO2))} unit="%" />
              <Stat label="7-day Avg" value={num(orNull(spo2.lastSevenDaysAvgSpO2))} unit="%" />
            </>}
          />
        </GarminCard>

        <GarminCard icon="respiration" title="Respiration">
          <HeadlineRow
            headline={<Headline value={num(orNull(resp.avgWakingRespirationValue))} unit="brpm" caption="Awake Avg" />}
            stats={<>
              <Stat label="Sleep Avg" value={num(orNull(resp.avgSleepRespirationValue))} unit="brpm" />
              <Stat label="Low" value={num(orNull(resp.lowestRespirationValue))} unit="brpm" />
              <Stat label="High" value={num(orNull(resp.highestRespirationValue))} unit="brpm" />
            </>}
          />
        </GarminCard>

        <GarminCard icon="hydration" title="Hydration">
          <ProgressBar value={hydration.valueInML || 0} goal={hydration.goalInML || 0} color={G.metric.hydration} style={{ marginBottom: 14 }} />
          <HeadlineRow
            headline={<Headline value={hydration.valueInML !== undefined ? num(mlToOz(hydration.valueInML)) : null} unit="oz" />}
            stats={<>
              <Stat label="Goal" value={hydration.goalInML ? num(mlToOz(hydration.goalInML)) : null} unit="oz" />
              <Stat label="Sweat Loss" value={hydration.sweatLossInML ? num(mlToOz(hydration.sweatLossInML)) : null} unit="oz" />
            </>}
          />
        </GarminCard>

        <GarminCard icon="hrv" title="HRV Status" aside={hrvSummary && hrvSummary.status ? titleCase(hrvSummary.status) : null}>
          <HeadlineRow
            headline={<Headline value={num(hrvSummary && hrvSummary.lastNightAvg)} unit="ms" caption="Last Night" />}
            stats={<>
              <Stat label="7-day Avg" value={num(hrvSummary && hrvSummary.weeklyAvg)} unit="ms" />
              <Stat label="Baseline" value={hrvSummary && hrvSummary.baseline ? `${hrvSummary.baseline.balancedLow} to ${hrvSummary.baseline.balancedUpper}` : null} />
              <Stat label="5-min High" value={num(hrvSummary && hrvSummary.lastNight5MinHigh)} unit="ms" />
            </>}
          />
        </GarminCard>

        <GarminCard icon="training" title="Training" aside={trainingPhrase}>
          <HeadlineRow
            headline={<Headline value={readiness ? readiness.score : null} caption={readiness && readiness.level ? titleCase(readiness.level) : 'Readiness'} />}
            stats={<>
              <Stat label="VO2 Max" value={num(vo2)} />
              <Stat label="Fitness Age" value={fitAge.fitnessAge ? num(fitAge.fitnessAge) : null} />
              <Stat label="Actual Age" value={orNull(fitAge.chronologicalAge)} />
              <Stat label="Achievable" value={fitAge.achievableFitnessAge ? num(fitAge.achievableFitnessAge) : null} />
            </>}
          />
        </GarminCard>

        <GarminCard icon="weight" title="Weight">
          <HeadlineRow
            headline={<Headline value={weight ? num(gramsToLbs(weight.weight), 1) : null} unit="lb" />}
            stats={<>
              <Stat label="BMI" value={weight && weight.bmi ? num(weight.bmi, 1) : null} />
              <Stat label="Body Fat" value={weight && weight.bodyFat ? num(weight.bodyFat, 1) : null} unit="%" />
              <Stat label="Muscle Mass" value={weight && weight.muscleMass ? num(gramsToLbs(weight.muscleMass), 1) : null} unit="lb" />
            </>}
          />
        </GarminCard>

        {failed.length && !authFailed ? (
          <div style={{ fontSize: 12, color: G.metric.heart }}>
            Garmin did not return: {failed.map(([k, v]) => `${k} (${v.error || v.code})`).join(', ')}
          </div>
        ) : null}
      </div>

      <section style={{ ...card, marginTop: 24 }}>
        <button
          type="button"
          onClick={() => setShowExplorer((s) => !s)}
          style={{ width: '100%', background: 'transparent', border: 'none', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: G.font }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: G.text }}>
            <GarminIcon name="endpoints" /> All Garmin Endpoints
          </span>
          <span style={{ ...pillButton(), padding: '3px 12px' }}>{showExplorer ? 'Hide' : 'Show'}</span>
        </button>
        {showExplorer ? <div style={{ borderTop: `1px solid ${G.border}`, padding: 16 }}><EndpointExplorer dateISO={date} /></div> : null}
      </section>
    </>
  );
}
