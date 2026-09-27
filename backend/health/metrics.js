// The Health store's metric declarations: one entry per metric, naming the Garmin
// calls it reads (keys of garmin/service dayCalls plus the two static reads below),
// how its small card value is derived, and where Garmin's own timestamp for the
// reading lives. Every call in the day bundle feeds at least one metric, so the full
// response of every call is kept in health_days.payload even where no card reads it
// yet (sleep, body battery, pulse ox, respiration, hydration, training). Goals are
// read from the same day's response and stored next to the value, never as constants.
//
// A derive() returns null when Garmin returned nothing usable; absent() then gives the
// sentence the card shows in place of a number. Values are plain JSON.

const STATIC_CALLS = {
  hr_zones: { name: 'get_heart_rate_zones', kwargs: {} },
  profile: { name: 'get_user_profile', kwargs: {} },
};

// VO2 max classification. Garmin prints no label through its API (max_metrics carries
// only maxMetCategory: 0), so the label is computed from the table Garmin ships in its
// watch manuals, "VO2 Max. Standard Ratings" (The Cooper Institute), read 2026-09-27 at
// https://www8.garmin.com/manuals/webhelp/GUID-F41EAFB3-6CC9-42DE-9C6C-9E358DBB0671/EN-US/GUID-1FBCCD9E-19E1-4E4C-BD60-1793B5B97EB3.html
// Each row is the floor of the band for the age columns 20-29, 30-39, 40-49, 50-59,
// 60-69, 70-79; below the Fair floor is Poor.
const VO2_TABLE_SOURCE = 'Garmin manual appendix "VO2 Max. Standard Ratings" (The Cooper Institute), read 2026-09-27';
const VO2_TABLE = {
  MALE: {
    Superior: [55.4, 54.0, 52.5, 48.9, 45.7, 42.1],
    Excellent: [51.1, 48.3, 46.4, 43.4, 39.5, 36.7],
    Good: [45.4, 44.0, 42.4, 39.2, 35.5, 32.3],
    Fair: [41.7, 40.5, 38.5, 35.6, 32.3, 29.4],
  },
  FEMALE: {
    Superior: [49.6, 47.4, 45.3, 41.1, 37.8, 36.7],
    Excellent: [43.9, 42.4, 39.7, 36.7, 33.0, 30.9],
    Good: [39.5, 37.8, 36.3, 33.0, 30.0, 28.1],
    Fair: [36.1, 34.4, 33.0, 30.1, 27.5, 25.9],
  },
};
const VO2_BANDS = ['Poor', 'Fair', 'Good', 'Excellent', 'Superior'];

// Column for an age; under 20 uses the first column, over 79 the last.
const ageColumn = (age) => Math.min(5, Math.max(0, Math.floor((age - 20) / 10)));

// {label, bands: [{label, floor}]} for a value, or null without sex or age.
function vo2Classify(value, gender, age) {
  const table = VO2_TABLE[gender];
  if (!table || !Number.isFinite(value) || !Number.isFinite(age)) return null;
  const col = ageColumn(age);
  const floors = { Fair: table.Fair[col], Good: table.Good[col], Excellent: table.Excellent[col], Superior: table.Superior[col] };
  let label = 'Poor';
  for (const band of ['Fair', 'Good', 'Excellent', 'Superior']) if (value >= floors[band]) label = band;
  return { label, bands: VO2_BANDS.map((b) => ({ label: b, floor: b === 'Poor' ? null : floors[b] })), age_column: col };
}

const data = (results, key) => (results[key] && results[key].ok ? results[key].data : undefined);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Local calendar age on a date from a YYYY-MM-DD birth date.
function ageOn(birthDate, dateISO) {
  if (!birthDate || !dateISO) return null;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = dateISO.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

// Regular-cadence [[ts, v]] series -> {start, step_ms, values} (values below zero are
// Garmin's "unmeasured" markers and become null); irregular series stay as pairs.
function compactSeries(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) return null;
  const clean = pairs.filter((p) => Array.isArray(p) && typeof p[0] === 'number');
  if (clean.length === 0) return null;
  const step = clean.length > 1 ? clean[1][0] - clean[0][0] : 0;
  const regular = step > 0 && clean.every((p, i) => i === 0 || p[0] - clean[i - 1][0] === step);
  const val = (v) => (typeof v === 'number' && v >= 0 ? v : null);
  if (!regular) return { pairs: clean.map((p) => [p[0], val(p[1])]) };
  return { start: clean[0][0], step_ms: step, values: clean.map((p) => val(p[1])) };
}

const lastSample = (pairs) => {
  if (!Array.isArray(pairs)) return null;
  for (let i = pairs.length - 1; i >= 0; i--) {
    const p = pairs[i];
    if (Array.isArray(p) && typeof p[1] === 'number' && p[1] > 0) return { at: p[0], value: p[1] };
  }
  return null;
};

const summaryTaken = (results) => {
  const s = data(results, 'summary');
  return (s && (s.lastSyncTimestampGMT || s.wellnessEndTimeGmt)) || null;
};

const METRICS = [
  {
    key: 'steps', calls: ['summary', 'steps'],
    derive: (r) => {
      const s = data(r, 'summary');
      if (!s || num(s.totalSteps) === null) return null;
      return { value: s.totalSteps, goal: num(s.dailyStepGoal), distance_m: num(s.totalDistanceMeters), active_s: num(s.activeSeconds), highly_active_s: num(s.highlyActiveSeconds), sedentary_s: num(s.sedentarySeconds) };
    },
    takenAt: summaryTaken,
    absent: () => 'Garmin returned no daily summary for this day.',
  },
  {
    key: 'calories', calls: ['summary'],
    derive: (r) => {
      const s = data(r, 'summary');
      if (!s || num(s.totalKilocalories) === null) return null;
      return { total: s.totalKilocalories, active: num(s.activeKilocalories), resting: num(s.bmrKilocalories) };
    },
    takenAt: summaryTaken,
    absent: () => 'Garmin returned no calorie totals for this day.',
  },
  {
    key: 'floors', calls: ['summary', 'floors'],
    derive: (r) => {
      const s = data(r, 'summary');
      if (!s || num(s.floorsAscended) === null) return null;
      return { value: s.floorsAscended, goal: num(s.userFloorsAscendedGoal), descended: num(s.floorsDescended) };
    },
    takenAt: summaryTaken,
    absent: () => 'Garmin returned no floors for this day.',
  },
  {
    key: 'heart_rate', calls: ['heart_rate', 'summary', 'hr_zones'],
    derive: (r) => {
      const h = data(r, 'heart_rate');
      const s = data(r, 'summary') || {};
      if (!h) return null;
      const latest = lastSample(h.heartRateValues);
      const resting = num(h.restingHeartRate) !== null ? h.restingHeartRate : num(s.restingHeartRate);
      if (resting === null && !latest) return null;
      const z = data(r, 'hr_zones');
      const zone = Array.isArray(z) ? (z.find((x) => x.sport === 'DEFAULT') || z[0]) : null;
      return {
        latest: latest ? latest.value : null, latest_at: latest ? latest.at : null,
        resting, min: num(h.minHeartRate), max: num(h.maxHeartRate), resting_7d_avg: num(h.lastSevenDaysAvgRestingHeartRate),
        zones: zone ? { z1: num(zone.zone1Floor), z2: num(zone.zone2Floor), z3: num(zone.zone3Floor), z4: num(zone.zone4Floor), z5: num(zone.zone5Floor), max: num(zone.maxHeartRateUsed), method: zone.trainingMethod || null } : null,
      };
    },
    takenAt: (r) => { const h = data(r, 'heart_rate'); return (h && h.endTimestampGMT) || summaryTaken(r); },
    absent: () => 'Garmin returned no heart rate readings for this day.',
  },
  {
    key: 'intensity', calls: ['intensity_minutes', 'summary'],
    // The card's ring is the WEEK: Garmin returns weeklyTotal and weekGoal itself
    // (Mon..Sun, counted with vigorous minutes doubled), nothing is summed here.
    derive: (r) => {
      const im = data(r, 'intensity_minutes');
      const s = data(r, 'summary') || {};
      if (!im) return null;
      const mod = num(im.moderateMinutes); const vig = num(im.vigorousMinutes);
      return {
        today_moderate: mod, today_vigorous: vig, today_total: mod === null && vig === null ? null : (mod || 0) + 2 * (vig || 0),
        week_total: num(im.weeklyTotal), week_goal: num(im.weekGoal) !== null ? im.weekGoal : num(s.intensityMinutesGoal),
        week_moderate: num(im.weeklyModerate), week_vigorous: num(im.weeklyVigorous), day_of_goal_met: im.dayOfGoalMet || null,
        week_returned_by_garmin: num(im.weeklyTotal) !== null,
      };
    },
    takenAt: (r) => { const im = data(r, 'intensity_minutes'); return (im && im.endTimestampGMT) || summaryTaken(r); },
    absent: () => 'Garmin returned no intensity minutes for this day.',
  },
  {
    key: 'stress', calls: ['stress', 'summary'],
    derive: (r) => {
      const st = data(r, 'stress');
      const s = data(r, 'summary') || {};
      if (!st) return null;
      const avg = num(st.avgStressLevel) !== null ? st.avgStressLevel : num(s.averageStressLevel);
      const series = compactSeries(st.stressValuesArray);
      if (avg === null && !series) return null;
      return {
        avg, max: num(st.maxStressLevel),
        durations: { rest: num(s.restStressDuration), low: num(s.lowStressDuration), medium: num(s.mediumStressDuration), high: num(s.highStressDuration) },
        series,
      };
    },
    takenAt: (r) => { const st = data(r, 'stress'); return (st && st.endTimestampGMT) || summaryTaken(r); },
    absent: () => 'Garmin returned no stress readings for this day.',
  },
  {
    key: 'hrv', calls: ['hrv'],
    derive: (r) => {
      const h = data(r, 'hrv');
      const sum = h && h.hrvSummary;
      if (!sum) return null;
      return { status: sum.status || null, last_night: num(sum.lastNightAvg), last_night_5min_high: num(sum.lastNight5MinHigh), weekly_avg: num(sum.weeklyAvg), baseline: sum.baseline || null };
    },
    takenAt: (r) => { const h = data(r, 'hrv'); return (h && h.hrvSummary && (h.hrvSummary.createTimeStamp || h.hrvSummary.calendarDate)) || summaryTaken(r); },
    absent: () => 'Wear your device while sleeping to reveal your status.',
  },
  {
    key: 'fitness_age', calls: ['fitness_age'],
    derive: (r) => {
      const f = data(r, 'fitness_age');
      if (!f || num(f.fitnessAge) === null) return null;
      // achievable is stored exactly as returned; the phone shows a different number
      // (26.5 against 26.967 on 2026-09-27) and that stays a documented discrepancy.
      return { fitness_age: f.fitnessAge, chronological_age: num(f.chronologicalAge), achievable: num(f.achievableFitnessAge), previous: num(f.previousFitnessAge), last_updated: f.lastUpdated || null, components: f.components || null };
    },
    takenAt: (r) => { const f = data(r, 'fitness_age'); return (f && f.lastUpdated) || null; },
    absent: () => 'Garmin has not computed a fitness age for this day.',
  },
  {
    key: 'vo2max', calls: ['max_metrics', 'profile'],
    derive: (r, ctx) => {
      const mm = data(r, 'max_metrics');
      const own = Array.isArray(mm) && mm.length ? (mm[mm.length - 1].generic || null) : null;
      // No estimate this day: carry the newest earlier one (its own date stays on it).
      const g = own && num(own.vo2MaxValue) !== null ? own : (ctx.previousVo2 ? { vo2MaxValue: ctx.previousVo2.value, vo2MaxPreciseValue: ctx.previousVo2.precise, calendarDate: ctx.previousVo2.date, carried: true } : null);
      if (!g) return null;
      const u = (data(r, 'profile') || {}).userData || {};
      const age = ageOn(u.birthDate, ctx.date);
      const cls = vo2Classify(num(g.vo2MaxPreciseValue) !== null ? g.vo2MaxPreciseValue : g.vo2MaxValue, u.gender, age);
      return {
        value: g.vo2MaxValue, precise: num(g.vo2MaxPreciseValue), date: g.calendarDate || null, carried: g.carried ? 1 : 0,
        label: cls ? cls.label : null, bands: cls ? cls.bands : null, label_inputs: { gender: u.gender || null, age, table: VO2_TABLE_SOURCE },
      };
    },
    takenAt: (r) => { const mm = data(r, 'max_metrics'); const g = Array.isArray(mm) && mm.length ? mm[mm.length - 1].generic : null; return (g && g.calendarDate) || null; },
    absent: () => 'Garmin has no VO2 max estimate on or before this day.',
  },
  {
    key: 'weight', calls: ['weigh_ins', 'profile'],
    // The phone's Weight card shows the PROFILE weight (userData.weight) and computes
    // BMI from it and the profile height, so that is the displayed value. The latest
    // weigh-in on or before the date is stored beside it; the ingest carries the
    // newest known weigh-in forward from earlier rows when this day has none.
    derive: (r, ctx) => {
      const u = (data(r, 'profile') || {}).userData || {};
      const w = data(r, 'weigh_ins');
      const list = (w && w.dateWeightList) || [];
      const todays = list.length ? list[list.length - 1] : null;
      const carried = ctx.previousWeighIn || null;
      const latest = todays ? { grams: num(todays.weight), date: todays.calendarDate || ctx.date, source: todays.sourceType || null, at: todays.timestampGMT || null } : carried;
      const profileG = num(u.weight);
      const heightCm = num(u.height);
      if (profileG === null && !latest) return null;
      const shownG = profileG !== null ? profileG : latest.grams;
      const bmi = shownG !== null && heightCm ? Math.round((shownG / 1000) / Math.pow(heightCm / 100, 2) * 10) / 10 : null;
      return {
        profile_weight_g: profileG, lbs: shownG !== null ? Math.round(shownG / 453.592 * 10) / 10 : null, bmi, height_cm: heightCm,
        latest_weigh_in_g: latest ? latest.grams : null, weigh_in_date: latest ? latest.date : null, weigh_in_source: latest ? latest.source : null,
        diverges: !!(latest && profileG !== null && Math.abs(latest.grams - profileG) >= 100),
      };
    },
    takenAt: (r) => { const w = data(r, 'weigh_ins'); const list = (w && w.dateWeightList) || []; return list.length ? (list[list.length - 1].timestampGMT || null) : summaryTaken(r); },
    absent: () => 'No weight in the Garmin profile and no weigh-in on record.',
  },
  // Stored for their payloads; cards may read them later without a backfill.
  {
    key: 'sleep', calls: ['sleep'],
    derive: (r) => {
      const d = (data(r, 'sleep') || {}).dailySleepDTO;
      if (!d || num(d.sleepTimeSeconds) === null) return null;
      return { seconds: d.sleepTimeSeconds, start: d.sleepStartTimestampLocal || null, end: d.sleepEndTimestampLocal || null, deep_s: num(d.deepSleepSeconds), light_s: num(d.lightSleepSeconds), rem_s: num(d.remSleepSeconds), awake_s: num(d.awakeSleepSeconds), score: d.sleepScores && d.sleepScores.overall ? num(d.sleepScores.overall.value) : null };
    },
    takenAt: (r) => { const d = (data(r, 'sleep') || {}).dailySleepDTO; return (d && d.sleepEndTimestampGMT) || null; },
    absent: () => 'No sleep recorded for the night ending on this day.',
  },
  {
    key: 'body_battery', calls: ['body_battery', 'summary'],
    derive: (r) => {
      const s = data(r, 'summary') || {};
      const bb = data(r, 'body_battery');
      const day = Array.isArray(bb) && bb.length ? bb[0] : null;
      const latest = num(s.bodyBatteryMostRecentValue);
      if (latest === null && !day) return null;
      return { latest, high: num(s.bodyBatteryHighestValue), low: num(s.bodyBatteryLowestValue), charged: day ? num(day.charged) : num(s.bodyBatteryChargedValue), drained: day ? num(day.drained) : num(s.bodyBatteryDrainedValue), series: day ? compactSeries(day.bodyBatteryValuesArray) : null };
    },
    takenAt: (r) => { const bb = data(r, 'body_battery'); const day = Array.isArray(bb) && bb.length ? bb[0] : null; return (day && day.endTimestampGMT) || summaryTaken(r); },
    absent: () => 'Garmin returned no Body Battery for this day.',
  },
  {
    key: 'spo2', calls: ['spo2'],
    derive: (r) => { const d = data(r, 'spo2'); if (!d || (num(d.averageSpO2) === null && num(d.latestSpO2) === null)) return null; return { avg: num(d.averageSpO2), lowest: num(d.lowestSpO2), latest: num(d.latestSpO2), avg_sleep: num(d.avgSleepSpO2) }; },
    takenAt: (r) => { const d = data(r, 'spo2'); return (d && (d.latestSpO2TimestampGMT || d.endTimestampGMT)) || null; },
    absent: () => 'No pulse ox readings for this day.',
  },
  {
    key: 'respiration', calls: ['respiration'],
    derive: (r) => { const d = data(r, 'respiration'); if (!d || num(d.avgWakingRespirationValue) === null) return null; return { avg_waking: d.avgWakingRespirationValue, avg_sleep: num(d.avgSleepRespirationValue), lowest: num(d.lowestRespirationValue), highest: num(d.highestRespirationValue) }; },
    takenAt: (r) => { const d = data(r, 'respiration'); return (d && d.endTimestampGMT) || null; },
    absent: () => 'No respiration readings for this day.',
  },
  {
    key: 'hydration', calls: ['hydration'],
    derive: (r) => { const d = data(r, 'hydration'); if (!d || num(d.valueInML) === null) return null; return { ml: d.valueInML, goal_ml: num(d.goalInML), sweat_loss_ml: num(d.sweatLossInML) }; },
    takenAt: (r) => { const d = data(r, 'hydration'); return (d && d.lastEntryTimestampLocal) || null; },
    absent: () => 'No hydration logged for this day.',
  },
  {
    key: 'training_readiness', calls: ['training_readiness'],
    derive: (r) => { const d = data(r, 'training_readiness'); const t = Array.isArray(d) && d.length ? d[0] : null; if (!t || num(t.score) === null) return null; return { score: t.score, level: t.level || null }; },
    takenAt: (r) => { const d = data(r, 'training_readiness'); const t = Array.isArray(d) && d.length ? d[0] : null; return (t && t.timestamp) || null; },
    absent: () => 'Garmin has no training readiness for this day.',
  },
  {
    key: 'training_status', calls: ['training_status'],
    derive: (r) => { const d = data(r, 'training_status'); const s = d && d.mostRecentTrainingStatus; if (!s) return null; return { status: s.latestTrainingStatusData ? Object.values(s.latestTrainingStatusData)[0] : null }; },
    takenAt: () => null,
    absent: () => 'Garmin has no training status for this day.',
  },
];

const BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m]));

module.exports = { METRICS, BY_KEY, STATIC_CALLS, VO2_TABLE, VO2_TABLE_SOURCE, vo2Classify, ageOn, compactSeries, lastSample };
