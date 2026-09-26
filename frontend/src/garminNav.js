// The Garmin tab's sidebar tree (a copy of connect.garmin.com's) and the page behind
// every item. A page lists the registry calls to batch for a context of
// { date, start, end, range, profileId }. Items Garmin does not expose through its API
// have no `calls` and render a link to the Garmin page instead.
import { G } from './garminTheme';
import { shiftISO } from './utils/dayInfo';

const BLUE = G.metric.steps;      // Garmin's sidebar icon blue
const GREEN = G.green;
const ORANGE = G.metric.stress;
const YELLOW = '#faca48';

export const RANGES = [
  { key: '1d', label: '1 Day', days: 0 },
  { key: '7d', label: '7 Days', days: 6 },
  { key: '4w', label: '4 Weeks', days: 27 },
  { key: '1y', label: '1 Year', days: 364 },
];
export const rangeDays = (key) => (RANGES.find((r) => r.key === key) || RANGES[1]).days;

// Sidebar clusters. `group` entries expand; `slug` entries are pages.
export const NAV = [
  { cluster: 'planner', items: [
    { slug: '__agenda', label: 'Agenda', icon: 'agenda', color: 'white' },
    { slug: '__workout', label: 'Workout App', icon: 'workout', color: 'white' },
  ] },
  { cluster: 'home', items: [
    { slug: '', label: 'Home', icon: 'home', color: 'white' },
    { slug: 'challenges', label: 'Challenges', icon: 'challenges', color: 'white' },
    { slug: 'calendar', label: 'Calendar', icon: 'calendar', color: 'white' },
    { slug: 'news-feed', label: 'News Feed', icon: 'newsfeed', color: 'white' },
  ] },
  { cluster: 'stats', items: [
    { group: 'activities', label: 'Activities', icon: 'activity', color: BLUE, children: [
      { slug: 'activities', label: 'All Activities' },
      { slug: 'epics', label: 'Epics' },
      { slug: 'steps', label: 'Steps' },
      { slug: 'floors', label: 'Floors' },
      { slug: 'intensity-minutes', label: 'Intensity Minutes' },
    ] },
    { group: 'health', label: 'Health Stats', icon: 'heart', color: BLUE, children: [
      { slug: 'sleep', label: 'Sleep' },
      { slug: 'health-status', label: 'Health Status' },
      { slug: 'weight', label: 'Weight' },
      { slug: 'blood-pressure', label: 'Blood Pressure' },
      { slug: 'pulse-ox', label: 'Pulse Ox' },
      { slug: 'pulse-ox-acclimation', label: 'Pulse Ox Acclimation' },
      { slug: 'respiration', label: 'Respiration' },
      { slug: 'heart-rate', label: 'Heart Rate' },
      { slug: 'fitness-age', label: 'Fitness Age' },
      { slug: 'stress', label: 'Stress' },
      { slug: 'body-battery', label: 'Body Battery' },
      { slug: 'health-snapshot', label: 'Health Snapshot' },
    ] },
    { group: 'nutrition', label: 'Nutrition', icon: 'nutrition', color: BLUE, children: [
      { slug: 'nutrition', label: 'Nutrition' },
      { slug: 'hydration', label: 'Hydration' },
      { slug: 'calories-burned', label: 'Calories Burned' },
    ] },
    { group: 'performance', label: 'Performance Stats', icon: 'performance', color: BLUE, children: [
      { slug: 'hrv-status', label: 'HRV Status' },
      { slug: 'race-predictor', label: 'Race Predictor' },
      { slug: 'vo2-max', label: 'VO2 Max' },
      { slug: 'training-effect', label: 'Training Effect' },
    ] },
    { group: 'planning', label: 'Training & Planning', icon: 'planning', color: BLUE, children: [
      { slug: 'workouts', label: 'Workouts' },
      { slug: 'coach-plans', label: 'Garmin Coach Plans' },
      { slug: 'races-events', label: 'Races & Events' },
      { slug: 'courses', label: 'Courses' },
      { slug: 'pacepro', label: 'PacePro Pacing Strategies' },
      { slug: 'segments', label: 'Segments' },
      { slug: 'garmin-trails', label: 'Garmin Trails' },
      { slug: 'popularity-heatmap', label: 'Popularity Heatmap' },
    ] },
    { slug: 'gear', label: 'Gear', icon: 'gear', color: BLUE },
    { slug: 'insights', label: 'Insights', icon: 'insights', color: YELLOW },
    { slug: 'reports', label: 'Reports', icon: 'reports', color: BLUE },
  ] },
  { cluster: 'social', items: [
    { slug: 'friends', label: 'Friends', icon: 'friends', color: ORANGE },
    { slug: 'groups', label: 'Groups', icon: 'groups', color: ORANGE },
  ] },
  { cluster: 'achievements', items: [
    { slug: 'badges', label: 'Badges', icon: 'badges', color: GREEN },
    { slug: 'personal-records', label: 'Personal Records', icon: 'records', color: GREEN },
    { slug: 'goals', label: 'Goals', icon: 'goals', color: GREEN },
  ] },
  { cluster: 'info', items: [
    { slug: 'tracking-accuracy', label: 'Activity Tracking Accuracy', icon: 'info', color: 'white' },
    { slug: 'endpoints', label: 'All Endpoints', icon: 'endpoints', color: 'white' },
  ] },
];

const GARMIN = 'https://connect.garmin.com/modern';
const d = (name, date, key) => ({ key: key || name, name, params: { cdate: date } });
const r = (name, start, end, key, extra = {}) => ({ key: key || name, name, params: { start, end, ...extra } });
const rd = (name, start, end, key, extra = {}) => ({ key: key || name, name, params: { startdate: start, enddate: end, ...extra } });
const n = (name, params = {}, key) => ({ key: key || name, name, params });

// slug -> page. `garminPath` is appended to connect.garmin.com/modern; `{date}` is replaced.
export const PAGES = {
  challenges: { title: 'Challenges', group: 'Home', garminPath: '/challenge', calls: () => [
    n('get_non_completed_badge_challenges', { start: 0, limit: 20 }, 'inprogress'),
    n('get_available_badge_challenges', { start: 0, limit: 20 }, 'available'),
    n('get_badge_challenges', { start: 0, limit: 20 }, 'completed'),
    n('get_adhoc_challenges', { start: 0, limit: 20 }, 'adhoc'),
  ] },
  calendar: { title: 'Calendar', group: 'Home', garminPath: '/calendar', calls: ({ date }) => {
    const [y, m] = date.split('-');
    const first = `${y}-${m}-01`;
    const last = shiftISO(`${y}-${m}-01`, 31).slice(0, 8) + '01';
    return [
      rd('get_activities_by_date', first, shiftISO(last, -1), 'acts'),
      n('get_scheduled_workouts', { year: Number(y), month: Number(m) }, 'sched'),
    ];
  } },
  'news-feed': { title: 'News Feed', group: 'Home', garminPath: '/newsfeed', calls: ({ date }) => [n('get_user_profile', {}, 'profile'), r('get_daily_steps', shiftISO(date, -13), shiftISO(date, 6), 'week')] },

  activities: { title: 'All Activities', group: 'Activities', garminPath: '/activities', calls: () => [n('get_activities', { start: 0, limit: 50 }, 'list'), n('count_activities', {}, 'count')] },
  activity: { title: 'Activity', group: 'Activities', garminPath: '/activity/{id}', calls: ({ id }) => [n('get_activity', { activity_id: String(id) }, 'activity'), n('get_activity_details', { activity_id: String(id), maxchart: 400, maxpoly: 1000 }, 'details'), n('get_activity_splits', { activity_id: String(id) }, 'splits'), n('get_devices', {}, 'devices')] },
  epics: { title: 'Epics', group: 'Activities', garminPath: '/epics' },
  steps: { title: 'Steps', group: 'Activities', garminPath: '/steps/{date}', ranges: ['1d', '7d', '4w', '1y'], calls: ({ date, start, end }) => [d('get_user_summary', date, 'summary'), d('get_steps_data', date, 'buckets'), r('get_daily_steps', start, end, 'daily')] },
  floors: { title: 'Floors', group: 'Activities', garminPath: '/floors', ranges: ['1d', '7d', '4w', '1y'], calls: ({ date }) => [d('get_user_summary', date, 'summary'), d('get_floors', date, 'floors')] },
  'intensity-minutes': { title: 'Intensity Minutes', group: 'Activities', garminPath: '/intensity-minutes', ranges: ['1d', '7d', '4w', '1y'], calls: ({ date, start, end }) => [d('get_intensity_minutes_data', date, 'im'), r('get_weekly_intensity_minutes', start, end, 'weekly')] },

  sleep: { title: 'Sleep', group: 'Health Stats', garminPath: '/sleep/{date}', ranges: ['1d', '7d', '4w', '1y'], calls: ({ date, start, end }) => [d('get_sleep_data', date, 'sleep'), r('get_sleep_daily', start, end, 'daily')] },
  'health-status': { title: 'Health Status', group: 'Health Stats', garminPath: '/health-status/{date}', calls: ({ date }) => [d('get_heart_rates', date, 'hr'), d('get_hrv_data', date, 'hrv'), d('get_respiration_data', date, 'resp'), d('get_spo2_data', date, 'spo2')] },
  weight: { title: 'Weight', group: 'Health Stats', garminPath: '/weight', ranges: ['1d', '7d', '4w', '1y'], calls: ({ date, start, end }) => [d('get_daily_weigh_ins', date, 'today'), rd('get_weigh_ins', start, end, 'range'), rd('get_body_composition', start, end, 'comp')] },
  'blood-pressure': { title: 'Blood Pressure', group: 'Health Stats', garminPath: '/blood-pressure', ranges: ['1d', '7d', '4w', '1y'], calls: ({ start, end }) => [rd('get_blood_pressure', start, end, 'bp')] },
  'pulse-ox': { title: 'Pulse Ox', group: 'Health Stats', garminPath: '/pulse-ox/{date}', calls: ({ date }) => [d('get_spo2_data', date, 'spo2')] },
  'pulse-ox-acclimation': { title: 'Pulse Ox Acclimation', group: 'Health Stats', garminPath: '/pulse-ox-acclimation', calls: ({ date }) => [d('get_spo2_data', date, 'spo2')] },
  respiration: { title: 'Respiration', group: 'Health Stats', garminPath: '/respiration/{date}', ranges: ['1d', '7d', '4w'], calls: ({ date }) => [d('get_respiration_data', date, 'resp')] },
  'heart-rate': { title: 'Heart Rate', group: 'Health Stats', garminPath: '/heart-rate/{date}', ranges: ['1d', '7d', '4w', '1y'], calls: ({ date, start, end }) => [d('get_heart_rates', date, 'hr'), d('get_user_summary', date, 'summary'), r('get_rhr_daily', start, end, 'rhr')] },
  'fitness-age': { title: 'Fitness Age', group: 'Health Stats', garminPath: '/fitness-age', calls: ({ date }) => [d('get_fitnessage_data', date, 'fa')] },
  stress: { title: 'Stress', group: 'Health Stats', garminPath: '/stress/{date}/0', ranges: ['1d', '7d', '4w', '1y'], calls: ({ date, end, range }) => [d('get_stress_data', date, 'stress'), d('get_user_summary', date, 'summary'), n('get_weekly_stress', { end, weeks: range === '1y' ? 52 : 4 }, 'weekly')] },
  'body-battery': { title: 'Body Battery', group: 'Health Stats', garminPath: '/body-battery', ranges: ['1d', '7d', '4w'], calls: ({ date, start, end }) => [rd('get_body_battery', start, end, 'bb'), d('get_body_battery_events', date, 'events'), d('get_user_summary', date, 'summary')] },
  'health-snapshot': { title: 'Health Snapshot', group: 'Health Stats', garminPath: '/health-snapshot' },

  nutrition: { title: 'Nutrition', group: 'Nutrition', garminPath: '/nutrition/{date}', ranges: ['1d', '7d', '4w', '1y'], calls: ({ date }) => [d('get_nutrition_daily_food_log', date, 'log'), d('get_nutrition_daily_meals', date, 'meals'), d('get_nutrition_daily_settings', date, 'settings')] },
  hydration: { title: 'Hydration', group: 'Nutrition', garminPath: '/hydration/{date}/0', ranges: ['1d', '7d', '4w', '1y'], calls: ({ date }) => [d('get_hydration_data', date, 'hyd')] },
  'calories-burned': { title: 'Calories Burned', group: 'Nutrition', garminPath: '/calories/{date}', ranges: ['1d', '7d', '4w', '1y'], calls: ({ date, start, end }) => [d('get_user_summary', date, 'summary'), r('get_calories_daily', start, end, 'daily')] },

  'hrv-status': { title: 'HRV Status', group: 'Performance Stats', garminPath: '/hrv-status', ranges: ['1d', '7d', '4w'], calls: ({ date, start, end }) => [d('get_hrv_data', date, 'hrv'), r('get_hrv_data_range', start, end, 'range')] },
  'race-predictor': { title: 'Race Predictor', group: 'Performance Stats', garminPath: '/report/-29/running/current', calls: () => [n('get_race_predictions', {}, 'race')] },
  'vo2-max': { title: 'VO2 Max', group: 'Performance Stats', garminPath: '/report/21/all/current', calls: ({ date }) => [r('get_max_metrics_range', shiftISO(date, -364), date, 'range')] },
  'training-effect': { title: 'Training Effect', group: 'Performance Stats', garminPath: '/report/62/running/last_seven_days', calls: ({ date }) => [d('get_training_status', date, 'status'), d('get_training_readiness', date, 'readiness')] },

  workouts: { title: 'Workouts', group: 'Training & Planning', garminPath: '/workouts', calls: () => [n('get_workouts', { start: 0, limit: 50 }, 'list'), n('get_next_scheduled_workout', {}, 'next')] },
  'coach-plans': { title: 'Garmin Coach Plans', group: 'Training & Planning', garminPath: '/training-plan', calls: () => [n('get_training_plans', {}, 'plans')] },
  'races-events': { title: 'Races & Events', group: 'Training & Planning', garminPath: '/event-dashboard', calls: () => [] },
  courses: { title: 'Courses', group: 'Training & Planning', garminPath: '/courses', calls: () => [n('get_last_activity', {}, 'last')] },
  pacepro: { title: 'PacePro Pacing Strategies', group: 'Training & Planning', garminPath: '/pacepro', calls: () => [] },
  segments: { title: 'Segments', group: 'Training & Planning', garminPath: '/segments', calls: () => [n('get_last_activity', {}, 'last')] },
  'garmin-trails': { title: 'Garmin Trails', group: 'Training & Planning', garminPath: '/trails', calls: () => [n('get_last_activity', {}, 'last')] },
  'popularity-heatmap': { title: 'Popularity Heatmap', group: 'Training & Planning', garminPath: '/popularity-heatmap', calls: () => [n('get_last_activity', {}, 'last')] },

  gear: { title: 'Gear', group: 'Gear', garminPath: '/gear', prelude: ['get_user_profile'], calls: ({ profileId }) => (profileId ? [n('get_gear', { userProfileNumber: String(profileId) }, 'gear'), n('get_gear_defaults', { userProfileNumber: String(profileId) }, 'defaults')] : []) },
  insights: { title: 'Insights', group: 'Insights', garminPath: '/insights', calls: () => [] },
  reports: { title: 'Reports', group: 'Reports', garminPath: '/report', calls: ({ date }) => [rd('get_progress_summary_between_dates', shiftISO(date, -6), date, 'progress')] },

  friends: { title: 'Friends', group: 'Social', garminPath: '/friends', calls: ({ date }) => [n('get_user_profile', {}, 'profile'), r('get_daily_steps', shiftISO(date, -13), shiftISO(date, 6), 'week')] },
  groups: { title: 'Groups', group: 'Social', garminPath: '/groups', calls: () => [] },

  badges: { title: 'Badges', group: 'Achievements', garminPath: '/badges', calls: () => [n('get_user_profile', {}, 'profile'), n('get_earned_badges', {}, 'earned'), n('get_available_badges', {}, 'available')] },
  'personal-records': { title: 'Personal Records', group: 'Achievements', garminPath: '/personal-records', calls: () => [n('get_personal_record', {}, 'prs')] },
  goals: { title: 'Goals', group: 'Achievements', garminPath: '/goals', calls: () => [n('get_goals', { status: 'active' }, 'active'), n('get_goals', { status: 'future' }, 'future'), n('get_goals', { status: 'past' }, 'past')] },

  'tracking-accuracy': { title: 'Activity Tracking Accuracy', group: 'Info', garminPath: '/activity-tracking-accuracy' },
};

export const garminUrl = (page, date, id = '') => `${GARMIN}${(page.garminPath || '').replace('{date}', date).replace('{id}', id)}`;
export const pageFor = (slug) => PAGES[slug] || null;

// The group a slug belongs to (for the sidebar's active-group outline).
export function groupOf(slug) {
  for (const c of NAV) for (const it of c.items) {
    if (it.group && it.children.some((ch) => ch.slug === slug)) return it.group;
  }
  return null;
}
