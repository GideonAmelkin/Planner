import React, { useEffect, useState } from 'react';
import { getRecap } from '../services/api';
import { longDate } from '../utils/dayInfo';
import CheckMark from './CheckMark';
import { COLORS, modalBackdrop, modalCard, modalClose, modalTitle } from '../styles';

export default function RecapPanel({ onClose }) {
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await getRecap();
        if (active) { setGroups(Array.isArray(data) ? data : []); setError(null); }
      } catch (err) {
        if (active) setError(err.message || String(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const totalItems = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...modalCard,
          width: 560,
          maxWidth: '92vw',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '78vh',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div className="serif" style={modalTitle}>Recap</div>
          <button onClick={onClose} style={modalClose}>×</button>
        </div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12, letterSpacing: 0.3 }}>
          Completed action items, most recent first
          {!loading && !error ? ` · ${totalItems} item${totalItems === 1 ? '' : 's'}` : ''}
        </div>

        {error ? <div style={{ color: COLORS.danger, fontSize: 12, marginBottom: 8 }}>{error}</div> : null}

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {loading ? (
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Loading…</div>
          ) : groups.length === 0 ? (
            <div style={{ color: COLORS.muted, fontSize: 13, fontStyle: 'italic' }}>No completed items yet.</div>
          ) : (
            groups.map((g) => (
              <div key={g.date} style={{ marginBottom: 18 }}>
                <div
                  className="serif"
                  style={{
                    fontSize: 15, fontWeight: 600, color: COLORS.ink,
                    borderBottom: `1px solid ${COLORS.hairline}`,
                    paddingBottom: 4, marginBottom: 8,
                  }}
                >
                  {longDate(g.date)}
                  <span style={{ color: COLORS.accent, fontWeight: 400, fontSize: 12 }}> · {g.items.length}</span>
                </div>
                {g.items.map((it) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0' }}>
                    <CheckMark done size={18} />
                    {it.priority ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, minWidth: 16, marginTop: 1 }}>
                        {it.priority}{it.priority_num != null ? it.priority_num : ''}
                      </span>
                    ) : null}
                    <span style={{
                      fontSize: 13,
                      color: COLORS.ink,
                      lineHeight: 1.4,
                    }}>
                      {it.text}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
