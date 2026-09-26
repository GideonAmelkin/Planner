import React from 'react';
import { COLORS } from '../styles';

const DOT = { ok: COLORS.done, error: COLORS.danger, off: COLORS.faint };

// One integration in Settings > Connections: status dot, name, detail line,
// and whatever action sits on the right (a Connect / Disconnect or Sign In /
// Sign Out button, or a pill when there is nothing to click).
export default function ConnectionRow({ status = 'off', name, detail, detailColor, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      padding: '10px 12px', background: COLORS.page, borderRadius: 8, marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span
          title={status === 'ok' ? 'Connected' : status === 'error' ? 'Error' : 'Not connected'}
          style={{ width: 8, height: 8, borderRadius: '50%', background: DOT[status] || DOT.off, flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{name}</div>
          {detail ? <div style={{ fontSize: 12, color: detailColor || COLORS.muted }}>{detail}</div> : null}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{children}</div>
    </div>
  );
}
