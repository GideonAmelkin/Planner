// Run: cd frontend && CI=true npx react-scripts test --watchAll=false src/workout/muscles.test.js
import { muscleOf, muscleVolume, MUSCLE_GROUPS } from './muscles';
import { toUnit } from './strength';

// The 2026-09-27 Lower Body session as the snapshot carries it (same fixture as strength.test.js).
const kg = (lb) => Math.round((lb / 2.20462) * 1000) / 1000;
const sets = (...pairs) => pairs.map(([lb, reps]) => ({ reps, weight_kg: kg(lb), finished: true }));
const TODAY = {
  date: '2026-09-27', total_weight_kg: 5429.512,
  exercises: [
    { name: 'Smith Machine Squat', sets: sets([95, 8], [95, 8], [95, 8], [95, 8]) },
    { name: 'Butt Bridge · Dumbbell', sets: sets([25, 8], [25, 8], [25, 8], [25, 10]) },
    { name: 'Barbell Stiff Leg Deadlift', sets: sets([95, 8], [95, 8], [60, 8], [60, 8]) },
    { name: 'Cable Pull Through', sets: sets([30, 8], [30, 8], [30, 8], [30, 8]) },
    { name: 'Machine Seated Hip Abductor', sets: sets([55, 8], [55, 8], [55, 8], [55, 8]) },
    { name: 'Machine Seated Calf Press', sets: sets([90, 8], [90, 8], [90, 8], [90, 8]) },
  ],
};

// Every named gym exercise in the snapshot on 2026-09-28 (sessions and templates), with its group.
const EXPECTED = {
  'Back Squat · Barbell': 'quads', 'Barbell Bent-Arm Pullover': 'chest', 'Barbell Bent-over Row (Reverse Grip)': 'back',
  'Barbell Deadlift': 'back', 'Barbell Front Raise': 'shoulders', 'Barbell Good Morning': 'hamstrings',
  'Barbell Hip Thrust': 'glutes', 'Barbell Incline Bench Press (Close Grip)': 'chest', 'Barbell Overhead Triceps Extension': 'arms',
  'Barbell Stiff Leg Deadlift': 'hamstrings', 'Barbell Sumo Deadlift': 'back', 'Barbell Upright Row': 'shoulders',
  'Barbell Wide Curl': 'arms', 'Bench Press · Barbell': 'chest', 'Bench Press · Dumbbell': 'chest', 'Bent-over Row · Barbell': 'back',
  'Butt Bridge · Dumbbell': 'glutes', 'Cable Hip Abductor': 'glutes', 'Cable Internal Rotation': 'shoulders',
  'Cable Kneeling Crunch': 'core', 'Cable Lat Pulldown': 'back', 'Cable Lat Pulldown (Reverse Grip)': 'back',
  'Cable Lat Pulldown (Straight Arm)': 'back', 'Cable Pull Through': 'glutes', 'Cable Reverse Crunch': 'core',
  'Cable Seated Row (Wide Grip)': 'back', 'Cable Shrug': 'back', 'Cable Standing Chest Press': 'chest',
  'Cable Standing Decline Fly': 'chest', 'Cable Standing Side Crunch': 'core', 'Cable Up-Down Twist': 'core',
  'Cable Upright Row': 'shoulders', 'Chest Press · Machine': 'chest', 'Close Grip Bench Press · Dumbbell': 'chest',
  'Deadlift · Barbell': 'back', 'Drag Curl · Barbell': 'arms', 'Dumbbell Arnold Press': 'shoulders',
  "Dumbbell Farmer's Carry": 'core', 'Dumbbell Front Squat': 'quads', 'Dumbbell Tuck Crunch': 'core',
  'Incline Bench Press · Barbell': 'chest', 'Leg Curl · Machine': 'hamstrings', 'Machine Seated Calf Press': 'calves',
  'Machine Seated Hip Abductor': 'glutes', 'Push Press · Barbell': 'shoulders', 'Reverse Flys': 'shoulders',
  'Russian Twist · Dumbbell': 'core', 'Smith Machine Bicep Curl': 'arms', 'Smith Machine Incline Bench Press': 'chest',
  'Smith Machine Lying Hip Raise': 'glutes', 'Smith Machine Seated Overhead Press': 'shoulders', 'Smith Machine Squat': 'quads',
  'Smith Machine Stiff Leg Deadlift': 'hamstrings', 'Smith Machine Upright Row': 'shoulders', 'Upright-row · Dumbbell': 'shoulders',
};

test('every gym exercise in the snapshot lands in the expected muscle group', () => {
  for (const [name, group] of Object.entries(EXPECTED)) expect([name, muscleOf(name)]).toEqual([name, group]);
  expect(muscleOf('663')).toBe('other');
});

test('the per-group volumes add up to the session total the export computed (drift detector)', () => {
  const v = muscleVolume([TODAY]);
  const sum = Object.values(v).reduce((a, b) => a + b, 0);
  expect(sum).toBeCloseTo(TODAY.total_weight_kg, 2);
  expect(v.other).toBe(0);
  expect(Math.round(toUnit(v.quads, 'lb'))).toBe(3040);       // Smith Machine Squat 95 x 8 x 4
  expect(Math.round(toUnit(v.hamstrings, 'lb'))).toBe(2480);  // Stiff Leg Deadlift
  expect(Math.round(toUnit(v.glutes, 'lb'))).toBe(3570);      // Butt Bridge 850 + Pull Through 960 + Hip Abductor 1760
  expect(Math.round(toUnit(v.calves, 'lb'))).toBe(2880);
  expect(v.chest).toBe(0);
  expect(MUSCLE_GROUPS.map((g) => g.key)).toEqual(['chest', 'back', 'shoulders', 'arms', 'core', 'quads', 'hamstrings', 'glutes', 'calves']);
});
