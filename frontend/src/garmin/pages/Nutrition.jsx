import React, { useState } from 'react';
import { MetricFrame, ok, Center } from './common';
import { TwoCol, SectionHeading, StatPair, StatRow, RingGauge } from '../primitives';
import { G } from '../theme';
import { mlToOz } from '../format';
import { num } from '../../shared/format';
import { postGarmin } from '../api';

const HOURS = ['7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM'];

export function Nutrition({ dateISO, range, setRange, results, slug }) {
  const log = ok(results, 'log') || {}; const meals = ok(results, 'meals') || {};
  const totals = log.totals || log.summary || {};
  const cal = totals.calories || totals.totalCalories; const goal = (ok(results, 'settings') || {}).calorieGoal || 2000;
  return (
    <MetricFrame title="Nutrition" slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w', '1y']}>
      <TwoCol
        left={<>
          <SectionHeading>Overview</SectionHeading>
          <div style={{ fontSize: 13, margin: '14px 0 8px' }}>Calories &amp; Macros</div>
          <div style={{ background: G.border, height: 12, width: '100%' }}>{cal ? <div style={{ width: `${Math.min(100, (cal / goal) * 100)}%`, height: '100%', background: G.metric.stepsFill }} /> : null}</div>
          <StatRow cols="1fr 1fr" style={{ marginTop: 16, maxWidth: 260 }}>
            <StatPair value={num(cal)} label="Calories" dot={G.metric.battery} small />
            <StatPair value={totals.protein ? `${num(totals.protein)} g` : '-- g'} label="Protein" dot={G.metric.battery} small />
            <StatPair value={totals.fat ? `${num(totals.fat)} g` : '-- g'} label="Fat" dot={G.metric.stress} small />
            <StatPair value={totals.carbs ? `${num(totals.carbs)} g` : '-- g'} label="Carbs" dot={G.green} small />
          </StatRow>
        </>}
        right={<>
          <SectionHeading right={<span style={{ fontSize: 11, border: `1px solid ${G.faint}`, borderRadius: 4, padding: '2px 8px', color: G.muted }}>Edit ⌄</span>}>Daily Timeline</SectionHeading>
          <div style={{ marginTop: 12 }}>{HOURS.map((h) => {
            const entries = ((meals.meals || meals.entries || []).filter((m) => (m.timeLabel || m.time || '').includes(h.split(' ')[0])));
            return <div key={h} style={{ display: 'flex', gap: 12, alignItems: 'baseline', borderBottom: `1px solid ${G.border}`, padding: '6px 0', fontSize: 11 }}><span style={{ width: 44, color: G.muted }}>{h}</span><span style={{ flex: 1 }}>{entries.map((e) => e.name || e.foodName).join(', ')}</span></div>;
          })}</div>
        </>}
      />
    </MetricFrame>
  );
}

export function Hydration({ dateISO, range, setRange, results, slug }) {
  const h = ok(results, 'hyd') || {};
  const [ml, setMl] = useState(null);
  const value = ml === null ? (h.valueInML || 0) : ml;
  const cups = Math.round(mlToOz(value) / 8);
  const goalCups = h.goalInML ? Math.round(mlToOz(h.goalInML) / 8) : 16;
  const adjust = async (delta) => {
    const next = Math.max(0, value + delta);
    setMl(next);
    try { await postGarmin('add_hydration_data', { value_in_ml: delta, cdate: dateISO }); } catch (_) { /* leave the local value */ }
  };
  return (
    <MetricFrame title="Hydration" slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w', '1y']}>
      <Center style={{ padding: '10px 0 20px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 28 }}>
          <button type="button" onClick={() => adjust(-237)} aria-label="Remove a cup" style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${G.border}`, background: 'white', fontSize: 22, color: G.blue, cursor: 'pointer', fontFamily: G.font }}>−</button>
          <RingGauge value={cups} goal={goalCups} color={G.metric.hydration} label={`${goalCups} Cups`} />
          <button type="button" onClick={() => adjust(237)} aria-label="Add a cup" style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${G.border}`, background: 'white', fontSize: 22, color: G.blue, cursor: 'pointer', fontFamily: G.font }}>+</button>
        </div>
        <StatRow style={{ marginTop: 24, justifyContent: 'center', display: 'inline-grid' }}>
          <StatPair value={num(mlToOz(value))} unit="oz" label="Intake" small />
          <StatPair value={num(mlToOz(h.goalInML))} unit="oz" label="Goal" small />
          <StatPair value={h.sweatLossInML ? num(mlToOz(h.sweatLossInML)) : null} unit="oz" label="Sweat Loss" small />
        </StatRow>
      </Center>
    </MetricFrame>
  );
}

export function CaloriesBurned({ dateISO, range, setRange, results, slug }) {
  const s = ok(results, 'summary') || {}; const daily = ok(results, 'daily') || [];
  const total = range === '1d' ? s.totalKilocalories : daily.reduce((n, d) => n + ((d.values && d.values.totalKilocalories) || d.totalKilocalories || 0), 0);
  const active = range === '1d' ? s.activeKilocalories : daily.reduce((n, d) => n + ((d.values && d.values.activeKilocalories) || d.activeKilocalories || 0), 0);
  const resting = range === '1d' ? s.bmrKilocalories : daily.reduce((n, d) => n + ((d.values && d.values.bmrKilocalories) || d.bmrKilocalories || 0), 0);
  return (
    <MetricFrame title="Calories Burned" slug={slug} dateISO={dateISO} range={range} setRange={setRange} ranges={['1d', '7d', '4w', '1y']}>
      <SectionHeading>Total Calories Burned</SectionHeading>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', marginTop: 10 }}>
        <StatPair value={num(active)} label="Active Calories" />
        <span style={{ fontSize: 24, fontWeight: 300, color: G.muted }}>+</span>
        <StatPair value={num(resting)} label="Resting Calories" />
        <span style={{ fontSize: 24, fontWeight: 300, color: G.muted }}>=</span>
        <StatPair value={num(total)} label="Total Calories Burned" />
      </div>
    </MetricFrame>
  );
}
