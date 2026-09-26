// Art from the Home Workouts app (com.abishkking.maleworkout), copied once into
// public/workout-art/ so the Workout tab can present templates and the plan the
// way the app does. Never load from the app bundle at runtime.
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
export const templateThumb = (title) => (idFor(title) ? `${BASE}/jpg_img_history_${idFor(title)}_m.jpg` : null);

// One image per day of a 28-day plan (1-based; wraps past 28).
export const planDayThumb = (day) => {
  const n = ((Math.max(1, Number(day) || 1) - 1) % 28) + 1;
  return `${BASE}/webp_v40_img_personalized_thumb_m${String(n).padStart(2, '0')}.webp`;
};

export const PLAN_HERO = `${BASE}/jpg_img_ppm_banner_full.jpg`;

const FOCUS_FILE = { chest: 'chest', shoulder: 'shoulder', shoulders: 'shoulder', leg: 'leg', legs: 'leg', abs: 'abs', arm: 'arm', arms: 'arm', back: 'back' };
export const focusTile = (name) => `${BASE}/v28_img_focusarea_${FOCUS_FILE[String(name || '').toLowerCase()] || 'fullbody'}_m_l.webp`;

// The app sets banner titles in two uppercase lines: "CHEST" / "WORKOUT".
export function titleLines(name) {
  if (/StrongLifts/.test(name)) return ['STRONGLIFTS', /A$/.test(name.trim()) ? '5×5 A' : '5×5 B'];
  const words = String(name).toUpperCase().split(' ');
  const last = words.pop();
  return [words.join(' '), last];
}

export const APP_BLUE = '#0055FF';
export const APP_BLUE_WASH = '#E8F2FF';
export const APP_GREEN = '#27C566';
export const POPPINS = "'Poppins', 'DM Sans', sans-serif";
