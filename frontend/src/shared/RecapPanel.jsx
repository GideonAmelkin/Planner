import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getRecap } from './api';
import { longDate } from './dayInfo';
import CheckMark from './CheckMark';
import { COLORS, PRIORITY_CHIPS, modalBackdrop, modalCard, modalClose, modalTitle, pill } from './styles';

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

  // Rendered into document.body so the sticky rail's stacking context cannot trap the backdrop.
  return createPortal(
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
          <div style={modalTitle}>Recap</div>
          <button onClick={onClose} style={modalClose}>×</button>
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 14 }}>
          Completed action items, most recent first
          {!loading && !error ? ` · ${totalItems} item${totalItems === 1 ? '' : 's'}` : ''}
        </div>

        {error ? <div style={{ color: COLORS.danger, fontSize: 12, marginBottom: 8 }}>{error}</div> : null}

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {loading ? (
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Loading...</div>
          ) : groups.length === 0 ? (
            <div style={{ color: COLORS.muted, fontSize: 13 }}>No completed items yet.</div>
          ) : (
            groups.map((g) => (
              <div key={g.date} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>
                  {longDate(g.date)}
                  <span style={pill}>{g.items.length}</span>
                </div>
                {g.items.map((it) => {
                  const chip = it.priority ? PRIORITY_CHIPS[it.priority] : null;
                  return (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 8, minHeight: 32 }}>
                    <CheckMark done size={18} />
                    {chip ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: 22, height: 20, padding: '0 7px', borderRadius: 999,
                        background: chip.bg, color: chip.fg, fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>
                        {it.priority}{it.priority_num != null ? it.priority_num : ''}
                      </span>
                    ) : null}
                    <span style={{
                      fontSize: 14,
                      color: COLORS.ink,
                      lineHeight: 1.4,
                    }}>
                      {it.text}
                    </span>
                  </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
