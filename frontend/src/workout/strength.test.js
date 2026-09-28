// Run: cd frontend && CI=true npx react-scripts test --watchAll=false src/workout/strength.test.js
// The fixture is today's real session (2026-09-27 Lower Body Workout) exactly as the snapshot carries it.
import { compareToPrevious, compressSets, displayWeight, e10rm, epley, exerciseHistory, exerciseName, exerciseSessionRows, fmtWeight, newRecords, records, repMaxTable, setStats, toUnit, weeklyVolume } from './strength';

const kg = (lb) => Math.round((lb / 2.20462) * 1000) / 1000; // what export.py stores: kg to 3 decimals
const sets = (...pairs) => pairs.map(([lb, reps]) => ({ reps, weight_kg: kg(lb), finished: true }));
export const TODAY = {
  id: 'gym:1790537652173', kind: 'gym', title: 'Lower Body Workout', date: '2026-09-27', started_at: '2026-09-27T15:02:49-04:00',
  duration_s: 1882, calories: 159, total_weight_kg: 5429.512, weight_unit: 'lb',
  exercises: [
    { action_id: '1279', name: 'Smith Machine Squat', order: 0, sets: sets([95, 8], [95, 8], [95, 8], [95, 8]) },
    { action_id: '753', name: 'Butt Bridge · Dumbbell', order: 1, sets: sets([25, 8], [25, 8], [25, 8], [25, 10]) },
    { action_id: '1083', name: 'Barbell Stiff Leg Deadlift', order: 2, sets: sets([95, 8], [95, 8], [60, 8], [60, 8]) },
    { action_id: '1071', name: 'Cable Pull Through', order: 3, sets: sets([30, 8], [30, 8], [30, 8], [30, 8]) },
    { action_id: '977', name: 'Machine Seated Hip Abductor', order: 4, sets: sets([55, 8], [55, 8], [55, 8], [55, 8]) },
    { action_id: '1006', name: 'Machine Seated Calf Press', order: 5, sets: sets([90, 8], [90, 8], [90, 8], [90, 8]) },
  ],
};

test('estimated 1RM matches the app: 95 lb x 8 is 120.3 lb', () => {
  expect(toUnit(epley(kg(95), 8), 'lb')).toBeCloseTo(120.3, 1);
  expect(epley(kg(95), 1)).toBeCloseTo(kg(95), 3);
  expect(epley(0, 8)).toBeNull();
});

test('the per-exercise volumes add up to the session total the export computed (drift detector)', () => {
  const sum = TODAY.exercises.reduce((t, e) => t + setStats(e.sets).volume_kg, 0);
  expect(sum).toBeCloseTo(TODAY.total_weight_kg, 2);
  expect(toUnit(sum, 'lb')).toBeCloseTo(11970, 0);
});

test('every displayed weight round-trips to what the app shows', () => {
  const shown = TODAY.exercises.map((e) => fmtWeight(setStats(e.sets).best.weight_kg, 'lb'));
  expect(shown).toEqual(['95', '25', '95', '30', '55', '90']);
  expect(TODAY.exercises.map((e) => displayWeight(setStats(e.sets).heaviest_kg, 'lb'))).toEqual([95, 25, 95, 30, 55, 90]);
  expect(fmtWeight(kg(27.5), 'lb')).toBe('27.5');
  expect(fmtWeight(null, 'lb')).toBe('-');
});

test('best set is the highest estimated 1RM, heavier on ties; butt bridge picks the 10-rep set', () => {
  const bb = setStats(TODAY.exercises[1].sets);
  expect(bb.best).toEqual({ weight_kg: kg(25), reps: 10 });
  const dl = setStats(TODAY.exercises[2].sets);
  expect(dl.best).toEqual({ weight_kg: kg(95), reps: 8 });
  expect(dl.heaviest_kg).toBe(kg(95));
  expect(dl.sets).toBe(4);
});

test('a single session is a baseline: every exercise is first, one point of history, one week of volume', () => {
  const cmp = compareToPrevious(TODAY, [TODAY]);
  expect(cmp.map((c) => c.status)).toEqual(['first', 'first', 'first', 'first', 'first', 'first']);
  const history = exerciseHistory([TODAY]);
  expect(history).toHaveLength(6);
  expect(history[0].points).toHaveLength(1);
  expect(records(history[0].points).heaviest).toEqual({ kg: kg(95), date: '2026-09-27' });
  const weeks = weeklyVolume([TODAY], '2026-08-29', '2026-09-27');
  expect(weeks.map((w) => w.sessions)).toEqual([1]); // no empty leading weeks
  expect(weeks[0].start).toBe('2026-09-27'); // a Sunday, so the week starts on the session's day
  expect(weeks[0].volume_kg).toBeCloseTo(5429.512, 3);
});

test('a second session is compared to the previous time each exercise was done', () => {
  const next = { ...TODAY, id: 'gym:2', date: '2026-10-04', started_at: '2026-10-04T15:00:00-04:00', exercises: [
    { action_id: '1279', name: 'Smith Machine Squat', order: 0, sets: sets([100, 8], [100, 8]) },
    { action_id: '753', name: 'Butt Bridge · Dumbbell', order: 1, sets: sets([25, 8]) },
    { action_id: '4444', name: '4444', order: 2, sets: sets([40, 5]) },
  ] };
  const cmp = compareToPrevious(next, [TODAY, next]);
  expect(cmp[0].status).toBe('up');
  expect(toUnit(cmp[0].delta_best_weight_kg, 'lb')).toBeCloseTo(5, 1);
  expect(cmp[1].status).toBe('down'); // best set fell from 25 x 10 to 25 x 8
  expect(cmp[2].status).toBe('first');
  expect(exerciseName(next.exercises[2])).toBeNull();
  expect(exerciseHistory([TODAY, next]).find((h) => h.action_id === '1279').points).toHaveLength(2);
});


test('epley is capped at 12 reps and e10RM follows from e1RM', () => {
  expect(epley(kg(25), 13)).toBeNull();
  expect(setStats(sets([25, 15], [25, 15])).e1rm_kg).toBeNull();
  expect(setStats(sets([25, 15])).best).toEqual({ weight_kg: kg(25), reps: 15 }); // still a best set for volume and reps
  expect(toUnit(e10rm(epley(kg(95), 8)), 'lb')).toBeCloseTo(90.2, 1);
});

test('sets compress into groups and name a top set plus backoff', () => {
  expect(compressSets(TODAY.exercises[0].sets, 'lb')).toBe('95 × 8 (×4)');
  expect(compressSets(TODAY.exercises[1].sets, 'lb')).toBe('25 × 8 (×3), 25 × 10');
  expect(compressSets(TODAY.exercises[2].sets, 'lb')).toBe('95 × 8 (×2), backoff 60 × 8 (×2)');
  expect(compressSets([], 'lb')).toBe('');
});

test('rep-max table from one session: actual rows at 8 and 10 reps, estimates elsewhere, no PR highlight', () => {
  const bb = exerciseHistory([TODAY]).find((h) => h.action_id === '753');
  const rows = repMaxTable(bb.points);
  expect(rows.map((r) => r.reps)).toEqual([1, 2, 3, 5, 8, 10, 12]);
  const r8 = rows.find((r) => r.reps === 8);
  expect(r8.actual).toEqual({ kg: kg(25), date: '2026-09-27', latest: true });
  expect(r8.pr).toBe(false);
  expect(toUnit(rows.find((r) => r.reps === 1).estimated_kg, 'lb')).toBeCloseTo(33.3, 1);
  expect(rows.find((r) => r.reps === 3).actual).toBeNull();
});

test('records carry every face of progress with dates; new records need an earlier session', () => {
  const dl = exerciseHistory([TODAY]).find((h) => h.action_id === '1083');
  const rec = records(dl.points);
  expect(rec.heaviest).toEqual({ kg: kg(95), date: '2026-09-27' });
  expect(toUnit(rec.bestE1rm.kg, 'lb')).toBeCloseTo(120.3, 1);
  expect(rec.bestSet.kg).toBeCloseTo(kg(95) * 8, 3);
  expect(rec.mostReps.set).toEqual({ weight_kg: kg(95), reps: 8 });
  expect(newRecords(dl.points)).toEqual([]);
  const next = { ...TODAY, id: 'gym:2', date: '2026-10-04', started_at: '2026-10-04T15:00:00-04:00', exercises: [{ action_id: '1083', name: 'Barbell Stiff Leg Deadlift', order: 0, sets: sets([100, 8], [100, 9]) }] };
  const h = exerciseHistory([TODAY, next]).find((x) => x.action_id === '1083');
  expect(newRecords(h.points)).toEqual(['heaviest', 'e1RM', 'set volume', 'most reps']);
  expect(repMaxTable(h.points).find((r) => r.reps === 8).pr).toBe(true);
  expect(repMaxTable(h.points).find((r) => r.reps === 9).actual.kg).toBe(kg(100));
  const rowsOut = exerciseSessionRows(h.points);
  expect(rowsOut[0].date).toBe('2026-10-04');
  expect(rowsOut[0].delta_e1rm_kg).toBeGreaterThan(0);
  expect(rowsOut[1].delta_e1rm_kg).toBeNull();
});
