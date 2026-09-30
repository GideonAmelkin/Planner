// Run: cd frontend && CI=true npx react-scripts test --watchAll=false src/workout/art.test.js
import { templateForSession } from './art';

test('a session picks the banner of the workout done (real snapshot titles, 2026-09)', () => {
  expect(templateForSession({ kind: 'gym', title: 'Arm Workout', focus: 'Arm' })).toBe('Arm Workout');
  expect(templateForSession({ kind: 'gym', title: 'Chest Workout', focus: 'Chest' })).toBe('Chest Workout');
  expect(templateForSession({ kind: 'gym', title: 'Lower Body Workout', focus: 'Lower Body' })).toBe('Lower Body Workout');
  expect(templateForSession({ kind: 'home', title: 'Chest · Intermediate', focus: 'Chest' })).toBe('Chest Workout');
  expect(templateForSession({ kind: 'home', title: 'Abs · Beginner', focus: 'Abs' })).toBe('Abs Workout');
  expect(templateForSession({ kind: 'home', title: 'Leg', focus: 'Leg' })).toBe('Lower Body Workout');
  expect(templateForSession({ kind: 'home', title: 'Stretching' })).toBeNull();
  expect(templateForSession(null)).toBeNull();
});
