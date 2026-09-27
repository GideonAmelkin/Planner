import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ok, first } from './common';
import { PageContainer, PageTitle, EmptyState, StatPair, StatRow, BlueButton, MapView, SectionHeading } from '../primitives';
import GarminIcon from '../GarminIcon';
import Sparkline from '../Sparkline';
import { G, sectionLabel, linkText } from '../theme';
import { metersToMiles } from '../format';
import { num, titleCase } from '../../shared/format';

const hms = (sec) => { if (!sec && sec !== 0) return '--'; const s = Math.round(sec); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`; };
const pace = (sec, meters) => { const mi = metersToMiles(meters); if (!sec || !mi) return '--'; const spm = sec / mi; return `${Math.floor(spm / 60)}:${String(Math.round(spm % 60)).padStart(2, '0')} /mi`; };
const typeIcon = (key = '') => (/run/i.test(key) ? 'activity' : /cycl|bik/i.test(key) ? 'gear' : /swim/i.test(key) ? 'hydration' : /walk|hik/i.test(key) ? 'steps' : 'training');
const typeColor = (key = '') => (/run/i.test(key) ? G.metric.stress : /cycl|bik/i.test(key) ? G.metric.battery : /swim/i.test(key) ? G.metric.respiration : G.green);
const dayLabel = (s) => { const d = new Date(String(s).replace(' ', 'T')); return { top: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), bottom: d.getFullYear() }; };

const SPORT_TABS = [{ key: 'all', label: 'All' }, { key: 'running', label: '', icon: 'activity' }, { key: 'cycling', label: '', icon: 'gear' }, { key: 'swimming', label: '', icon: 'hydration' }, { key: 'other', label: '', icon: 'training' }];
const sportOf = (a) => { const k = (a.activityType && a.activityType.typeKey) || ''; return /run/i.test(k) ? 'running' : /cycl|bik/i.test(k) ? 'cycling' : /swim/i.test(k) ? 'swimming' : 'other'; };

export function AllActivities({ dateISO, results }) {
  const list = ok(results, 'list') || []; const count = ok(results, 'count');
  const [sport, setSport] = useState('all'); const [q, setQ] = useState('');
  const rows = list.filter((a) => (sport === 'all' || sportOf(a) === sport) && (!q || (a.activityName || '').toLowerCase().includes(q.toLowerCase())));
  return (
    <PageContainer style={{ padding: 'clamp(16px, 3vw, 30px)' }}>
      <PageTitle info={false} right={<div style={{ display: 'flex', gap: 14, fontSize: 12, color: G.text }}><span>+ Manual Activity</span><span>Import</span><span>Export CSV</span></div>} style={{ marginBottom: 8 }}>Activities</PageTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Activities" style={{ border: `1px solid ${G.faint}`, borderRadius: 4, padding: '5px 10px', fontSize: 12, width: 170, fontFamily: G.font }} />
        <button type="button" style={{ ...linkText, background: G.blue, color: 'white', padding: '5px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>Compare 0 of {rows.length}</button>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden' }}>
            {SPORT_TABS.map((t) => <button key={t.key} type="button" onClick={() => setSport(t.key)} style={{ flex: 1, border: 'none', padding: '6px 0', background: sport === t.key ? G.blue : G.surface2, color: sport === t.key ? 'white' : G.muted, cursor: 'pointer', fontFamily: G.font, fontSize: 12 }}>{t.icon ? <GarminIcon name={t.icon} color={sport === t.key ? 'white' : G.blue} size={14} /> : t.label}</button>)}
          </div>
        </div>
      </div>
      {rows.length === 0 ? <EmptyState icon="activity" title="No activities" sub={count ? `${count} activities on your account; none match this filter.` : 'Activities recorded with your Garmin device show here.'} /> : rows.map((a) => {
        const d = dayLabel(a.startTimeLocal);
        return (
          <div key={a.activityId} style={{ display: 'grid', gridTemplateColumns: '32px 56px minmax(140px, 1.6fr) repeat(5, minmax(70px, 1fr))', alignItems: 'center', gap: 10, padding: '10px 6px', borderBottom: `1px solid ${G.border}`, fontSize: 13 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: typeColor(a.activityType && a.activityType.typeKey), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GarminIcon name={typeIcon(a.activityType && a.activityType.typeKey)} color="white" size={16} /></div>
            <div><div style={{ fontSize: 12 }}>{d.top}</div><div style={{ fontSize: 10, color: G.muted }}>{d.bottom}</div></div>
            <div><Link to={`/garmin/${dateISO}/activity/${a.activityId}`} style={{ color: G.text }}>{a.activityName}</Link><div style={{ fontSize: 10, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{titleCase(a.activityType && a.activityType.typeKey)}</div></div>
            {[[`${num(metersToMiles(a.distance), 2)} mi`, 'Distance'], [hms(a.duration), 'Time'], [pace(a.duration, a.distance), 'Avg Pace'], [a.averageHR ? `${a.averageHR} bpm` : '--', 'Avg HR'], [num(a.calories) || '--', 'Calories']].map(([v, l]) => <div key={l}><div style={{ fontWeight: 300 }}>{v}</div><div style={{ fontSize: 9, color: G.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{l}</div></div>)}
          </div>
        );
      })}
    </PageContainer>
  );
}

export function Epics() {
  return (
    <PageContainer narrow>
      <PageTitle info={false} right={null}>Epics</PageTitle>
      <EmptyState icon="calendar" title="Go on an Epic Adventure" sub="A Garmin Epic is a collection of your activities, maps, photos and notes put together in travel journal form to tell your story. When you create an Epic, related activities, stats and your location along the map for selected dates are automatically displayed, and you can add photos and other details as desired." button={<BlueButton style={{ fontSize: 12, padding: '6px 14px' }}>Create an Epic</BlueButton>} />
    </PageContainer>
  );
}

// The activity page: breadcrumb, name, stat row, map + charts, right column.
export function ActivityDetail({ dateISO, results }) {
  const { id } = useParams();
  const a = ok(results, 'activity') || {}; const details = ok(results, 'details') || {}; const devices = ok(results, 'devices') || [];
  const sm = a.summaryDTO || {}; const type = (a.activityTypeDTO && a.activityTypeDTO.typeKey) || '';
  const poly = ((details.geoPolylineDTO || {}).polyline || []).map((p) => (Array.isArray(p) ? [p[0], p[1]] : [p.lat, p.lon])).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  const charts = (() => {
    const desc = details.metricDescriptors || []; const rows = details.activityDetailMetrics || [];
    const idx = (re) => { const d = desc.find((x) => re.test(x.key)); return d ? d.metricsIndex : -1; };
    const ti = idx(/directTimestamp/); const mk = (re) => { const i = idx(re); if (i < 0 || ti < 0) return []; return rows.map((r) => [r.metrics[ti], r.metrics[i]]).filter((p) => p[0] && p[1] !== null && p[1] !== undefined); };
    return [
      ['Elevation', mk(/directElevation/), G.green, ' ft', (v) => v * 3.28084],
      ['Pace', mk(/directSpeed/), G.blue, ' /mi', null],
      ['Heart Rate', mk(/directHeartRate/), G.metric.heart, ' bpm', null],
      ['Temperature', mk(/directAirTemperature/), G.metric.respiration, ' °F', (v) => v * 9 / 5 + 32],
    ].map(([label, pts, color, unit, conv]) => [label, conv ? pts.map((p) => [p[0], conv(p[1])]) : pts, color, unit]);
  })();
  const start = a.summaryDTO && a.summaryDTO.startTimeLocal ? new Date(a.summaryDTO.startTimeLocal) : null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 16 }}>
      <PageContainer style={{ padding: 'clamp(16px, 3vw, 30px)', maxWidth: 'none', margin: 0 }}>
        <div style={{ ...sectionLabel, fontSize: 10, marginBottom: 10 }}><Link to={`/garmin/${dateISO}/activities`} style={{ color: G.text }}>Activities</Link> / By {a.ownerFullName || 'you'}{start ? ` on ${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: G.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GarminIcon name={typeIcon(type)} color={typeColor(type)} size={20} /></div>
          <div><div style={{ fontSize: 22, fontWeight: 300 }}>{a.activityName || `Activity ${id}`} <span style={{ color: G.muted, fontSize: 12 }}>✎</span></div><div style={{ fontSize: 10, color: G.muted }}>{titleCase(type)} · Event Type: {titleCase((a.eventTypeDTO || {}).typeKey || 'uncategorized')} · Course: -- · Gear: <span style={{ color: G.blue }}>Add</span></div></div>
        </div>
        <StatRow style={{ margin: '16px 0 20px' }}>
          <StatPair value={num(metersToMiles(sm.distance), 2)} unit="mi" label="Distance" />
          <StatPair value={hms(sm.duration)} label="Time" />
          <StatPair value={pace(sm.duration, sm.distance)} label="Avg Pace" />
          <StatPair value={sm.elevationGain !== undefined ? num(sm.elevationGain * 3.28084) : null} unit="ft" label="Total Ascent" />
          <StatPair value={num(sm.calories)} label="Calories" />
        </StatRow>
        <MapView polyline={poly.length ? poly : null} height={340} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}>
          <button type="button" style={{ ...linkText, background: G.surface2, padding: '4px 10px', borderRadius: 4, fontSize: 11, color: G.text }}>Customize Charts</button>
          <div style={{ display: 'flex', gap: 4 }}>{['Time', 'Distance'].map((t, i) => <span key={t} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: i === 0 ? G.blue : G.surface2, color: i === 0 ? 'white' : G.text }}>{t}</span>)}</div>
        </div>
        {charts.map(([label, pts, color, unit]) => (
          <div key={label} style={{ borderTop: `1px solid ${G.border}`, padding: '10px 0' }}>
            <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />{label}</div>
            {pts.length ? <Sparkline points={pts} color={color} unit={unit} /> : <div style={{ fontSize: 11, color: G.muted }}>No {label.toLowerCase()} data.</div>}
          </div>
        ))}
      </PageContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <PageContainer style={{ padding: 16, margin: 0 }}>
          <div style={{ fontSize: 12, marginBottom: 8 }}>Photos</div>
          <div style={{ border: `1px dashed ${G.faint}`, padding: 16, textAlign: 'center', fontSize: 11, color: G.muted }}>Click to add photos to your activity</div>
          <div style={{ fontSize: 12, margin: '16px 0 8px' }}>Notes</div>
          <textarea placeholder="How was your activity?" rows={3} style={{ width: '100%', border: `1px solid ${G.faint}`, borderRadius: 4, padding: 8, fontSize: 12, fontFamily: G.font, resize: 'vertical' }} defaultValue={a.description || ''} />
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}><input placeholder="Add a comment, use @ to tag" style={{ flex: 1, border: `1px solid ${G.faint}`, borderRadius: 4, padding: '6px 8px', fontSize: 12, fontFamily: G.font }} /><BlueButton style={{ fontSize: 11, padding: '4px 10px' }}>Post</BlueButton></div>
        </PageContainer>
        <PageContainer style={{ padding: 16, margin: 0, textAlign: 'center' }}>
          {first(devices) ? <>{first(devices).imageUrl ? <img src={first(devices).imageUrl} alt="" style={{ width: 120, height: 120, objectFit: 'contain' }} /> : <GarminIcon name="training" size={48} color={G.faint} />}<div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{first(devices).productDisplayName}</div><div style={{ fontSize: 10, color: G.muted }}>Software: {first(devices).softwareVersion || '--'}</div></> : <div style={{ fontSize: 12, color: G.muted }}>No device</div>}
          <SectionHeading style={{ marginTop: 16, justifyContent: 'center' }}>Gear</SectionHeading>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: G.surface2, margin: '10px auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GarminIcon name="gear" color={G.muted} size={22} /></div>
          <div style={{ fontSize: 14, fontWeight: 300 }}>No gear added</div>
        </PageContainer>
      </div>
    </div>
  );
}
