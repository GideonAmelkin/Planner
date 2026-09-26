#!/usr/bin/env python3
"""Export the Home Workouts app (bundle com.abishkking.maleworkout, "Home Workout -
No Equipments") into one JSON snapshot the Planner backend can serve.

Runs on the Mac where the app is installed (it is an iPhone app running on
macOS). Stdlib only, Python 3.9. Reads:

  <container>/Documents/db/LKDB.db              gym sessions, sets, templates, weight
  <container>/Documents/DBfolder/userexe.sqlite the 28-day plan
  <container>/Library/Preferences/<bundle>.plist awards, profile
  <container>/Library/InjuryAdaptation/v1/user_state.json  height, injuries
  <bundle>/Resource/Mapping/en_b.json, en_p.json, <bundle>/actionAttributes.json
                                                exercise id -> name

The SQLite files are copied to a temp dir and opened read-only, so a running
app is never touched. Every source table is reconciled: rows read must equal
objects emitted plus rows deliberately excluded, or the export fails with the
numbers printed. Nothing is dropped silently.

    python3 export.py                       # writes the default snapshot path
    python3 export.py --out /tmp/x.json     # elsewhere
    python3 export.py --stdout              # print the JSON
"""
import argparse
import base64
import json
import os
import plistlib
import shutil
import sqlite3
import sys
import tempfile
from datetime import datetime, timezone

SCHEMA_VERSION = 1
BUNDLE_ID = 'com.abishkking.maleworkout'
DEFAULT_CONTAINER = os.path.expanduser('~/Library/Containers/%s/Data' % BUNDLE_ID)
DEFAULT_BUNDLE = '/Applications/Home Workouts.app/Wrapper/homeworkout.app'
DEFAULT_OUT = os.path.expanduser('~/Library/Application Support/PlannerHomeWorkouts/home_workouts.json')

# Epoch values outside this window are treated as a unit mistake, not a date.
MIN_YEAR, MAX_YEAR = 2015, 2035
MS_THRESHOLD = 1e11   # 10^11 seconds is the year 5138; anything bigger is milliseconds


class ExportError(Exception):
    pass


# Time helpers -----------------------------------------------------------------

def epoch_to_dt(value, what):
    """Epoch seconds or milliseconds -> aware datetime in the Mac's local zone.
    The unit is detected by magnitude and the result must fall in 2015..2035."""
    if value is None or value == '':
        return None
    v = float(value)
    if v == 0:
        return None
    if v > MS_THRESHOLD:
        v = v / 1000.0
    try:
        dt = datetime.fromtimestamp(v, tz=timezone.utc).astimezone()
    except (ValueError, OverflowError, OSError):
        raise ExportError('%s: epoch %r is not a usable timestamp' % (what, value))
    if not (MIN_YEAR <= dt.year <= MAX_YEAR):
        raise ExportError('%s: epoch %r is outside %d..%d' % (what, value, MIN_YEAR, MAX_YEAR))
    return dt


def local_iso(dt):
    return dt.isoformat(timespec='seconds') if dt else None


def local_date(dt):
    return dt.date().isoformat() if dt else None


def utc_date(value, what):
    """For columns that hold midnight UTC of a calendar day (weight.date, workout.date).
    Converting those to the Mac's zone lands on the evening before, one day early."""
    dt = epoch_to_dt(value, what)
    return dt.astimezone(timezone.utc).date().isoformat() if dt else None


def to_float(v):
    try:
        return float(v) if v not in (None, '') else None
    except (TypeError, ValueError):
        return None


def to_int(v):
    f = to_float(v)
    return int(f) if f is not None else None


# SQLite -----------------------------------------------------------------------

def open_ro(path, tmpdir):
    """Copy the database (with its -wal/-shm) into tmpdir and open the copy read-only."""
    if not os.path.exists(path):
        raise ExportError('missing database: %s' % path)
    copy = os.path.join(tmpdir, os.path.basename(path))
    shutil.copy2(path, copy)
    for suffix in ('-wal', '-shm'):
        if os.path.exists(path + suffix):
            shutil.copy2(path + suffix, copy + suffix)
    conn = sqlite3.connect('file:%s?mode=ro' % copy, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def rows(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params)]


def count(conn, table):
    return conn.execute('SELECT count(*) FROM %s' % table).fetchone()[0]


# LKDBHelper wraps JSON and model-pointer columns as {"DB_Type": ..., "DB_Value": ...}.
def lk_value(text):
    if not text:
        return None
    try:
        obj = json.loads(text)
    except ValueError:
        return None
    if isinstance(obj, dict) and 'DB_Value' in obj:
        return obj['DB_Value']
    return obj


def b64_json(text):
    if not text:
        return []
    try:
        return json.loads(base64.b64decode(text).decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        raise ExportError('plan day: exercise blob is not base64 JSON')


# Names ------------------------------------------------------------------------

class Names:
    """Exercise id -> English name. en_b.json wins over en_p.json over actionAttributes."""

    def __init__(self, bundle):
        self.map = {}
        attrs = self._load(os.path.join(bundle, 'actionAttributes.json'))
        if isinstance(attrs, list):
            for e in attrs:
                if isinstance(e, dict) and e.get('actionId') and e.get('name'):
                    self.map[str(e['actionId'])] = e['name']
        for fname in ('en_p.json', 'en_b.json'):   # later files override
            d = self._load(os.path.join(bundle, 'Resource', 'Mapping', fname))
            if isinstance(d, dict):
                for k, v in d.items():
                    if isinstance(v, str) and v:
                        self.map[str(k)] = v
        self.unresolved = set()

    @staticmethod
    def _load(path):
        if not os.path.exists(path):
            return None
        with open(path, 'rb') as f:
            return json.load(f)

    def get(self, action_id, fallback=None):
        key = str(action_id)
        if key in self.map:
            return self.map[key]
        if fallback:
            return fallback
        self.unresolved.add(key)
        return key


# Extractors -------------------------------------------------------------------

def read_sets(lk):
    """(workoutId, actionId) -> [sets], preserving row order."""
    index = {}
    total = 0
    for r in rows(lk, 'SELECT * FROM workout_action_set ORDER BY rowid'):
        total += 1
        index.setdefault((r['workoutId'], str(r['actionId'])), []).append({
            'reps': to_int(r['reps']),
            'weight_kg': to_float(r['weight']),
            'finished': bool(r['isFinished']),
        })
    return index, total


def exercise_from_action(action, sets_index, names, order):
    key = (action['workoutId'], str(action['actionId']))
    return {
        'action_id': str(action['actionId']),
        'name': names.get(action['actionId']),
        'order': order,
        'unit': action.get('unit') or '',
        'sets': list(sets_index.get(key, [])),
    }


def read_templates(lk, names, sets_index, counts):
    templates = []
    actions_by_rowid = {a['rowid']: a for a in rows(lk, 'SELECT * FROM workout_action')}
    counts['workout_action'] = len(actions_by_rowid)
    used_action_rowids = set()
    used_set_keys = set()
    deleted = 0
    for t in rows(lk, 'SELECT *, workoutId AS wid FROM gym_workout ORDER BY orderIndex, workoutId'):
        if t.get('isDeleted'):
            deleted += 1
            continue
        pointers = lk_value(t.get('exercises')) or []
        exercises = []
        for i, p in enumerate(pointers):
            rid = p.get('DB_RowId') if isinstance(p, dict) else None
            action = actions_by_rowid.get(rid)
            if action is None:
                raise ExportError('template %s points at workout_action rowid %r which does not exist' % (t['wid'], rid))
            used_action_rowids.add(rid)
            used_set_keys.add((action['workoutId'], str(action['actionId'])))
            exercises.append(exercise_from_action(action, sets_index, names, i))
        templates.append({
            'id': t['wid'],
            'name': t.get('title') or t.get('name'),
            'key': t.get('name'),
            'group': t.get('detailName'),
            'is_5x5': bool(t.get('is5X5Workout')),
            'edited_by_user': bool(t.get('editedByUser')),
            'updated_at': local_iso(epoch_to_dt(t.get('updateTime'), 'gym_workout.updateTime')),
            'exercises': exercises,
        })
    counts['gym_workout'] = len(templates) + deleted
    counts['templates'] = len(templates)
    counts['templates_deleted'] = deleted
    counts['template_exercises'] = sum(len(t['exercises']) for t in templates)
    # Superseded action rows: the app rewrites templates and leaves old rows behind.
    counts['workout_action_unreferenced'] = len(actions_by_rowid) - len(used_action_rowids)
    return templates, used_set_keys


def read_gym_sessions(lk, names, sets_index, counts):
    """workout_record rows -> sessions. Exercises come from workout_action rows whose
    workoutId equals the record's timeStamp (verified against a restored backup;
    counts.gym_sessions_without_exercises says how many found none)."""
    actions_by_workout = {}
    for a in rows(lk, 'SELECT * FROM workout_action ORDER BY orderIndex, rowid'):
        actions_by_workout.setdefault(a['workoutId'], []).append(a)
    sessions = []
    deleted = 0
    without = 0
    for r in rows(lk, 'SELECT * FROM workout_record ORDER BY startTime'):
        if r.get('isDeleted'):
            deleted += 1
            continue
        started = epoch_to_dt(r.get('startTime') or r.get('timeStamp'), 'workout_record.startTime')
        acts = actions_by_workout.get(r['timeStamp'], [])
        seen = set()
        exercises = []
        for a in acts:
            k = str(a['actionId'])
            if k in seen:
                continue
            seen.add(k)
            exercises.append(exercise_from_action(a, sets_index, names, len(exercises)))
        if not exercises:
            without += 1
        sessions.append({
            'id': 'gym:%s' % r['timeStamp'],
            'kind': 'gym',
            'title': r.get('title') or 'Gym workout',
            'template_id': r.get('templateId'),
            'started_at': local_iso(started),
            'date': local_date(started),
            'duration_s': to_int(r.get('duration')),
            'rest_s': to_int(r.get('restTime')),
            'calories': to_int(r.get('cal')),
            'total_weight_kg': to_float(r.get('totalSIWeight')),
            'exercises': exercises,
        })
    counts['workout_record'] = len(sessions) + deleted
    counts['gym_sessions'] = len(sessions)
    counts['gym_sessions_deleted'] = deleted
    counts['gym_sessions_without_exercises'] = without
    return sessions


def home_timings(raw):
    """workout.temp1: JSON {"<position>": "<start ms>:<end ms>"} for each completed exercise.
    Current app versions write this and leave eachActionTimeDicStr empty. Positions are the
    order in the session, not action ids, so names cannot be resolved from it.
    Returns [(position, start_ms, end_ms)] sorted by position, [] when absent or unreadable."""
    if not raw:
        return []
    try:
        d = json.loads(raw)
    except ValueError:
        return []
    if not isinstance(d, dict):
        return []
    out = []
    for k, v in d.items():
        try:
            a, b = str(v).split(':')[:2]
            out.append((int(k), int(a), int(b)))
        except (ValueError, TypeError):
            continue
    return sorted(out)


def read_home_sessions(lk, names, counts):
    """workout rows (bodyweight / plan sessions) -> sessions. workout.date is midnight UTC of
    the day the app files the session under (verified against temp1: sessions finished just
    before local midnight are filed on the next day), so the date comes from utc_date."""
    sessions = []
    from_temp1 = 0
    for r in rows(lk, 'SELECT * FROM workout ORDER BY date'):
        day = utc_date(r.get('date'), 'workout.date')
        timings = home_timings(r.get('temp1'))
        if timings:
            started_at = local_iso(epoch_to_dt(min(t[1] for t in timings), 'workout.temp1'))
        else:
            started_at = '%sT00:00:00' % day if day else None
        exercises = []
        times = lk_value(r.get('eachActionTimeDicStr'))
        if isinstance(times, dict):
            for i, (k, v) in enumerate(times.items()):
                exercises.append({'action_id': str(k), 'name': names.get(k), 'order': i, 'seconds': to_int(v), 'sets': []})
        if not exercises and timings:
            from_temp1 += 1
            exercises = [{'action_id': None, 'name': None, 'order': pos, 'seconds': int(round((end - start) / 1000.0)), 'sets': []}
                         for pos, start, end in timings]
        sessions.append({
            'id': 'home:%s:%s' % (r['ID'], r.get('date')),
            'kind': 'home',
            'title': r.get('name') or r.get('localizedKey') or 'Workout',
            'sport_type': r.get('sportType'),
            'day_index': r.get('dayIndex'),
            'started_at': started_at,
            'date': day,
            'duration_s': to_int(r.get('during')),
            'calories': to_float(r.get('kcalStr')),
            'total_count': to_int(r.get('totalCount')),
            'complete_count': to_int(r.get('completeCount')),
            'distance_m': to_float(r.get('distance')) or None,
            'exercises': exercises,
        })
    counts['workout'] = len(sessions)
    counts['home_sessions'] = len(sessions)
    counts['home_sessions_from_temp1'] = from_temp1
    return sessions


def read_weights(lk, counts):
    out = []
    for r in rows(lk, 'SELECT * FROM weight ORDER BY date, ID'):
        at = epoch_to_dt(r.get('startDate') or r.get('updateDate'), 'weight.startDate')
        out.append({
            'date': utc_date(r.get('date'), 'weight.date') or local_date(at),
            'at': local_iso(at),
            'kg': to_float(r.get('weight')),
        })
    counts['weight'] = len(out)
    return out


def plan_name_from_image(image_name):
    # exe_imageName looks like chest_m104 / leg_m114 / shoulder_m60.
    if not image_name:
        return None
    stem = str(image_name).split('_')[0]
    return stem[:1].upper() + stem[1:] if stem else None


def read_plan(lk, plan_db, names, counts):
    progress = rows(lk, 'SELECT * FROM HWPlanProgressModel ORDER BY rowid DESC LIMIT 1')
    counts['HWPlanProgressModel'] = count(lk, 'HWPlanProgressModel')
    p = progress[0] if progress else {}
    days = []
    for d in rows(plan_db, 'SELECT * FROM exe_table ORDER BY exe_id'):
        workouts = b64_json(d.get('exe_workoutsDetail'))
        warmups = b64_json(d.get('exe_warmupsDetail'))
        cooldown = b64_json(d.get('exe_coolDownDetail'))
        done = epoch_to_dt(d.get('exe_exerciseDate'), 'exe_table.exe_exerciseDate')
        days.append({
            'day': to_int(d.get('exe_id')),
            'name': d.get('exe_name') or plan_name_from_image(d.get('exe_imageName')),
            'type': d.get('exe_workoutType'),
            'rounds': to_int(d.get('exe_cycleRound')),
            'minutes': to_int(d.get('exe_min')),
            'total_count': to_int(d.get('exe_totalCount')),
            'complete_count': to_int(d.get('exe_completeCount')),
            'done_at': local_iso(done),
            'created_at': local_iso(epoch_to_dt(d.get('exe_create_date'), 'exe_table.exe_create_date')),
            'exercises': [{
                'action_id': str(e.get('Id')),
                'name': names.get(e.get('Id'), fallback=(e.get('enName') or '').strip().title() or None),
                'order': i,
                'seconds': to_int(e.get('time')),
                'rest_s': to_int(e.get('restTime')),
                'unit': e.get('unit') or '',
                'each_side': bool(e.get('eachSide')),
            } for i, e in enumerate(workouts)],
            'warmup_count': len(warmups),
            'cooldown_count': len(cooldown),
        })
    counts['exe_table'] = len(days)
    counts['plan_days'] = len(days)
    return {
        'goal': p.get('goal'),
        'total_days': p.get('totalDays'),
        'finish_days': p.get('finishDays'),
        'current_day_index': p.get('currentDayIndex'),
        'is_finished': bool(p.get('isFinish')),
        'workout_days': p.get('workoutDays'),
        'focus_area': p.get('focusArea'),
        'difficulty': p.get('planDifficulty'),
        'updated_at': local_iso(epoch_to_dt(p.get('updateTime'), 'HWPlanProgressModel.updateTime')) if p else None,
        'days': days,
    }


def read_prefs(container):
    path = os.path.join(container, 'Library', 'Preferences', BUNDLE_ID + '.plist')
    if not os.path.exists(path):
        return {}
    with open(path, 'rb') as f:
        return plistlib.load(f)


def read_user_state(container):
    path = os.path.join(container, 'Library', 'InjuryAdaptation', 'v1', 'user_state.json')
    if not os.path.exists(path):
        return {}
    with open(path, 'rb') as f:
        return json.load(f)


def awards_from_prefs(prefs):
    a = prefs.get('awardData') or {}
    days = a.get('activeDays') or []
    return {
        'streak': to_int(a.get('streak')),
        'workout_count': to_int(a.get('workoutCount')),
        'active_time_min': to_int(a.get('activeTimeMin')),
        'active_days': [str(d) for d in days],
    }


def profile_from(prefs, state):
    raw = (state or {}).get('rawInputs') or {}
    return {
        'age': to_int(prefs.get('UserAge')),
        'current_weight_kg': to_float(prefs.get('currentWeight')),
        'target_weight_kg': to_float(prefs.get('targetWeight')),
        'height_cm': to_float(raw.get('heightcm')),
        'bmi': to_float(raw.get('bmiComputed')),
        'is_male': raw.get('isMale'),
        'injuries': (state or {}).get('injuries') or [],
        'shows_kg': bool(prefs.get('weightWithkg', False)),
        'pro': bool(prefs.get('proUser', False)),
    }


def app_version(bundle):
    path = os.path.join(bundle, 'Info.plist')
    try:
        with open(path, 'rb') as f:
            return plistlib.load(f).get('CFBundleShortVersionString')
    except (OSError, plistlib.InvalidFileException):
        return None


# Reconciliation ---------------------------------------------------------------

def reconcile(counts, sets_total, attached_set_keys, sets_index):
    """Every source row is emitted or counted as excluded; anything else fails."""
    checks = [
        ('workout_record', counts['workout_record'], counts['gym_sessions'] + counts['gym_sessions_deleted']),
        ('workout', counts['workout'], counts['home_sessions']),
        ('gym_workout', counts['gym_workout'], counts['templates'] + counts['templates_deleted']),
        ('exe_table', counts['exe_table'], counts['plan_days']),
    ]
    problems = []
    for name, read, emitted in checks:
        if read != emitted:
            problems.append('%s: read %d, emitted %d' % (name, read, emitted))
    attached = sum(len(sets_index.get(k, [])) for k in attached_set_keys)
    counts['workout_action_set'] = sets_total
    counts['sets_attached'] = attached
    counts['sets_unattached'] = sets_total - attached
    if attached > sets_total:
        problems.append('workout_action_set: attached %d exceeds rows %d' % (attached, sets_total))
    if problems:
        raise ExportError('reconciliation failed: ' + '; '.join(problems))


# Main -------------------------------------------------------------------------

def build_snapshot(container, bundle):
    lkdb_path = os.path.join(container, 'Documents', 'db', 'LKDB.db')
    plan_path = os.path.join(container, 'Documents', 'DBfolder', 'userexe.sqlite')
    prefs_path = os.path.join(container, 'Library', 'Preferences', BUNDLE_ID + '.plist')
    names = Names(bundle)
    counts = {}
    tmpdir = tempfile.mkdtemp(prefix='homeworkouts-')
    try:
        lk = open_ro(lkdb_path, tmpdir)
        plan_db = open_ro(plan_path, tmpdir)
        sets_index, sets_total = read_sets(lk)
        templates, template_set_keys = read_templates(lk, names, sets_index, counts)
        gym = read_gym_sessions(lk, names, sets_index, counts)
        home = read_home_sessions(lk, names, counts)
        weights = read_weights(lk, counts)
        plan = read_plan(lk, plan_db, names, counts)
        lk.close()
        plan_db.close()
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    session_set_keys = set()
    for s in gym:
        for e in s['exercises']:
            session_set_keys.add((int(s['id'].split(':')[1]), e['action_id']))
    reconcile(counts, sets_total, template_set_keys | session_set_keys, sets_index)

    prefs = read_prefs(container)
    state = read_user_state(container)
    sessions = sorted(gym + home, key=lambda s: (s['started_at'] or '', s['id']))
    counts['sessions'] = len(sessions)
    counts['unresolved_names'] = len(names.unresolved)
    counts['unresolved_name_ids'] = sorted(names.unresolved)

    mtimes = [os.path.getmtime(p) for p in (lkdb_path, plan_path, prefs_path) if os.path.exists(p)]
    return {
        'schema_version': SCHEMA_VERSION,
        'exported_at': datetime.now().astimezone().isoformat(timespec='seconds'),
        'source': {
            'bundle_id': BUNDLE_ID,
            'container': container,
            'app_version': app_version(bundle),
            'snapshot_mtime': local_iso(datetime.fromtimestamp(max(mtimes)).astimezone()) if mtimes else None,
        },
        'profile': profile_from(prefs, state),
        'awards': awards_from_prefs(prefs),
        'sessions': sessions,
        'weights': weights,
        'plan': plan,
        'templates': templates,
        'counts': counts,
    }


def write_atomic(path, data):
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix='.home_workouts-', suffix='.json', dir=d or None)
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(data, f, indent=1, ensure_ascii=False)
            f.write('\n')
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def report(snapshot, stream):
    c = snapshot['counts']
    lines = [
        'home_workouts export %s (app %s)' % (snapshot['exported_at'], snapshot['source'].get('app_version')),
        '  workout_record %d -> gym sessions %d (deleted %d, without exercises %d)' % (
            c['workout_record'], c['gym_sessions'], c['gym_sessions_deleted'], c['gym_sessions_without_exercises']),
        '  workout %d -> home sessions %d' % (c['workout'], c['home_sessions']),
        '  gym_workout %d -> templates %d (deleted %d), exercises %d, workout_action rows %d (unreferenced %d)' % (
            c['gym_workout'], c['templates'], c['templates_deleted'], c['template_exercises'],
            c['workout_action'], c['workout_action_unreferenced']),
        '  workout_action_set %d -> attached %d, unattached %d' % (c['workout_action_set'], c['sets_attached'], c['sets_unattached']),
        '  weight %d, exe_table %d -> plan days %d, unresolved names %d %s' % (
            c['weight'], c['exe_table'], c['plan_days'], c['unresolved_names'], c['unresolved_name_ids'] or ''),
    ]
    stream.write('\n'.join(lines) + '\n')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--container', default=DEFAULT_CONTAINER)
    ap.add_argument('--bundle', default=DEFAULT_BUNDLE)
    ap.add_argument('--out', default=DEFAULT_OUT)
    ap.add_argument('--stdout', action='store_true', help='print the JSON instead of writing --out')
    args = ap.parse_args(argv)
    try:
        snap = build_snapshot(args.container, args.bundle)
    except ExportError as e:
        sys.stderr.write('export failed: %s\n' % e)
        return 1
    if args.stdout:
        json.dump(snap, sys.stdout, indent=1, ensure_ascii=False)
        sys.stdout.write('\n')
    else:
        write_atomic(args.out, snap)
        sys.stderr.write('wrote %s\n' % args.out)
    report(snap, sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
