import React from 'react';
import { MUSCLE_GROUPS } from './muscles';
import { fmtVolume, muted } from './ptParts';
import { COLORS } from '../shared/styles';
import { W } from './theme';
import { figureLabel } from './ui';

// The Trainer's muscle chart (the Overview's figure and radar show the same numbers): a row per muscle group with
// this range's volume as a solid bar and the range before as a dashed ghost on the same scale,
// the pounds and the change. Rows select the group like the figures do. `before` is null for
// Lifetime: then no ghosts and no change column. `homeTrained`: groups a home workout in this range
// worked (muscles.js homeGroups); without pounds they read "0 lb" and are not listed as not trained.
export default function MuscleChart({ now, before, beforeLabel, unit, selected, onSelect, homeTrained = new Set() }) {
  const max = Math.max(1, ...MUSCLE_GROUPS.map((g) => Math.max(now[g.key] || 0, before ? before[g.key] || 0 : 0)));
  const home = (g) => (homeTrained.has(g.key) ? 1 : 0);
  const rows = [...MUSCLE_GROUPS].sort((a, b) => (now[b.key] || 0) - (now[a.key] || 0) || home(b) - home(a) || (before ? (before[b.key] || 0) - (before[a.key] || 0) : 0));
  const missing = MUSCLE_GROUPS.filter((g) => !now[g.key] && !homeTrained.has(g.key));
  const pct = (v) => `${((100 * v) / max).toFixed(1)}%`;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...figureLabel, marginBottom: 8 }}>Muscles worked</div>
      <div style={{ display: 'flex', gap: '6px 18px', flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, ...muted }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 8, background: W.blue, borderRadius: 999 }} />This range</span>
        {before
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 8, border: `1.5px dashed ${COLORS.muted}`, borderRadius: 999, boxSizing: 'border-box' }} />Before: {beforeLabel}</span>
          : <span>Lifetime has no earlier range to compare</span>}
        <span style={{ color: COLORS.ink }}>
          {missing.length ? <><strong>Not trained in this range:</strong> {missing.map((g) => g.label).join(', ')}</> : <strong>Every group got work in this range.</strong>}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {rows.map((g) => {
          const v = now[g.key] || 0;
          const b = before ? before[g.key] || 0 : 0;
          const d = v - b;
          const on = selected === g.key;
          return (
            <button key={g.key} type="button" onClick={() => onSelect(g.key)} aria-pressed={on}
              style={{ display: 'grid', gridTemplateColumns: 'minmax(76px, 110px) minmax(40px, 1fr) minmax(64px, 164px)', gap: 12, alignItems: 'center', padding: '7px 10px', borderRadius: 12, border: 'none', background: on ? 'rgba(255,255,255,.9)' : 'transparent', boxShadow: on ? '0 2px 10px rgba(30,50,110,.08)' : 'none', cursor: 'pointer', font: 'inherit', color: COLORS.ink, textAlign: 'left' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: on ? 700 : 500 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flex: 'none' }} />{g.label}
              </span>
              <span style={{ position: 'relative', height: 14, borderRadius: 999, background: '#EEF2FA' }}>
                {before && b ? <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(b), border: `1.5px dashed ${COLORS.muted}`, borderRadius: 999, boxSizing: 'border-box' }} /> : null}
                {v ? <span style={{ position: 'absolute', left: 0, top: 2, bottom: 2, width: pct(v), background: `linear-gradient(90deg, ${g.color}99, ${g.color})`, borderRadius: 999 }} /> : null}
              </span>
              <span style={{ display: 'flex', gap: '0 12px', justifyContent: 'flex-end', flexWrap: 'wrap', fontSize: 13, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                <span style={{ minWidth: 64, color: v || home(g) ? COLORS.ink : COLORS.muted }} title={!v && home(g) ? 'Home workout: no weight lifted' : undefined}>{v ? `${fmtVolume(v, unit)} ${unit}` : home(g) ? `0 ${unit}` : 'none'}</span>
                {before ? (
                  <span style={{ minWidth: 64, fontWeight: 600, color: Math.abs(d) < 0.5 ? COLORS.muted : d > 0 ? COLORS.done : COLORS.danger }}>
                    {Math.abs(d) < 0.5 ? 'same' : `${d > 0 ? '+' : '-'}${fmtVolume(Math.abs(d), unit)} ${unit}`}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
