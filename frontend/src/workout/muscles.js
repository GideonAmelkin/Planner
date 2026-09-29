// Muscle groups for the Personal Trainer card's body map, balance radar and ticker filter.
// The app has no muscle data for gym exercises (actionAttributes.json in the app bundle tags only
// home exercises), so the group comes from the exercise name by ordered rules; the first match
// wins. muscles.test.js checks every gym name the snapshot holds lands in a real group.

export const MUSCLE_GROUPS = [
  { key: 'chest', label: 'Chest', color: '#5B6BF0' },
  { key: 'back', label: 'Back', color: '#1F9E89' },
  { key: 'shoulders', label: 'Shoulders', color: '#D9912B' },
  { key: 'arms', label: 'Arms', color: '#C2410C' },
  { key: 'core', label: 'Core', color: '#5F7A8A' },
  { key: 'quads', label: 'Quads', color: '#8E44AD' },
  { key: 'hamstrings', label: 'Hamstrings', color: '#D14D72' },
  { key: 'glutes', label: 'Glutes', color: '#2E86DE' },
  { key: 'calves', label: 'Calves', color: '#6B8E23' },
];
export const OTHER = { key: 'other', label: 'Other', color: '#9A9A95' };
export const groupOf = (key) => MUSCLE_GROUPS.find((g) => g.key === key) || OTHER;

// Order matters: "Leg Curl" is hamstrings before "curl" is arms; "Reverse Flys" and "Upright Row"
// are shoulders before "fly" is chest and "row" is back; "Bench Press" is chest before "press" is shoulders.
const RULES = [
  ['calves', /calf/i],
  ['core', /crunch|twist|farmer|plank|sit-?up/i],
  ['glutes', /hip (abductor|thrust|raise)|bridge|pull through|glute/i],
  ['hamstrings', /leg curl|stiff leg|good morning|romanian/i],
  ['shoulders', /reverse fly|upright[- ]row|face pull/i],
  ['quads', /squat|leg press|lunge|leg extension|step-?up/i],
  ['chest', /bench|chest|fly|pullover|push-?up|dip/i],
  ['back', /pulldown|pull-?up|chin-?up|row|shrug|deadlift/i],
  ['shoulders', /overhead press|shoulder press|arnold|push press|raise|rotation/i],
  ['arms', /curl|tricep|extension|kickback/i],
];

export function muscleOf(name) {
  const n = String(name || '');
  const hit = RULES.find(([, re]) => re.test(n));
  return hit ? hit[0] : 'other';
}

// Kilograms lifted (weight x reps of every done set) per group, over the given sessions.
// Same arithmetic as the export's total_weight_kg, so the groups add up to the sessions' total.
export function muscleVolume(sessions) {
  const out = Object.fromEntries([...MUSCLE_GROUPS, OTHER].map((g) => [g.key, 0]));
  for (const s of sessions || []) {
    for (const e of s.exercises || []) {
      const kg = (e.sets || []).reduce((t, x) => t + (Number(x.weight_kg) > 0 && Number(x.reps) > 0 ? Number(x.weight_kg) * Number(x.reps) : 0), 0);
      out[muscleOf(e.name)] += kg;
    }
  }
  return out;
}
