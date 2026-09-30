import { exerciseHistory, inRange, newRecords } from '../strength';
import { MUSCLE_GROUPS, muscleOf, muscleVolume } from '../muscles';

// Pure data for the Overview view (the body-figure dashboard picked 2026-09-29). Session volume is
// always the export's total_weight_kg; muscle volume is muscles.js's per-set sum, which adds up to it.

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
export const shiftDay = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Longest run of consecutive calendar days that each have at least one workout: { days, start, end }.
export function longestStreak(dates) {
  const days = [...new Set(dates)].sort();
  let best = { days: 0, start: null, end: null };
  let run = 0;
  let runStart = null;
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && daysBetween(days[i - 1], days[i]) === 1) run += 1;
    else { run = 1; runStart = days[i]; }
    if (run > best.days) best = { days: run, start: runStart, end: days[i] };
  }
  return best;
}

// Session length card: minutes per session oldest first, with avg and range (null when empty).
export function sessionLengths(sessions) {
  const rows = [...(sessions || [])].filter((s) => s.duration_s > 0)
    .sort((a, b) => ((a.started_at || a.date) < (b.started_at || b.date) ? -1 : 1))
    .map((s) => ({ date: s.date, title: s.title || s.focus || 'Workout', min: s.duration_s / 60 }));
  if (!rows.length) return { rows, avg: null, min: null, max: null };
  const mins = rows.map((r) => r.min);
  return { rows, avg: mins.reduce((a, b) => a + b, 0) / mins.length, min: Math.min(...mins), max: Math.max(...mins) };
}

// The group with the most volume in one gym session (null when nothing was lifted).
export function dominantMuscle(session) {
  const v = muscleVolume([session]);
  let best = null;
  for (const g of MUSCLE_GROUPS) if (v[g.key] > 0 && (!best || v[g.key] > v[best])) best = g.key;
  return best;
}

// Groups with volume, largest first: [{ key, kg, share }].
export function muscleShares(volumes) {
  const rows = MUSCLE_GROUPS.map((g) => ({ key: g.key, kg: volumes[g.key] || 0 })).filter((r) => r.kg > 0);
  const total = rows.reduce((t, r) => t + r.kg, 0);
  return rows.map((r) => ({ ...r, share: r.kg / total })).sort((a, b) => b.kg - a.kg);
}

// Per group, the exercise in the range that moved the most weight: { [key]: { name, kg } }.
export function topExercises(sessions) {
  const out = {};
  for (const h of exerciseHistory(sessions)) {
    const key = muscleOf(h.name);
    const kg = h.points.reduce((t, p) => t + (p.volume_kg || 0), 0);
    if (kg > 0 && (!out[key] || kg > out[key].kg)) out[key] = { name: h.name || `Exercise ${h.action_id}`, kg };
  }
  return out;
}

// Records set inside [start, end], newest first: each exercise's history up to `end` is replayed and
// every in-range point that beat all earlier sessions is kept. A first-ever session is never a record.
export function recordsInRange(allSessions, start, end) {
  const out = [];
  for (const h of exerciseHistory(inRange(allSessions, '0000-01-01', end))) {
    for (let i = 1; i < h.points.length; i++) {
      const p = h.points[i];
      if (p.date < start) continue;
      const kinds = newRecords(h.points.slice(0, i + 1));
      if (kinds.length) out.push({ action_id: h.action_id, name: h.name, date: p.date, kinds, point: p });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// The day strip: one entry per day in [start, end] with the day's sessions, the kind to draw
// (gym wins over home) and, for gym days, the main muscle group.
export function stripDays(start, end, sessions, strengthById) {
  const byDate = new Map();
  for (const s of sessions || []) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }
  const out = [];
  for (let d = start; d <= end; d = shiftDay(d, 1)) {
    const ss = byDate.get(d) || [];
    const gym = ss.find((s) => s.kind === 'gym');
    const full = gym && strengthById ? strengthById.get(gym.id) : null;
    out.push({ date: d, sessions: ss, kind: gym ? 'gym' : ss.length ? 'home' : null, muscle: full ? dominantMuscle(full) : null });
  }
  return out;
}
