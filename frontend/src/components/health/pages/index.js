import * as H from './HealthStats';
import * as A from './Activities';

// slug -> bespoke page component. Anything missing falls back to the generic cards.
const PAGE_COMPONENTS = {
  steps: H.Steps,
  floors: H.Floors,
  'intensity-minutes': H.IntensityMinutes,
  sleep: H.Sleep,
  'health-status': H.HealthStatus,
  weight: H.Weight,
  'blood-pressure': H.BloodPressure,
  'pulse-ox': H.PulseOx,
  'pulse-ox-acclimation': H.PulseOxAcclimation,
  respiration: H.Respiration,
  'heart-rate': H.HeartRate,
  'fitness-age': H.FitnessAge,
  stress: H.Stress,
  'body-battery': H.BodyBattery,
  'health-snapshot': H.HealthSnapshot,
  activities: A.AllActivities,
  epics: A.Epics,
  activity: A.ActivityDetail,
};
export default PAGE_COMPONENTS;
