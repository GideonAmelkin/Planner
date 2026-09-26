import * as H from './HealthStats';
import * as A from './Activities';
import * as N from './Nutrition';
import * as P from './Performance';
import * as Ho from './Home';
import * as T from './Training';
import * as M from './More';

// slug -> bespoke page component. Anything missing falls back to the generic cards.
const PAGE_COMPONENTS = {
  challenges: Ho.Challenges, calendar: Ho.Calendar, 'news-feed': Ho.NewsFeed,
  activities: A.AllActivities, epics: A.Epics, activity: A.ActivityDetail,
  steps: H.Steps, floors: H.Floors, 'intensity-minutes': H.IntensityMinutes,
  sleep: H.Sleep, 'health-status': H.HealthStatus, weight: H.Weight, 'blood-pressure': H.BloodPressure,
  'pulse-ox': H.PulseOx, 'pulse-ox-acclimation': H.PulseOxAcclimation, respiration: H.Respiration,
  'heart-rate': H.HeartRate, 'fitness-age': H.FitnessAge, stress: H.Stress, 'body-battery': H.BodyBattery,
  'health-snapshot': H.HealthSnapshot,
  nutrition: N.Nutrition, hydration: N.Hydration, 'calories-burned': N.CaloriesBurned,
  'hrv-status': P.HrvStatus, 'race-predictor': P.RacePredictor, 'vo2-max': P.VO2Max, 'training-effect': P.TrainingEffect, reports: P.Reports,
  workouts: T.Workouts, 'coach-plans': T.CoachPlans, 'races-events': T.RacesEvents, courses: T.Courses, pacepro: T.PacePro,
  segments: T.Segments, 'garmin-trails': T.Trails, 'popularity-heatmap': T.Heatmap,
  gear: M.Gear, insights: M.Insights, friends: M.Friends, groups: M.Groups,
  badges: M.Badges, 'personal-records': M.PersonalRecords, goals: M.Goals,
};
export default PAGE_COMPONENTS;
