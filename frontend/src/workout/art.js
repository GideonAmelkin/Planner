// Art from the Home Workouts app (com.abishkking.maleworkout), copied once into
// public/workout-art/ so the Workout tab can present templates the way the app
// does. Never load from the app bundle at runtime.
const BASE = '/workout-art';

// Template title -> the app's image id (from gym_workout.cardImgName).
export const TEMPLATE_ART = {
  'Full Body Workout': 101,
  'Chest Workout': 102,
  'Back Workout': 103,
  'Abs Workout': 104,
  'Arm Workout': 105,
  'Shoulders Workout': 106,
  'Upper Body Workout': 107,
  'V-Taper Workout': 108,
  'Butt Workout': 109,
  'Lower Body Workout': 110,
  'StrongLifts 5×5 · A': 112,
  'StrongLifts 5×5 · B': 113,
};

const idFor = (title) => TEMPLATE_ART[title] || null;
export const templateBanner = (title) => (idFor(title) ? `${BASE}/jpg_img_entrance_${idFor(title)}_m.jpg` : null);
export const templateHeader = (title) => (idFor(title) ? `${BASE}/jpg_img_particulars_${idFor(title)}_m.jpg` : null);
// The app sets banner titles in two uppercase lines: "CHEST" / "WORKOUT".
export function titleLines(name) {
  if (/StrongLifts/.test(name)) return ['STRONGLIFTS', /A$/.test(name.trim()) ? '5×5 A' : '5×5 B'];
  const words = String(name).toUpperCase().split(' ');
  const last = words.pop();
  return [words.join(' '), last];
}

export const APP_BLUE = '#0055FF';
export const POPPINS = "'Poppins', 'DM Sans', sans-serif";

// Which app template's banner stands for a session. A gym session is named after its template;
// a home session is matched by its focus or title ("Chest · Intermediate" -> Chest Workout).
// Null when nothing matches (the caller shows a plain wash).
const HOME_ART = [
  [/chest/i, 'Chest Workout'],
  [/abs|core|belly/i, 'Abs Workout'],
  [/arm|bicep|tricep/i, 'Arm Workout'],
  [/shoulder/i, 'Shoulders Workout'],
  [/butt|glute/i, 'Butt Workout'],
  [/leg|lower/i, 'Lower Body Workout'],
  [/back/i, 'Back Workout'],
  [/upper/i, 'Upper Body Workout'],
  [/full/i, 'Full Body Workout'],
];
export function templateForSession(session) {
  if (!session) return null;
  const title = session.title || '';
  if (TEMPLATE_ART[title]) return title;
  const text = `${session.focus || ''} ${title}`;
  const hit = HOME_ART.find(([re]) => re.test(text));
  return hit ? hit[1] : null;
}
