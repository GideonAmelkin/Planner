import React from 'react';
import { groupOf } from '../muscles';
import { fmtVolume, Delta } from '../ptParts';
import { COLORS } from '../../shared/styles';
import { W } from '../theme';

// The card a body-figure dot opens (3D figure and the SVG fallback): pounds, share of the range,
// top exercise, change against the same-length window before only when that window has gym sessions
// to compare with, and Open in Trainer. `pos` places it absolutely; without it, it sits in the flow.
export const POP_W = 220;
const pct = (x) => `${Math.round(x * 100)}%`;

export default function MusclePopover({ muscle, now, total, before, beforeCount, beforeLabel, unit, top, onClose, onOpenTrainer, pos }) {
  const g = groupOf(muscle);
  const beforeKg = before ? before[muscle] || 0 : 0;
  return (
    <div role="dialog" aria-label={`${g.label} details`} style={{
      ...(pos ? { position: 'absolute', left: pos.left, top: pos.top } : { position: 'relative', margin: '8px auto 0' }),
      width: POP_W, maxWidth: '100%', background: 'rgba(255,255,255,.96)', border: `1px solid ${COLORS.hairline}`, borderRadius: 16,
      boxShadow: '0 12px 30px rgba(30,50,110,.14)', padding: '12px 14px', fontSize: 12, zIndex: 3,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: g.color }} />{g.label}
        </span>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: COLORS.muted, fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
      </div>
      <div style={{ color: COLORS.muted, marginTop: 4 }}>{fmtVolume(now[muscle], unit)} {unit} lifted, {pct(now[muscle] / total)} of the range</div>
      {top[muscle] ? <div style={{ marginTop: 4 }}>Top: {top[muscle].name}, {fmtVolume(top[muscle].kg, unit)} {unit}</div> : null}
      <div style={{ marginTop: 4 }}>
        {!before ? null
          : !beforeCount ? <span style={{ color: COLORS.muted }}>No change shown: no gym sessions {beforeLabel}.</span>
            : beforeKg > 0 ? <Delta kg={now[muscle] - beforeKg} unit={unit} suffix={` vs ${beforeLabel}`} />
              : <span style={{ color: COLORS.muted }}>Not trained {beforeLabel}.</span>}
      </div>
      <button type="button" onClick={() => onOpenTrainer(muscle)} style={{ marginTop: 8, border: 'none', background: 'transparent', padding: 0, color: W.blue, fontWeight: 600, cursor: 'pointer', font: 'inherit', fontSize: 12 }}>Open in Trainer →</button>
    </div>
  );
}
