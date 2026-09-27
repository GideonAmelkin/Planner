"""Regression fixtures for export.py, built from the real Home Workouts schemas
with synthetic rows in the exact shapes the app writes (epoch milliseconds and
seconds side by side, LKDB combo pointers, base64 plan blobs).

    python3 -m unittest tools/homeworkouts/test_export.py
"""
import base64
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export  # noqa: E402

# CREATE statements copied from the app's databases (sqlite_master), unchanged.
LKDB_SCHEMA = [
    "CREATE TABLE gym_workout(lowerbodyGenderMale integer,color integer,isDeleted integer,title text,is5X5Workout integer,benchmarkType integer,cardImgName text,regeneratedTime integer,detailName text,thumbImageName text,updateTime integer,detailImgName text,selectedEquipments text,day integer,name text,liftReps integer,liftWeight double,editedByUser integer,workoutId integer primary key autoincrement,detail text,orderTime integer,goal integer,data text,exercises text,orderIndex integer)",
    "CREATE TABLE workout_action(unit text,workoutId integer,isFocus integer,orderIndex integer,roundList text,actionId text,isOpening integer,rowid integer primary key autoincrement)",
    "CREATE TABLE workout_action_set(rowid integer primary key autoincrement,actionId text,workoutId integer,isWeightChanged integer,isFinished integer,isRepsColorChange integer,weight double,originWeight double,isRepsChanged integer,isFocus integer,reps integer,isWeightColorChange integer)",
    "CREATE TABLE weight(weight text,updateDate integer,uid integer,startDate integer,asyncHealth integer,date integer,bundleId text,ID integer primary key autoincrement)",
    "CREATE TABLE HWPlanProgressModel(updateTime double,goal integer,scheduleOn integer,finishDays integer,exerciseUpdateTime double,isCoachSelect integer,extraInfo text,rowid integer primary key autoincrement,lowerUpdateTime double,workoutDays text,currentDayIndex integer,focusArea text,trainDuration integer,totalDays integer,planDifficulty integer,injuryConcerns text,availableEquipments text,gender integer,isFinish integer)",
    "CREATE TABLE workout(uid integer,temp51 integer,isDistance integer,eachActionTimeDicStr text,kcalStr text,sportType integer,totalCount integer,adjustLevelNum text,temp5 integer,distanceUnit integer,temp3 text,sportsState text,bodysDetail text,during integer,updateTime integer,distance double,temp1 text,challengeIndex text,name text,iconName text,date integer,defaultMET text,caculatorType integer,ID integer primary key autoincrement,localizedKey text,elevationUnit integer,isElevation integer,heartRateStr text,temp6 integer,dayIndex integer,temp4 integer,completeCount integer,temp2 text,elevation double)",
    "CREATE TABLE workout_record(timeStamp integer primary key autoincrement,heartRateStr text,cal integer,awayTime integer,templateId integer,unlockActionId text,invalidTime integer,isDeleted integer,title text,totalSIWeight double,duration integer,totalBSWeight double,startTime integer,restTime integer,updateTime integer)",
    "CREATE TABLE exercise_record(pk text primary key,exerciseId text,workoutTimeStamp integer,orderIndex integer,updateTime integer,isDeleted integer)",
    "CREATE TABLE set_record(weight double,exercisePk text,isDeleted integer,reps integer,updateTime integer,originWeight double,timeStamp integer,pk text primary key,workoutTimeStamp integer)",
    "CREATE TABLE user(firstGuideSettingsInfo text,weightUnit text,overAllRestTimeEnableInfo text,hasGuideCompleteInfo text,isDefaultEquipmentsInfo text,benchmarkInfo text,rowid integer primary key autoincrement,liftingWeightInfo text)",
    "CREATE TABLE user_unit(value integer,rowid integer primary key autoincrement,updateTime integer)",
]
PLAN_SCHEMA = [
    "CREATE TABLE exe_table (exe_id LONG PRIMARY KEY, exe_name TEXT, exe_number INTEGER, exe_detail TEXT, exe_create_date BIGINT ,exe_workoutType INTEGER ,exe_cycleRound INTEGER ,exe_min INTEGER ,exe_levelType INTEGER ,exe_bodysDetail TEXT ,exe_warmupsDetail TEXT ,exe_workoutsDetail TEXT ,exe_coolDownDetail TEXT ,exe_totalCount INTEGER ,exe_completeCount INTEGER ,exe_exerciseDate INTEGER ,exe_imageName TEXT ,exe_desc TEXT ,exe_wtype TEXT)",
]

# 2026-09-25 14:30:00 UTC, as the app writes it in the two units.
T_S = 1790346600
T_MS = T_S * 1000
LOCAL_DATE = datetime.fromtimestamp(T_S, tz=timezone.utc).astimezone().date().isoformat()
# Home sessions: the app files each one under a calendar day stored as midnight UTC.
DAY_UTC_MS = 1790380800000   # 2026-09-26T00:00:00Z


def local_ms(y, m, d, hh, mm):
    """Epoch ms of a wall-clock time in the Mac's zone (what workout.temp1 holds)."""
    return int(datetime(y, m, d, hh, mm).astimezone().timestamp() * 1000)


def temp1(entries):
    """[(position, start_ms, seconds)] -> the app's temp1 JSON."""
    return json.dumps({str(p): '%d:%d' % (s, s + secs * 1000) for p, s, secs in entries})

LK_JSON_EMPTY = '{"DB_Type":"DB_Type_JSON","DB_Value":[]}'


def combo(rowids):
    return json.dumps({'DB_Type': 'DB_Type_Combo', 'DB_Value': [
        {'DB_PKeyValue': {'rowid': str(r)}, 'DB_Type': 'DB_Type_Model', 'DB_Class': 'GymActionModel',
         'DB_RowId': r, 'DB_TableName': 'workout_action'} for r in rowids]})


def set_combo(rowids):
    """An action row's roundList: pointers at its own workout_action_set rows."""
    return json.dumps({'DB_Type': 'DB_Type_Combo', 'DB_Value': [
        {'DB_PKeyValue': {'rowid': str(r)}, 'DB_Type': 'DB_Type_Model', 'DB_Class': 'GymActionSetModel',
         'DB_RowId': r, 'DB_TableName': 'workout_action_set'} for r in rowids]})


def b64(obj):
    return base64.b64encode(json.dumps(obj).encode('utf-8')).decode('ascii')


class Fixture:
    def __init__(self):
        self.root = tempfile.mkdtemp(prefix='hw-fixture-')
        self.container = os.path.join(self.root, 'container')
        self.bundle = os.path.join(self.root, 'bundle')
        os.makedirs(os.path.join(self.container, 'Documents', 'db'))
        os.makedirs(os.path.join(self.container, 'Documents', 'DBfolder'))
        os.makedirs(os.path.join(self.container, 'Library', 'Preferences'))
        os.makedirs(os.path.join(self.container, 'Library', 'InjuryAdaptation', 'v1'))
        os.makedirs(os.path.join(self.bundle, 'Resource', 'Mapping'))
        self.lk = sqlite3.connect(os.path.join(self.container, 'Documents', 'db', 'LKDB.db'))
        for sql in LKDB_SCHEMA:
            self.lk.execute(sql)
        self.plan_db = sqlite3.connect(os.path.join(self.container, 'Documents', 'DBfolder', 'userexe.sqlite'))
        for sql in PLAN_SCHEMA:
            self.plan_db.execute(sql)
        self._write_bundle()
        self._write_prefs()

    def _write_bundle(self):
        with open(os.path.join(self.bundle, 'Resource', 'Mapping', 'en_b.json'), 'w') as f:
            json.dump({'655': 'Bench Press · Barbell', '513': 'Kickbacks · Dumbbell'}, f)
        with open(os.path.join(self.bundle, 'Resource', 'Mapping', 'en_p.json'), 'w') as f:
            json.dump({'1317': "Dumbbell Farmer's Carry", '1073': 'Barbell Deadlift', '655': 'overridden by en_b'}, f)
        with open(os.path.join(self.bundle, 'actionAttributes.json'), 'w') as f:
            json.dump([{'actionId': '10', 'name': 'Bird Dog'}], f)

    def _write_prefs(self):
        import plistlib
        prefs = {
            'awardData': {'streak': '3', 'activeTimeMin': '95', 'activeDays': ['2026-09-24', '2026-09-25'], 'workoutCount': '2'},
            'currentWeight': '77.110690', 'targetWeight': '79.378651', 'UserAge': '34', 'weightWithkg': False, 'proUser': True,
        }
        with open(os.path.join(self.container, 'Library', 'Preferences', export.BUNDLE_ID + '.plist'), 'wb') as f:
            plistlib.dump(prefs, f)
        with open(os.path.join(self.container, 'Library', 'InjuryAdaptation', 'v1', 'user_state.json'), 'w') as f:
            json.dump({'rawInputs': {'isMale': True, 'heightcm': 183, 'bmiComputed': 23.0}, 'injuries': []}, f)

    def template(self, wid, title, name, actions, sets_per=2, deleted=0):
        """actions: list of action ids. Writes an older, superseded action row for the
        first one with its own stale set (the app leaves both behind), then the referenced
        rows, each pointing at its sets through roundList the way the app does."""
        rowids = []
        stale_set = self.lk.execute(
            "INSERT INTO workout_action_set(actionId,workoutId,isWeightChanged,isFinished,isRepsColorChange,weight,originWeight,isRepsChanged,isFocus,reps,isWeightColorChange) VALUES(?,?,0,0,0,?,?,0,0,?,0)",
            (actions[0], wid, 40.0, 40.0, 99)).lastrowid
        stale = self.lk.execute(
            "INSERT INTO workout_action(unit,workoutId,isFocus,orderIndex,roundList,actionId,isOpening) VALUES('',?,0,0,?,?,0)",
            (wid, set_combo([stale_set]), actions[0])).lastrowid
        for i, a in enumerate(actions):
            set_rowids = []
            for s in range(sets_per):
                set_rowids.append(self.lk.execute(
                    "INSERT INTO workout_action_set(actionId,workoutId,isWeightChanged,isFinished,isRepsColorChange,weight,originWeight,isRepsChanged,isFocus,reps,isWeightColorChange) VALUES(?,?,0,0,0,?,?,0,0,?,0)",
                    (a, wid, 60.0 + s, 60.0, 8 + s)).lastrowid)
            rid = self.lk.execute(
                "INSERT INTO workout_action(unit,workoutId,isFocus,orderIndex,roundList,actionId,isOpening) VALUES('s',?,0,?,?,?,0)",
                (wid, i, set_combo(set_rowids), a)).lastrowid
            rowids.append(rid)
        self.lk.execute(
            "INSERT INTO gym_workout(workoutId,isDeleted,title,name,detailName,is5X5Workout,updateTime,editedByUser,exercises,orderIndex) VALUES(?,?,?,?,?,0,?,0,?,?)",
            (wid, deleted, title, name, name, T_MS, combo(rowids), wid))
        self.lk.commit()
        return stale

    def gym_unit(self, value):
        """The gym module's weight unit: user.weightUnit points at a user_unit row (1 = lb, 0 = kg)."""
        self.lk.execute("INSERT INTO user_unit(rowid,value,updateTime) VALUES(9,?,?)", (value, T_MS))
        self.lk.execute("INSERT INTO user(rowid,weightUnit) VALUES(1,?)",
                        (json.dumps({'DB_PKeyValue': {'rowid': '9'}, 'DB_Type': 'DB_Type_Model', 'DB_Class': 'GymUserUnitModel',
                                     'DB_RowId': 9, 'DB_TableName': 'user_unit'}),))
        self.lk.commit()

    def gym_session(self, ts, title, template_id, actions, deleted=0, total_si=1240.5, stray_set=False):
        """A workout_record that ran 45 minutes and ended at ts, with an exercise_record per action and
        three set_record rows per exercise written the way the app does at session end: exercisePk is
        the exercise record's pk, workoutTimeStamp the session. stray_set adds one in-progress working
        row (exercisePk a bare id, workoutTimeStamp 0): not a session record, so unattached."""
        start = ts - 2700000
        self.lk.execute(
            "INSERT INTO workout_record(timeStamp,cal,templateId,isDeleted,title,totalSIWeight,duration,totalBSWeight,startTime,restTime,updateTime) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (ts, 210, template_id, deleted, title, total_si, 2700000, 2735.0, start, 300000, ts))  # duration and rest in ms, as the app stores them
        for i, a in enumerate(actions):
            epk = 'ex-%d-%d' % (ts, i)
            self.lk.execute("INSERT INTO exercise_record(pk,exerciseId,workoutTimeStamp,orderIndex,updateTime,isDeleted) VALUES(?,?,?,?,?,0)",
                            (epk, a, ts, i, ts))
            for s in range(3):
                self.lk.execute(
                    "INSERT INTO set_record(weight,exercisePk,isDeleted,reps,updateTime,originWeight,timeStamp,pk,workoutTimeStamp) VALUES(?,?,0,?,?,?,?,?,?)",
                    (80.0, epk, 5, ts, 80.0, ts, 'set-%d-%d-%d' % (ts, i, s), ts))
        if stray_set:
            self.lk.execute(
                "INSERT INTO set_record(weight,exercisePk,isDeleted,reps,updateTime,originWeight,timeStamp,pk,workoutTimeStamp) VALUES(?,?,0,?,?,?,?,?,0)",
                (80.0, actions[0], 5, ts, 80.0, start + 60000, 'working-%d' % ts))
        self.lk.commit()

    def home_session(self, id_, day_utc_ms, name, timings=None, legacy_times=None, sport_type=0):
        """timings: temp1 JSON as the app writes it today (eachActionTimeDicStr stays empty);
        legacy_times: the old {action_id: seconds} column for app versions that filled it."""
        n = len(legacy_times) if legacy_times else len(json.loads(timings)) if timings else 0
        each = json.dumps({'DB_Type': 'DB_Type_JSON', 'DB_Value': legacy_times}) if legacy_times else ''
        self.lk.execute(
            "INSERT INTO workout(ID,eachActionTimeDicStr,temp1,kcalStr,sportType,totalCount,during,updateTime,name,date,completeCount) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (id_, each, timings or '', '88.5', sport_type, n, 1200, day_utc_ms, name, day_utc_ms, n))
        self.lk.commit()

    def weight(self, kg, day_midnight_utc_ms, at_ms):
        self.lk.execute("INSERT INTO weight(weight,updateDate,uid,startDate,asyncHealth,date,bundleId) VALUES(?,?,0,?,0,?,?)",
                        (str(kg), at_ms, at_ms, day_midnight_utc_ms, export.BUNDLE_ID))
        self.lk.commit()

    def plan(self, days, finish_days=1):
        self.lk.execute(
            "INSERT INTO HWPlanProgressModel(updateTime,goal,scheduleOn,finishDays,workoutDays,currentDayIndex,focusArea,totalDays,planDifficulty,isFinish) VALUES(?,2,1,?,'7,2,5',1,'2,3',28,2,0)",
            (float(T_S), finish_days))
        for d in days:
            self.plan_db.execute(
                "INSERT INTO exe_table(exe_id,exe_name,exe_create_date,exe_workoutType,exe_cycleRound,exe_min,exe_totalCount,exe_completeCount,exe_exerciseDate,exe_imageName,exe_warmupsDetail,exe_workoutsDetail,exe_coolDownDetail) VALUES(?,?,?,3,3,?,?,?,?,?,?,?,?)",
                (d['day'], d.get('name', ''), T_S, d.get('minutes', 12), len(d['exercises']), d.get('complete', 0), d.get('done', 0),
                 d.get('image', 'chest_m104'), b64(d.get('warmups', [])), b64(d['exercises']), b64([])))
        self.lk.commit()
        self.plan_db.commit()

    def close(self):
        self.lk.close()
        self.plan_db.close()

    def cleanup(self):
        shutil.rmtree(self.root, ignore_errors=True)


class ExportTest(unittest.TestCase):
    def setUp(self):
        self.fx = Fixture()
        self.addCleanup(self.fx.cleanup)

    def build(self):
        self.fx.close()
        return export.build_snapshot(self.fx.container, self.fx.bundle)

    def test_full_snapshot(self):
        fx = self.fx
        fx.template(101, 'Full Body Workout', 'full_body_workout', ['1317', '1073', '655'])
        fx.template(112, 'StrongLifts 5×5 · A', 'strong_5x5', ['655'], sets_per=5)
        fx.template(150, 'Old custom', 'custom', ['10'], deleted=1)
        fx.gym_unit(0)  # kilograms: the weights below come through unchanged
        fx.gym_session(T_MS, 'Full Body Workout', 101, ['1317', '655'], stray_set=True)
        fx.gym_session(T_MS + 86400000, 'Deleted one', 101, ['655'], deleted=1)
        fx.home_session(7, DAY_UTC_MS, 'Abs Beginner', temp1([(0, local_ms(2026, 9, 26, 6, 10), 30), (1, local_ms(2026, 9, 26, 6, 11), 45)]))
        fx.weight(77.11, 1790380800000, T_MS)
        fx.plan([
            {'day': 1, 'exercises': [{'Id': '513', 'enName': 'DUMBBELL KICKBACKS', 'time': 16, 'restTime': 15, 'unit': '', 'eachSide': False}],
             'complete': 1, 'done': T_S, 'minutes': 10},
            {'day': 2, 'exercises': [{'Id': '9999', 'enName': 'MYSTERY MOVE', 'time': 20, 'restTime': 10, 'unit': 's', 'eachSide': True}]},
        ])
        snap = self.build()

        self.assertEqual(snap['schema_version'], 1)
        c = snap['counts']
        self.assertEqual((c['workout_record'], c['gym_sessions'], c['gym_sessions_deleted']), (2, 1, 1))
        self.assertEqual((c['workout'], c['home_sessions']), (1, 1))
        self.assertEqual((c['gym_workout'], c['templates'], c['templates_deleted']), (3, 2, 1))
        self.assertEqual(c['template_exercises'], 4)
        # 3 stale rows (one per template) + 5 referenced; sessions do not use workout_action
        self.assertEqual(c['workout_action'], 8)
        self.assertEqual(c['workout_action_unreferenced'], 8 - 4)
        # template sets 3*2 + 1*5 plus one stale-generation set per template (3, unattached),
        # deleted template 1*2 + 1 stale (unattached)
        self.assertEqual(c['workout_action_set'], 6 + 5 + 2 + 3)
        self.assertEqual(c['sets_attached'], 6 + 5)
        self.assertEqual(c['sets_unattached'], 2 + 3)
        self.assertEqual(c['set_pointers_missing'], 0)
        # session exercises: 2 live + 1 of the deleted session; sets: 6 attached, 1 working row, 3 of the deleted session
        self.assertEqual((c['exercise_record'], c['gym_exercises'], c['exercise_record_of_deleted_sessions'], c['exercise_record_deleted']), (3, 2, 1, 0))
        self.assertEqual((c['set_record'], c['set_record_attached'], c['set_record_unattached'], c['set_record_deleted']), (10, 6, 4, 0))
        self.assertEqual(c['plan_days'], 2)
        self.assertEqual(c['unresolved_names'], 0)

        gym = [s for s in snap['sessions'] if s['kind'] == 'gym']
        home = [s for s in snap['sessions'] if s['kind'] == 'home']
        self.assertEqual(len(gym), 1)
        g = gym[0]
        self.assertEqual(g['id'], 'gym:%d' % T_MS)
        self.assertEqual(g['date'], LOCAL_DATE)
        self.assertTrue(g['started_at'].startswith(LOCAL_DATE))
        self.assertEqual((g['duration_s'], g['rest_s'], g['calories'], g['total_weight_kg'], g['weight_unit']), (2700, 300, 210, 2400.0, 'kg'))  # 2 exercises x 3 sets x 5 reps x 80 kg, from the sets
        self.assertEqual([e['name'] for e in g['exercises']], ["Dumbbell Farmer's Carry", 'Bench Press · Barbell'])
        self.assertEqual(g['exercises'][1]['sets'], [{'reps': 5, 'weight_kg': 80.0, 'finished': True}] * 3)

        h = home[0]
        self.assertEqual(h['id'], 'home:7:%d' % DAY_UTC_MS)
        self.assertEqual(h['date'], '2026-09-26')    # the app's day (midnight UTC), not the Mac-local date of that instant
        self.assertTrue(h['started_at'].startswith('2026-09-26T06:10:00'), h['started_at'])
        self.assertEqual(h['calories'], 88.5)
        self.assertEqual([(e['order'], e['name'], e['seconds']) for e in h['exercises']], [(0, None, 30), (1, None, 45)])
        self.assertEqual(c['home_sessions_from_temp1'], 1)

        self.assertEqual(snap['weights'], [{'date': '2026-09-26', 'at': export.local_iso(export.epoch_to_dt(T_MS, 'weight.startDate')), 'kg': 77.11}])

        t = {x['id']: x for x in snap['templates']}
        self.assertEqual(sorted(t), [101, 112])
        self.assertEqual([e['name'] for e in t[101]['exercises']], ["Dumbbell Farmer's Carry", 'Barbell Deadlift', 'Bench Press · Barbell'])
        # Only the round-listed sets: the stale generation's 99-rep set under the same
        # (workoutId, actionId) must not leak in.
        self.assertEqual(t[101]['exercises'][0]['sets'], [{'reps': 8, 'weight_kg': 60.0, 'finished': False}, {'reps': 9, 'weight_kg': 61.0, 'finished': False}])
        self.assertEqual(len(t[112]['exercises'][0]['sets']), 5)

        p = snap['plan']
        self.assertEqual((p['total_days'], p['finish_days'], p['current_day_index']), (28, 1, 1))
        self.assertEqual(p['days'][0]['name'], 'Chest')      # derived from exe_imageName when exe_name is blank
        self.assertEqual(p['days'][0]['exercises'][0]['name'], 'Kickbacks · Dumbbell')
        self.assertEqual(p['days'][0]['done_at'][:10], LOCAL_DATE)
        self.assertIsNone(p['days'][1]['done_at'])
        self.assertEqual(p['days'][1]['exercises'][0]['name'], 'Mystery Move')   # enName fallback, title-cased
        self.assertTrue(p['days'][1]['exercises'][0]['each_side'])

        self.assertEqual(snap['awards'], {'streak': 3, 'workout_count': 2, 'active_time_min': 95, 'active_days': ['2026-09-24', '2026-09-25']})
        self.assertEqual(snap['profile']['height_cm'], 183.0)
        self.assertEqual(snap['profile']['current_weight_kg'], 77.11069)
        self.assertFalse(snap['profile']['shows_kg'])

    def test_home_session_type_names(self):
        self.fx.home_session(8, DAY_UTC_MS, None, temp1([(0, local_ms(2026, 9, 26, 7, 0), 30)]), sport_type=12)
        self.fx.home_session(9, DAY_UTC_MS + 86400000, None, temp1([(0, local_ms(2026, 9, 27, 7, 0), 30)]), sport_type=21)
        self.fx.plan([])
        by_id = {s['id'].split(':')[1]: s for s in self.build()['sessions']}
        self.assertEqual((by_id['8']['title'], by_id['8']['focus'], by_id['8']['level']), ('Chest · Intermediate', 'Chest', 'Intermediate'))
        self.assertEqual((by_id['9']['title'], by_id['9']['focus'], by_id['9']['level']), ('Workout', None, None))

    def test_home_session_keeps_app_day_after_midnight(self):
        # Started 23:48 local on the 25th; the app files it under the 26th (midnight UTC) and so do we.
        self.fx.home_session(8, DAY_UTC_MS, 'Late', temp1([(0, local_ms(2026, 9, 25, 23, 48), 40)]))
        self.fx.plan([])
        h = self.build()['sessions'][0]
        self.assertEqual(h['date'], '2026-09-26')
        self.assertTrue(h['started_at'].startswith('2026-09-25T23:48:00'), h['started_at'])

    def test_home_session_legacy_each_action_column(self):
        self.fx.home_session(9, DAY_UTC_MS, 'Abs Beginner', legacy_times={'10': 30, '513': 45})
        self.fx.plan([])
        snap = self.build()
        h = snap['sessions'][0]
        self.assertEqual(h['date'], '2026-09-26')
        self.assertEqual(h['started_at'], '2026-09-26T00:00:00')
        self.assertEqual([(e['name'], e['seconds']) for e in h['exercises']], [('Bird Dog', 30), ('Kickbacks · Dumbbell', 45)])
        self.assertEqual(snap['counts']['home_sessions_from_temp1'], 0)

    def test_empty_install_exports_catalog_only(self):
        self.fx.template(101, 'Full Body Workout', 'full_body_workout', ['1317'])
        self.fx.plan([{'day': 1, 'exercises': []}])
        snap = self.build()
        self.assertEqual(snap['sessions'], [])
        self.assertEqual(snap['weights'], [])
        self.assertEqual(len(snap['templates']), 1)
        self.assertEqual(snap['counts']['sessions'], 0)

    def test_downloaded_text_pack_names_an_unknown_exercise(self):
        # The app writes Library/workoutEx/actions/<id>/text/<ver>/en/en once the exercise was opened.
        for ver, name in ((2, 'OLD NAME'), (3, 'BANDED SQUAT HIP ABDUCTION')):
            d = os.path.join(self.fx.container, 'Library', 'workoutEx', 'actions', '424242', 'text', str(ver), 'en')
            os.makedirs(d)
            with open(os.path.join(d, 'en'), 'w') as f:
                json.dump({'name': name, 'introduce': '', 'tips': []}, f)
        self.fx.template(101, 'Full Body Workout', 'full_body_workout', ['424242'])
        self.fx.plan([])
        snap = self.build()
        self.assertEqual(snap['templates'][0]['exercises'][0]['name'], 'Banded Squat Hip Abduction')
        self.assertEqual(snap['counts']['unresolved_name_ids'], [])

    def test_unknown_name_is_reported_not_dropped(self):
        self.fx.template(101, 'Full Body Workout', 'full_body_workout', ['424242'])
        self.fx.plan([])
        snap = self.build()
        self.assertEqual(snap['templates'][0]['exercises'][0]['name'], '424242')
        self.assertEqual(snap['counts']['unresolved_name_ids'], ['424242'])

    def test_dangling_template_pointer_fails_loudly(self):
        self.fx.template(101, 'Full Body Workout', 'full_body_workout', ['1317'])
        self.fx.lk.execute("UPDATE gym_workout SET exercises=? WHERE workoutId=101", (combo([999]),))
        self.fx.lk.commit()
        self.fx.plan([])
        with self.assertRaises(export.ExportError) as ctx:
            self.build()
        self.assertIn('rowid 999', str(ctx.exception))

    def test_epoch_outside_window_fails_loudly(self):
        self.fx.template(101, 'Full Body Workout', 'full_body_workout', ['1317'])
        self.fx.gym_session(T_MS, 'Full Body Workout', 101, ['1317'])
        self.fx.lk.execute("UPDATE workout_record SET startTime=? WHERE timeStamp=?", (T_MS * 1000, T_MS))
        self.fx.lk.commit()
        self.fx.plan([])
        with self.assertRaises(export.ExportError) as ctx:
            self.build()
        self.assertIn('workout_record.startTime', str(ctx.exception))

    def test_epoch_units_by_magnitude(self):
        s = export.epoch_to_dt(T_S, 'x')
        ms = export.epoch_to_dt(T_MS, 'x')
        self.assertEqual(s, ms)
        self.assertIsNone(export.epoch_to_dt(0, 'x'))
        self.assertIsNone(export.epoch_to_dt(None, 'x'))

    def test_write_atomic_replaces_file(self):
        out = os.path.join(self.fx.root, 'nested', 'snap.json')
        export.write_atomic(out, {'a': 1})
        export.write_atomic(out, {'a': 2})
        with open(out) as f:
            self.assertEqual(json.load(f), {'a': 2})
        self.assertEqual([n for n in os.listdir(os.path.dirname(out)) if n.startswith('.home_workouts-')], [])


if __name__ == '__main__':
    unittest.main()


class GymUnitTests(unittest.TestCase):
    def setUp(self):
        self.fx = Fixture()
        self.addCleanup(self.fx.cleanup)

    def test_pounds_convert_and_lifted_total_comes_from_sets_when_the_app_has_none(self):
        self.fx.template(101, 'Full Body Workout', 'full_body_workout', ['1317'])
        self.fx.gym_unit(1)  # pounds
        self.fx.gym_session(T_MS, 'Full Body Workout', 101, ['1317'], total_si=0.0)
        self.fx.close()
        snap = export.build_snapshot(self.fx.container, self.fx.bundle)
        g = [s for s in snap['sessions'] if s['kind'] == 'gym'][0]
        self.assertEqual(g['weight_unit'], 'lb')
        self.assertAlmostEqual(g['exercises'][0]['sets'][0]['weight_kg'], 80 / 2.20462, places=2)
        self.assertAlmostEqual(g['total_weight_kg'], 3 * 5 * 80 / 2.20462, places=1)
