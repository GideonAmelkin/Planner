import React from 'react';
import { PageContainer, PageTitle, ControlsRow, DateControls, RangeControl, TabStrip, SectionHeading } from '../primitives';
import Sparkline from '../Sparkline';
import { G } from '../theme';
import { RANGES } from '../nav';
import { series, localOffset } from '../format';

export const ok = (results, key) => (results && results[key] && results[key].ok ? results[key].data : null);
export const first = (v) => (Array.isArray(v) ? v[0] : v);
export const pageTo = (slug) => (d) => `/health/${d}/${slug}`;
export const rangeOptions = (keys) => RANGES.filter((r) => keys.includes(r.key));
export const dayMs = (iso) => Date.parse(`${iso}T00:00:00Z`);

// Title + date circles + range control (+ optional tabs): the frame of Steps, Sleep, Weight...
export function MetricFrame({ title, info = true, slug, dateISO, range, setRange, ranges, tabs = null, tabValue, onTab, right, narrow = false, children, dateLabel = null, titleSub = null }) {
  return (
    <PageContainer narrow={narrow}>
      <PageTitle info={info} right={right} sub={titleSub}>{title}</PageTitle>
      <ControlsRow
        left={<DateControls dateISO={dateISO} to={pageTo(slug)} label={dateLabel} />}
        right={ranges && ranges.length ? <RangeControl options={rangeOptions(ranges)} value={range} onChange={setRange} /> : null}
      />
      {tabs ? <TabStrip tabs={tabs} value={tabValue} onChange={onTab} style={{ marginBottom: 24 }} /> : null}
      {children}
    </PageContainer>
  );
}

// "Daily Timeline" block: an area sparkline of a [[ts, v]] series or Garmin's empty text.
export function DailyTimeline({ payload, arrayKey, color = G.blue, unit = '', bars = false, min, max, legend = null, title = 'Daily Timeline' }) {
  const raw = series(payload && payload[arrayKey]).filter((p) => p[1] >= 0);
  const pts = raw.some((p) => p[1] > 0) ? raw : [];
  return (
    <div>
      <SectionHeading style={{ marginBottom: 12 }}>{title}</SectionHeading>
      {pts.length ? <Sparkline points={pts} offset={localOffset(payload)} color={color} unit={unit} bars={bars} min={min} max={max} /> : (
        <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.muted, fontSize: 12, background: G.surface2 }}>No timeline data for this day.</div>
      )}
      {legend ? <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 10, fontSize: 11, color: G.muted }}>{legend.map((l) => <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: l.line ? 14 : 8, height: l.line ? 2 : 8, borderRadius: l.line ? 0 : '50%', background: l.color, display: 'inline-block' }} />{l.label}</span>)}</div> : null}
    </div>
  );
}

// Per-day bars for 7 Days / 4 Weeks / 1 Year views: rows [{calendarDate, value}].
export function DailyBars({ rows, valueKey, color = G.blue, unit = '', title = 'Daily' }) {
  const pts = (rows || []).filter((r) => r && r.calendarDate).map((r) => [dayMs(r.calendarDate), Number(r[valueKey] || 0)]);
  return (
    <div>
      <SectionHeading style={{ marginBottom: 12 }}>{title}</SectionHeading>
      {pts.length ? <Sparkline points={pts} bars color={color} unit={unit} min={0} /> : <div style={{ color: G.muted, fontSize: 12 }}>No data for this time period.</div>}
    </div>
  );
}

export const Center = ({ children, style }) => <div style={{ textAlign: 'center', ...style }}>{children}</div>;
export const Para = ({ children, style }) => <p style={{ fontSize: 12, lineHeight: 1.6, color: G.text, margin: '8px 0', ...style }}>{children}</p>;
