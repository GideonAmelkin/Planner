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

// Epley estimate of a one-rep max. A single rep is its own max. Above EPLEY_MAX_REPS the estimate
// stops meaning anything (Stronglifts shows NA there), so it is null and the set counts for
// volume and reps only.
export const EPLEY_MAX_REPS = 12;
export const epley = (weightKg, reps) => (!weightKg || !reps || reps > EPLEY_MAX_REPS ? null : (reps === 1 ? weightKg : weightKg * (1 + reps / 30)));
// The same curve read the other way: what the e1RM implies at r reps (r = 10 gives the e10RM).
export const weightAtReps = (e1rmKg, reps) => (e1rmKg === null || e1rmKg === undefined ? null : (reps === 1 ? e1rmKg : e1rmKg / (1 + reps / 30)));
export const e10rm = (e1rmKg) => weightAtReps(e1rmKg, 10);

const num = (v) => (v === null || v === undefined ? 0 : Number(v) || 0);

// One exercise in one session: its best set (highest estimated 1RM, heavier weight on ties),
// heaviest weight, the volume of its sets and the set count.
export function setStats(sets) {
  const done = (sets || []).filter((s) => num(s.weight_kg) > 0 && num(s.reps) > 0);
  let best = null;
  let e1rm = null;
  let heaviest = null;
  let volume = 0;
  let reps = 0;
  let mostReps = null;
  let bestSetVolume = null;
  for (const s of done) {
    const w = num(s.weight_kg);
    const r = num(s.reps);
    const e = epley(w, r);
    volume += w * r;
    reps += r;
    if (heaviest === null || w > heaviest) heaviest = w;
    if (mostReps === null || r > mostReps.reps || (r === mostReps.reps && w > mostReps.weight_kg)) mostReps = { weight_kg: w, reps: r };
    if (bestSetVolume === null || w * r > bestSetVolume.weight_kg * bestSetVolume.reps) bestSetVolume = { weight_kg: w, reps: r };
    if (e !== null && (best === null || e > e1rm || (e === e1rm && w > num(best.weight_kg)))) { best = { weight_kg: w, reps: r }; e1rm = e; }
  }
  if (best === null && done.length) best = { weight_kg: heaviest, reps: done.find((s) => num(s.weight_kg) === heaviest).reps }; // every set above the Epley cap
  return { best, e1rm_kg: e1rm, heaviest_kg: heaviest, volume_kg: volume, reps, most_reps: mostReps, best_set_volume: bestSetVolume, sets: done.length, all_sets: (sets || []).length,
           set_list: done.map((s) => ({ weight_kg: num(s.weight_kg), reps: num(s.reps) })) };
}

// "95 × 8 (×4)"; differing sets grouped in order: "95 × 8 (×2), 60 × 8 (×2)". When the first group
// is the heaviest and every later group is lighter, the later groups are backoff sets and say so.
export function compressSets(sets, unit) {
  const groups = [];
  for (const s of sets || []) {
    const w = num(s.weight_kg);
    const r = num(s.reps);
    const last = groups[groups.length - 1];
    if (last && last.weight_kg === w && last.reps === r) last.n += 1;
    else groups.push({ weight_kg: w, reps: r, n: 1 });
  }
  if (!groups.length) return '';
  const text = (g) => `${fmtWeight(g.weight_kg, unit)} × ${g.reps}${g.n > 1 ? ` (×${g.n})` : ''}`;
  const topThenBackoff = groups.length > 1 && groups.slice(1).every((g) => g.weight_kg < groups[0].weight_kg);
  if (topThenBackoff) return `${text(groups[0])}, backoff ${groups.slice(1).map(text).join(', ')}`;
  return groups.map(text).join(', ');
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

// Personal records for one exercise, each with its date: heaviest weight, best estimated 1RM
// (and its e10RM), best set volume, best session volume, most reps in a set. Progress has more
// than one face (heaviest, most reps, most volume, best e1RM, best e10RM), so all are kept.
export function records(points) {
  let heaviest = null;
  let bestE1rm = null;
  let bestSet = null;
  let bestSession = null;
  let mostReps = null;
  for (const p of points || []) {
    if (p.heaviest_kg !== null && (!heaviest || p.heaviest_kg > heaviest.kg)) heaviest = { kg: p.heaviest_kg, date: p.date };
    if (p.e1rm_kg !== null && p.e1rm_kg !== undefined && (!bestE1rm || p.e1rm_kg > bestE1rm.kg)) bestE1rm = { kg: p.e1rm_kg, e10rm_kg: e10rm(p.e1rm_kg), date: p.date, set: p.best };
    const sv = p.best_set_volume;
    if (sv && (!bestSet || sv.weight_kg * sv.reps > bestSet.kg)) bestSet = { kg: sv.weight_kg * sv.reps, date: p.date, set: sv };
    if (!bestSession || p.volume_kg > bestSession.kg) bestSession = { kg: p.volume_kg, date: p.date };
    if (p.most_reps && (!mostReps || p.most_reps.reps > mostReps.set.reps)) mostReps = { set: p.most_reps, date: p.date };
  }
  return { heaviest, bestE1rm, bestSet, bestSession, mostReps };
}

// Which records the newest session set for one exercise, against every earlier session (none when
// there is no earlier session: a first-ever value is not a record against anything).
export function newRecords(points) {
  if (!points || points.length < 2) return [];
  const earlier = records(points.slice(0, -1));
  const last = points[points.length - 1];
  const out = [];
  if (last.heaviest_kg !== null && earlier.heaviest && last.heaviest_kg > earlier.heaviest.kg) out.push('heaviest');
  if (last.e1rm_kg !== null && earlier.bestE1rm && last.e1rm_kg > earlier.bestE1rm.kg) out.push('e1RM');
  if (last.best_set_volume && earlier.bestSet && last.best_set_volume.weight_kg * last.best_set_volume.reps > earlier.bestSet.kg) out.push('set volume');
  if (earlier.bestSession && last.volume_kg > earlier.bestSession.kg) out.push('session volume');
  if (last.most_reps && earlier.mostReps && last.most_reps.reps > earlier.mostReps.set.reps) out.push('most reps');
  return out;
}

// The rep-max table: for each rep count, the best weight actually lifted for exactly that many reps
// (with its date) and what the best e1RM implies at that count. Rows are the union of the anchor
// counts and every count actually performed, up to the Epley cap. A row is a PR when its actual came
// from the newest session and beats every earlier session at that count (needs two sessions).
export const REP_MAX_ANCHORS = [1, 2, 3, 5, 8, 10, 12];
export function repMaxTable(points) {
  const pts = points || [];
  const rec = records(pts);
  const e1 = rec.bestE1rm ? rec.bestE1rm.kg : null;
  const actual = new Map();
  const earlierBest = new Map();
  pts.forEach((p, i) => {
    for (const s of p.set_list || []) {
      if (s.reps > EPLEY_MAX_REPS) continue;
      const cur = actual.get(s.reps);
      if (!cur || s.weight_kg > cur.kg) actual.set(s.reps, { kg: s.weight_kg, date: p.date, latest: i === pts.length - 1 });
      if (i < pts.length - 1) { const eb = earlierBest.get(s.reps); if (!eb || s.weight_kg > eb) earlierBest.set(s.reps, s.weight_kg); }
    }
  });
  const rows = [...new Set([...REP_MAX_ANCHORS, ...actual.keys()])].filter((r) => r <= EPLEY_MAX_REPS).sort((a, b) => a - b);
  return rows.map((reps) => {
    const a = actual.get(reps) || null;
    const eb = earlierBest.get(reps);
    return { reps, actual: a, estimated_kg: weightAtReps(e1, reps), pr: !!(a && a.latest && pts.length > 1 && (eb === undefined || a.kg > eb)) };
  });
}

// Per-session rows for one exercise, newest first, each with the e1RM delta from the session before.
export function exerciseSessionRows(points) {
  const pts = points || [];
  return pts.map((p, i) => ({ ...p, delta_e1rm_kg: i > 0 && p.e1rm_kg !== null && pts[i - 1].e1rm_kg !== null ? p.e1rm_kg - pts[i - 1].e1rm_kg : null })).reverse();
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

// One entry per week from the first week with data up to endISO (no empty leading weeks), volume =
// the sessions' own total_weight_kg. Tonnage is dominated by leg work; sets per muscle group (as
// Hevy's main volume view) is the better measure and needs a muscle map keyed on action_id, which
// the export does not have yet.
export function weeklyVolume(sessions, startISO, endISO) {
  const weeks = [];
  const byStart = new Map();
  const inWindow = inRange(sessions, weekStart(startISO), endISO);
  const firstWeek = inWindow.length ? weekStart(inWindow.map((s) => s.date).sort()[0]) : weekStart(startISO);
  for (let w = firstWeek; w <= endISO; w = shift(w, 7)) {
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
