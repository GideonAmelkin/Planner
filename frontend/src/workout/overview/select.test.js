// Run: cd frontend && CI=true npx react-scripts test --watchAll=false src/workout/overview
import { dominantMuscle, longestStreak, muscleShares, recordsInRange, sessionLengths, stripDays, topExercises } from './select';
import { muscleVolume } from '../muscles';

const kg = (lb) => Math.round((lb / 2.20462) * 1000) / 1000;
const sets = (...pairs) => pairs.map(([lb, reps]) => ({ reps, weight_kg: kg(lb), finished: true }));
// The 2026-09-27 Lower Body session as the snapshot carries it (same fixture as strength.test.js).
const TODAY = {
  id: 'gym:1790537652173', kind: 'gym', title: 'Lower Body Workout', date: '2026-09-27', total_weight_kg: 5429.512,
  exercises: [
    { action_id: '1279', name: 'Smith Machine Squat', sets: sets([95, 8], [95, 8], [95, 8], [95, 8]) },
    { action_id: '753', name: 'Butt Bridge · Dumbbell', sets: sets([25, 8], [25, 8], [25, 8], [25, 10]) },
    { action_id: '1083', name: 'Barbell Stiff Leg Deadlift', sets: sets([95, 8], [95, 8], [60, 8], [60, 8]) },
    { action_id: '1071', name: 'Cable Pull Through', sets: sets([30, 8], [30, 8], [30, 8], [30, 8]) },
    { action_id: '977', name: 'Machine Seated Hip Abductor', sets: sets([55, 8], [55, 8], [55, 8], [55, 8]) },
    { action_id: '1006', name: 'Machine Seated Calf Press', sets: sets([90, 8], [90, 8], [90, 8], [90, 8]) },
  ],
};
const bench = (id, date, lb) => ({ id, kind: 'gym', date, started_at: `${date}T07:00:00-04:00`, duration_s: 1800, total_weight_kg: kg(lb) * 32,
  exercises: [{ action_id: '1', name: 'Bench Press · Barbell', sets: sets([lb, 8], [lb, 8], [lb, 8], [lb, 8]) }] });

test('longest streak finds the run and its dates', () => {
  expect(longestStreak(['2026-09-01', '2026-09-02', '2026-09-02', '2026-09-08', '2026-09-27', '2026-09-28', '2026-09-29']))
    .toEqual({ days: 3, start: '2026-09-27', end: '2026-09-29' });
  expect(longestStreak([])).toEqual({ days: 0, start: null, end: null });
});

test('session lengths: oldest first, avg and range in minutes', () => {
  const r = sessionLengths([{ date: '2026-09-29', duration_s: 1995 }, { date: '2026-09-01', duration_s: 1068 }, { date: '2026-09-02', duration_s: 0 }]);
  expect(r.rows.map((x) => x.date)).toEqual(['2026-09-01', '2026-09-29']);
  expect(r.max).toBeCloseTo(33.25, 2);
  expect(r.min).toBeCloseTo(17.8, 2);
  expect(sessionLengths([]).avg).toBeNull();
});

test('dominant muscle and shares of the real Lower Body session', () => {
  expect(dominantMuscle(TODAY)).toBe('glutes');
  const shares = muscleShares(muscleVolume([TODAY]));
  expect(shares[0].key).toBe('glutes');
  expect(shares.reduce((t, s) => t + s.share, 0)).toBeCloseTo(1, 6);
  // The groups still add up to the export's own session total (drift detector, as in muscles.test.js).
  expect(shares.reduce((t, s) => t + s.kg, 0)).toBeCloseTo(TODAY.total_weight_kg, 0);
});

test('top exercise per group', () => {
  const top = topExercises([TODAY]);
  expect(top.quads.name).toBe('Smith Machine Squat');
  expect(top.calves.name).toBe('Machine Seated Calf Press');
});

test('records need an earlier session; only in-range ones are listed', () => {
  expect(recordsInRange([TODAY], '2026-09-01', '2026-09-30')).toEqual([]);
  const all = [bench('a', '2026-08-01', 95), bench('b', '2026-09-10', 100), bench('c', '2026-09-20', 90)];
  const recs = recordsInRange(all, '2026-09-01', '2026-09-30');
  expect(recs.map((r) => r.date)).toEqual(['2026-09-10']);
  expect(recs[0].kinds).toContain('e1RM');
  expect(recordsInRange(all, '2026-09-15', '2026-09-30')).toEqual([]);
});

test('strip: one entry per day, gym beats home, muscle from the full session', () => {
  const sessions = [{ id: TODAY.id, kind: 'gym', date: '2026-09-27' }, { id: 'h', kind: 'home', date: '2026-09-27' }, { id: 'h2', kind: 'home', date: '2026-09-25' }];
  const days = stripDays('2026-09-24', '2026-09-28', sessions, new Map([[TODAY.id, TODAY]]));
  expect(days.map((d) => d.kind)).toEqual([null, 'home', null, 'gym', null]);
  expect(days[3].muscle).toBe('glutes');
  expect(days[3].sessions).toHaveLength(2);
});
