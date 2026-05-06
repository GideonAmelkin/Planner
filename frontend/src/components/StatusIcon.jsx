import React from 'react';

export const STATUSES = ['in_process', 'completed', 'forwarded', 'delegated', 'deleted'];

export const STATUS_GLYPH = {
  in_process: '•',     // •
  completed: '✓',      // ✓
  forwarded: '→',      // →
  delegated: 'G',
  deleted: '✕',         // ✕
};

export const STATUS_LABEL = {
  in_process: 'In Process',
  completed: 'Completed',
  forwarded: 'Forwarded',
  delegated: 'Delegated',
  deleted: 'Deleted',
};

export default function StatusIcon({ status, onClick, size = 18 }) {
  const glyph = STATUS_GLYPH[status] || '·';
  const isDelegated = status === 'delegated';
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${STATUS_LABEL[status] || status} — click to cycle`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size + 6,
        height: size + 6,
        border: 'none',
        background: 'transparent',
        color: '#2D3436',
        fontSize: isDelegated ? size - 4 : size,
        fontWeight: 700,
        lineHeight: 1,
        padding: 0,
      }}
    >
      {isDelegated ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <span>G</span>
          <span style={{ fontSize: size - 6, marginLeft: -1 }}>☑</span>
        </span>
      ) : (
        glyph
      )}
    </button>
  );
}

export function nextStatus(s) {
  const idx = STATUSES.indexOf(s);
  return STATUSES[(idx + 1) % STATUSES.length];
}
