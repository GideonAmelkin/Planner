// Pure strength-progress math for the Personal Trainer card. No React, no fetch; tested in
// strength.test.js against today's real session. Weights arrive in kg (the export converts);
// the display unit is the session's own (`weight_unit`, lb for this user).
//
// Session volume is NOT recomputed here: `total_weight_kg` already comes from the sets in
// export.py, so it is the one number; per-exercise volumes are summed only for the exercise
// rows, and the test asserts their sum equals `total_weight_kg` (a drift detector, nothing else).

export const KG_TO_LB = 2.20462;

export const toUnit = (kg, unit) => (kg === null || kg === undefined ? null : (unit === 'kg' ? kg : kg * KG_TO_LB));

// A displayed weight round-trips to what the app shows: kg stored to 3 decimals comes back as
// 94.9995 lb, so display rounds to the nearest 0.5 in the display unit (95, 27.5).
export const displayWeight = (kg, unit) => {
  const v = toUnit(kg, unit);
  return v === null ? null : Math.round(v * 2) / 2;
};
export const fmtWeight = (kg, unit) => {
  const v = displayWeight(kg, unit);
  return v === null ? '-' : (Number.isInteger(v) ? String(v) : v.toFixed(1));
};

// Epley estimate of a one-rep max. A single rep is its own max.
export const epley = (weightKg, reps) => (!weightKg || !reps ? null : (reps === 1 ? weightKg : weightKg * (1 + reps / 30)));

const num = (v) => (v === null || v === undefined ? 0 : Number(v) || 0);

// One exercise in one session: its best set (highest estimated 1RM, heavier weight on ties),
// heaviest weight, the volume of its sets and the set count.
export function setStats(sets) {
  const done = (sets || []).filter((s) => num(s.weight_kg) > 0 && num(s.reps) > 0);
  let best = null;
  let e1rm = null;
  let heaviest = null;
  let volume = 0;
  for (const s of done) {
    const e = epley(num(s.weight_kg), num(s.reps));
    volume += num(s.weight_kg) * num(s.reps);
    if (heaviest === null || num(s.weight_kg) > heaviest) heaviest = num(s.weight_kg);
    if (best === null || e > e1rm || (e === e1rm && num(s.weight_kg) > num(best.weight_kg))) { best = { weight_kg: num(s.weight_kg), reps: num(s.reps) }; e1rm = e; }
  }
  return { best, e1rm_kg: e1rm, heaviest_kg: heaviest, volume_kg: volume, sets: done.length, all_sets: (sets || []).length };
}

// null when the export could not resolve a name (a bare id): the card marks those.
export const exerciseName = (e) => (e && e.name && !/^\d+$/.test(String(e.name)) ? e.name : null);

// Per exercise (by action_id), every session it appears in, oldest first.
export function exerciseHistory(sessions) {
  const byId = new Map();
  const ordered = [...(sessions || [])].sort((a, b) => ((a.started_at || a.date || '') < (b.started_at || b.date || '') ? -1 : 1));
  for (const s of ordered) {
    for (const e of s.exercises || []) {
      const id = String(e.action_id);
      const stats = setStats(e.sets);
      if (!stats.sets) continue;
      let h = byId.get(id);
      if (!h) { h = { action_id: id, name: exerciseName(e), points: [] }; byId.set(id, h); }
      if (!h.name) h.name = exerciseName(e);
      h.points.push({ date: s.date, session_id: s.id, title: s.title, ...stats });
    }
  }
  return [...byId.values()];
}

// Personal records for one exercise: heaviest weight, best set volume, best session volume.
export function records(points) {
  let heaviest = null;
  let bestSet = null;
  let bestSession = null;
  for (const p of points || []) {
    if (p.heaviest_kg !== null && (!heaviest || p.heaviest_kg > heaviest.kg)) heaviest = { kg: p.heaviest_kg, date: p.date };
    const setVol = p.best ? p.best.weight_kg * p.best.reps : 0;
    if (p.best && (!bestSet || setVol > bestSet.kg)) bestSet = { kg: setVol, date: p.date, set: p.best };
    if (!bestSession || p.volume_kg > bestSession.kg) bestSession = { kg: p.volume_kg, date: p.date };
  }
  return { heaviest, bestSet, bestSession };
}

// Sessions whose date is inside [startISO, endISO].
export const inRange = (sessions, startISO, endISO) => (sessions || []).filter((s) => s.date >= startISO && s.date <= endISO);

const shift = (iso, days) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Sunday-start weeks, like the mini calendar.
export const weekStart = (iso) => shift(iso, -new Date(`${iso}T12:00:00`).getDay());

// One entry per week covering [startISO, endISO], volume = the sessions' own total_weight_kg.
export function weeklyVolume(sessions, startISO, endISO) {
  const weeks = [];
  const byStart = new Map();
  for (let w = weekStart(startISO); w <= endISO; w = shift(w, 7)) {
    const entry = { start: w, end: shift(w, 6), volume_kg: 0, sessions: 0 };
    weeks.push(entry);
    byStart.set(w, entry);
  }
  for (const s of inRange(sessions, weekStart(startISO), endISO)) {
    const entry = byStart.get(weekStart(s.date));
    if (!entry) continue;
    entry.volume_kg += num(s.total_weight_kg);
    entry.sessions += 1;
  }
  return weeks;
}

// The latest session against the previous time each of its exercises was done (any range).
export function compareToPrevious(latest, allSessions) {
  if (!latest) return [];
  const history = exerciseHistory(allSessions);
  return (latest.exercises || []).map((e) => {
    const id = String(e.action_id);
    const now = setStats(e.sets);
    const h = history.find((x) => x.action_id === id);
    const prev = h ? [...h.points].reverse().find((p) => p.session_id !== latest.id && p.date <= latest.date) : null;
    if (!now.sets) return { action_id: id, name: exerciseName(e), status: 'empty', now };
    if (!prev) return { action_id: id, name: exerciseName(e), status: 'first', now };
    const d = (now.e1rm_kg || 0) - (prev.e1rm_kg || 0);
    return { action_id: id, name: exerciseName(e), status: Math.abs(d) < 0.05 ? 'same' : d > 0 ? 'up' : 'down', now, prev, delta_e1rm_kg: d, delta_best_weight_kg: (now.best ? now.best.weight_kg : 0) - (prev.best ? prev.best.weight_kg : 0) };
  });
}
