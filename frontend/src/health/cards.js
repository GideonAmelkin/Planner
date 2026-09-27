// The At a Glance cards, declared. Each entry names the store metric it reads, its
// shape (RING, GAUGE, SPLIT, STACK), label, glyph, color and how its value becomes the
// shape's props. Pruning or reordering the grid is an edit to this array and nothing
// else. `build` receives the metric's stored value (never null) and a ctx with the
// viewed date and the history helpers; it returns the shape props. Every card also
// carries a source caption: the Garmin call and field the number came from, with the
// reading's date, so two screens disagreeing is attributable.
import { CHART, HR_ZONE_COLORS, STRESS_BANDS, VO2_BAND_COLORS } from '../shared/charts';
import { intNum, clockDuration, monthDay, dayLetter, gmtStampTime } from './format';

const n1 = (v) => (v === null || v === undefined ? null : Number(v).toFixed(1));

export const CARDS = [
  {
    key: 'heart_rate', metric: 'heart_rate', label: 'Heart Rate', glyph: 'heart', color: CHART.red, shape: 'GAUGE',
    caption: (v, ctx) => `get_heart_rates · latest sample and restingHeartRate · ${ctx.readingDate(v.latest_at)}`,
    build: (v) => {
      const z = v.zones;
      const max = (z && z.max) || Math.max(200, (v.max || 0) + 10);
      const min = Math.max(30, Math.min(v.resting !== null ? v.resting - 20 : 40, 40));
      const zones = z ? [
        { from: min, to: z.z1, color: HR_ZONE_COLORS[0] }, { from: z.z1, to: z.z2, color: HR_ZONE_COLORS[1] }, { from: z.z2, to: z.z3, color: HR_ZONE_COLORS[2] },
        { from: z.z3, to: z.z4, color: HR_ZONE_COLORS[3] }, { from: z.z4, to: z.z5, color: HR_ZONE_COLORS[4] }, { from: z.z5, to: max, color: HR_ZONE_COLORS[5] },
      ] : [];
      return { gauge: { value: v.latest, min, max, zones }, center: v.latest !== null ? String(v.latest) : '--', centerSub: v.latest !== null ? 'bpm' : null, bottom: { big: v.resting !== null ? `${v.resting} bpm` : '--', small: 'Resting' } };
    },
  },
  {
    key: 'intensity', metric: 'intensity', label: 'Intensity Minutes', glyph: 'intensity', color: CHART.orange, shape: 'RING', footer: 'spark',
    caption: (v, ctx) => `get_intensity_minutes_data · weeklyTotal / weekGoal (this week, Mon to Sun) · ${ctx.date}`,
    build: (v, ctx) => ({
      ring: { value: v.week_total, goal: v.week_goal, color: v.week_goal && v.week_total >= v.week_goal ? CHART.goal : CHART.orange },
      center: intNum(v.week_total), goal: v.week_goal !== null ? `${intNum(v.week_goal)} weekly goal` : 'no weekly goal',
      spark: ctx.last7('intensity').map((d, i) => (d.value && d.value.week_total !== null ? [i, d.value.week_total] : null)).filter(Boolean),
      letters: ctx.last7('intensity').map((d) => ({ letter: dayLetter(d.date), current: d.date === ctx.date, hasData: !!d.value, met: false })),
      note: v.week_returned_by_garmin ? null : 'week total summed here; may be incomplete',
    }),
  },
  {
    key: 'steps', metric: 'steps', label: 'Steps', glyph: 'steps', color: CHART.blue, shape: 'RING', footer: 'letters',
    caption: (v, ctx) => `get_user_summary · totalSteps / dailyStepGoal · ${ctx.date}`,
    build: (v, ctx) => ({
      ring: { value: v.value, goal: v.goal, color: v.goal && v.value >= v.goal ? CHART.goal : CHART.blue },
      center: intNum(v.value), goal: v.goal !== null ? intNum(v.goal) : 'no goal',
      letters: ctx.last7('steps').map((d) => ({ letter: dayLetter(d.date), current: d.date === ctx.date, hasData: !!d.value, met: !!(d.value && d.value.goal && d.value.value >= d.value.goal), title: d.value ? `${intNum(d.value.value)} of ${intNum(d.value.goal)}` : 'no data' })),
    }),
  },
  {
    key: 'calories', metric: 'calories', label: 'Calories Burned', glyph: 'calories', color: CHART.green, shape: 'SPLIT',
    caption: (v, ctx) => `get_user_summary · totalKilocalories = activeKilocalories + bmrKilocalories · ${ctx.date}`,
    build: (v) => ({ total: intNum(v.total), a: { value: intNum(v.active), label: 'Active', color: CHART.red }, b: { value: intNum(v.resting), label: 'Resting', color: CHART.blue }, aNum: v.active, bNum: v.resting }),
  },
  {
    key: 'hrv', metric: 'hrv', label: 'HRV Status', glyph: 'hrv', color: CHART.purple, shape: 'STACK',
    caption: (v, ctx) => `get_hrv_data · hrvSummary · ${ctx.date}`,
    build: (v) => ({ rows: [{ value: v.status ? v.status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '--', label: 'Status' }, { value: v.last_night !== null ? `${v.last_night} ms` : '--', label: 'Last night' }, { value: v.weekly_avg !== null ? `${v.weekly_avg} ms` : '--', label: '7-day average' }], updated: null }),
  },
  {
    key: 'floors', metric: 'floors', label: 'Floors', glyph: 'floors', color: CHART.blue, shape: 'RING', footer: 'letters',
    caption: (v, ctx) => `get_user_summary · floorsAscended / userFloorsAscendedGoal · ${ctx.date}`,
    build: (v, ctx) => ({
      ring: { value: v.value, goal: v.goal, color: v.goal && v.value >= v.goal ? CHART.goal : CHART.blue },
      center: intNum(v.value), goal: v.goal !== null ? intNum(v.goal) : 'no goal',
      letters: ctx.last7('floors').map((d) => ({ letter: dayLetter(d.date), current: d.date === ctx.date, hasData: !!d.value, met: !!(d.value && d.value.goal && d.value.value >= d.value.goal), title: d.value ? `${intNum(d.value.value)} of ${intNum(d.value.goal)}` : 'no data' })),
    }),
  },
  {
    key: 'stress', metric: 'stress', label: 'Stress', glyph: 'stress', color: CHART.orange, shape: 'RING', footer: 'series',
    caption: (v, ctx) => `get_stress_data · avgStressLevel, stressValuesArray; bands from get_user_summary durations · ${ctx.date}`,
    build: (v) => {
      const d = v.durations || {};
      const segments = STRESS_BANDS.map((b) => ({ value: d[b.key] || 0, color: b.color, label: b.label }));
      const s = v.series;
      let points = [];
      let domain = null;
      if (s && s.values) { points = s.values.map((y, i) => (y === null ? null : [s.start + i * s.step_ms, y])).filter(Boolean); domain = [s.start, s.start + (s.values.length - 1) * s.step_ms]; }
      else if (s && s.pairs) { points = s.pairs.filter((p) => p[1] !== null); domain = points.length ? [points[0][0], points[points.length - 1][0]] : null; }
      return { ring: { segments: segments.some((x) => x.value > 0) ? segments : null, value: v.avg, goal: 100, color: CHART.blue }, center: v.avg !== null ? String(v.avg) : '--', goal: v.max !== null ? `${v.max} peak` : null, series: { points, domain, color: (y) => (y > 75 ? CHART.red : y > 50 ? CHART.orange : y > 25 ? CHART.amber : CHART.blue) } };
    },
  },
  {
    key: 'fitness_age', metric: 'fitness_age', label: 'Fitness Age', glyph: 'fitness', color: CHART.ink, shape: 'STACK',
    caption: (v) => `get_fitnessage_data · fitnessAge, chronologicalAge, achievableFitnessAge (phone shows 26.5 for 26.967; documented) · ${v.last_updated ? v.last_updated.slice(0, 10) : ''}`,
    build: (v) => ({ rows: [{ value: v.fitness_age !== null ? String(Math.round(v.fitness_age)) : '--', label: 'Fitness Age' }, { value: v.chronological_age !== null ? String(v.chronological_age) : '--', label: 'Your Age' }, { value: n1(v.achievable) || '--', label: 'Target' }], updated: v.last_updated ? `Updated ${monthDay(v.last_updated.slice(0, 10))}` : null }),
  },
  {
    key: 'vo2max', metric: 'vo2max', label: 'VO₂ Max', glyph: 'run', color: CHART.blue, shape: 'GAUGE',
    caption: (v) => `get_max_metrics · vo2MaxValue (${v.precise}); band from Garmin's ratings table for ${v.label_inputs && v.label_inputs.gender ? v.label_inputs.gender.toLowerCase() : 'unknown sex'}, age ${v.label_inputs ? v.label_inputs.age : '?'} · ${v.date || ''}`,
    build: (v) => {
      const min = 20; const max = 70;
      const floors = (v.bands || []).filter((b) => b.floor !== null);
      const edges = [min, ...floors.map((b) => b.floor), max];
      const labels = ['Poor', ...floors.map((b) => b.label)];
      const zones = labels.map((l, i) => ({ from: edges[i], to: edges[i + 1], color: VO2_BAND_COLORS[l] || CHART.grey }));
      return { gauge: { value: v.precise !== null ? v.precise : v.value, min, max, zones }, center: String(v.value), centerSub: null, below: v.label || null };
    },
  },
  {
    key: 'weight', metric: 'weight', label: 'Weight', glyph: 'weight', color: CHART.blue, shape: 'STACK',
    caption: (v) => `get_user_profile · userData.weight and height (BMI); last weigh-in from get_weigh_ins · ${v.weigh_in_date || 'no weigh-in'}`,
    build: (v) => {
      const change = v.latest_weigh_in_g !== null && v.profile_weight_g !== null ? (v.profile_weight_g - v.latest_weigh_in_g) / 453.592 : null;
      const rows = [
        { value: v.lbs !== null ? `${v.lbs.toFixed(1)} lbs` : '--', label: v.profile_weight_g !== null ? 'Profile weight' : 'Last weigh-in' },
        { value: change !== null ? `${change >= 0 ? '' : '-'}${Math.abs(change).toFixed(1)} lbs` : '--', label: 'Change' },
        { value: v.bmi !== null ? String(v.bmi) : '--', label: 'BMI' },
      ];
      const when = v.weigh_in_date ? `last weighed ${monthDay(v.weigh_in_date)}${v.weigh_in_date.slice(0, 4) !== String(new Date().getFullYear()) ? `, ${v.weigh_in_date.slice(0, 4)}` : ''}${v.weigh_in_source === 'USER_SETTING' ? ' (entered by hand)' : ''}` : 'no weigh-in on record';
      const diverge = v.diverges ? `Profile ${v.lbs.toFixed(1)} lbs differs from the last weigh-in ${(v.latest_weigh_in_g / 453.592).toFixed(1)} lbs` : null;
      return { rows, updated: when, note: diverge };
    },
  },
  // Stored metrics with no card in the phone layout, shown as STACK cards so nothing the
  // store holds is invisible. Delete any of these entries to drop the card.
  {
    key: 'sleep', metric: 'sleep', label: 'Sleep', glyph: 'sleep', color: CHART.purple, shape: 'STACK',
    caption: (v, ctx) => `get_sleep_data · dailySleepDTO · night ending ${ctx.date}`,
    build: (v) => ({ rows: [{ value: clockDuration(v.seconds) || '--', label: 'Asleep' }, { value: v.score !== null ? String(v.score) : '--', label: 'Score' }, { value: v.deep_s !== null ? `${Math.round(v.deep_s / 60)}m` : '--', label: 'Deep' }], updated: v.end ? `Woke ${v.end.slice(11, 16)}` : null }),
  },
  {
    key: 'body_battery', metric: 'body_battery', label: 'Body Battery', glyph: 'battery', color: CHART.blue, shape: 'STACK',
    caption: (v, ctx) => `get_body_battery · charged / drained; latest from get_user_summary · ${ctx.date}`,
    build: (v) => ({ rows: [{ value: v.latest !== null ? String(v.latest) : '--', label: 'Now' }, { value: v.charged !== null ? `+${v.charged}` : '--', label: 'Charged' }, { value: v.drained !== null ? `-${v.drained}` : '--', label: 'Drained' }], updated: v.high !== null ? `High ${v.high}, low ${v.low}` : null }),
  },
  {
    key: 'spo2', metric: 'spo2', label: 'Pulse Ox', glyph: 'spo2', color: CHART.red, shape: 'STACK',
    caption: (v, ctx) => `get_spo2_data · ${ctx.date}`,
    build: (v) => ({ rows: [{ value: v.avg !== null ? `${v.avg}%` : '--', label: 'Average' }, { value: v.lowest !== null ? `${v.lowest}%` : '--', label: 'Lowest' }, { value: v.latest !== null ? `${v.latest}%` : '--', label: 'Latest' }], updated: null }),
  },
  {
    key: 'respiration', metric: 'respiration', label: 'Respiration', glyph: 'respiration', color: CHART.blue, shape: 'STACK',
    caption: (v, ctx) => `get_respiration_data · ${ctx.date}`,
    build: (v) => ({ rows: [{ value: `${v.avg_waking} brpm`, label: 'Awake average' }, { value: v.lowest !== null ? `${v.lowest}` : '--', label: 'Lowest' }, { value: v.highest !== null ? `${v.highest}` : '--', label: 'Highest' }], updated: null }),
  },
  {
    key: 'hydration', metric: 'hydration', label: 'Hydration', glyph: 'hydration', color: CHART.blue, shape: 'STACK',
    caption: (v, ctx) => `get_hydration_data · ${ctx.date}`,
    build: (v) => ({ rows: [{ value: `${Math.round(v.ml / 29.5735)} oz`, label: 'Logged' }, { value: v.goal_ml !== null ? `${Math.round(v.goal_ml / 29.5735)} oz` : '--', label: 'Goal' }, { value: v.sweat_loss_ml !== null ? `${Math.round(v.sweat_loss_ml / 29.5735)} oz` : '--', label: 'Sweat loss' }], updated: null }),
  },
  {
    key: 'training_readiness', metric: 'training_readiness', label: 'Training Readiness', glyph: 'training', color: CHART.green, shape: 'STACK',
    caption: (v, ctx) => `get_training_readiness · ${ctx.date}`,
    build: (v) => ({ rows: [{ value: String(v.score), label: 'Score' }, { value: v.level ? v.level.replace(/_/g, ' ').toLowerCase() : '--', label: 'Level' }], updated: null }),
  },
];

export const gmtTime = gmtStampTime;
