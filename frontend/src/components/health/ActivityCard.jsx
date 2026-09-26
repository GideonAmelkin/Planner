import React from 'react';
import GarminIcon from './GarminIcon';
import { activityCard, activityFooter, cardTitle, footerLink } from '../../garminTheme';
import { metersToMiles } from '../../utils/garminFormat';
import { num, secondsToHm, titleCase } from '../../shared/format';

const hms = (sec) => {
  if (!sec && sec !== 0) return '--';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};
const pace = (sec, meters) => {
  const mi = metersToMiles(meters);
  if (!sec || !mi) return '--';
  const spm = sec / mi;
  return `${Math.floor(spm / 60)}:${String(Math.round(spm % 60)).padStart(2, '0')} /mi`;
};

// The solid green activity block on Garmin's daily summary.
export default function ActivityCard({ activity: a }) {
  const miles = metersToMiles(a.distance);
  const white = { color: 'white' };
  return (
    <section style={activityCard}>
      <div style={{ padding: '12px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ ...cardTitle, ...white }}>
          <GarminIcon name={a.activityType && /run/i.test(a.activityType.typeKey) ? 'activity' : 'steps'} color="white" />
          <span>{a.activityName || titleCase(a.activityType && a.activityType.typeKey) || 'Activity'}</span>
        </div>
        <GarminIcon name="chart" color="white" size={14} />
      </div>
      <div style={{ padding: '4px 16px 14px', display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(0, 2fr)', gap: '8px 16px', alignItems: 'center' }}>
        <div style={{ fontSize: 'clamp(28px, 7vw, 40px)', fontWeight: 300, lineHeight: 1.1, whiteSpace: 'nowrap', ...white }}>
          {miles ? `${num(miles, 2)} mi` : secondsToHm(a.duration) || '--'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: '6px 12px' }}>
          {[
            ['Time', hms(a.duration)],
            ['Avg Pace', pace(a.duration, a.distance)],
            ['Avg HR', a.averageHR ? `${num(a.averageHR)} bpm` : '--'],
            ['Calories', a.calories ? `${num(a.calories)} Cal` : '--'],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 16, fontWeight: 300, ...white }}>{value}</div>
              <div style={{ fontSize: 11, opacity: 0.85, ...white }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={activityFooter}>
        <a href={`https://connect.garmin.com/modern/activity/${a.activityId}`} target="_blank" rel="noreferrer" style={{ ...footerLink, color: 'white' }}>
          View activity <span aria-hidden="true">›</span>
        </a>
      </div>
    </section>
  );
}
