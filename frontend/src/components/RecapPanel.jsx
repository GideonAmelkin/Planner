import React, { useEffect, useState } from 'react';
import { parseISO, format } from 'date-fns';
import { getRecap } from '../services/api';

// Static "done" check, mirroring CheckMark's done state in PrioritizedTaskList.jsx.
function DoneCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="10" cy="10" r="9" fill="#2E7D32" stroke="#2E7D32" strokeWidth="1.5" />
      <path d="M5.6 10.4 L8.6 13.4 L14.4 7.2" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function dateLabel(iso) {
  try {
    return format(parseISO(iso), 'EEEE, MMMM do yyyy');
  } catch (_) {
    return iso;
  }
}

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
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(45, 52, 54, 0.5)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 80, zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: '92vw',
          background: '#FBF6E7',
          border: '1px solid #2D3436',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '78vh',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div className="serif" style={{ fontSize: 20, fontWeight: 500, color: '#2D3436' }}>Recap</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#2D3436' }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: '#6B5B40', marginBottom: 12, letterSpacing: 0.3 }}>
          Completed action items, most recent first
          {!loading && !error ? ` · ${totalItems} item${totalItems === 1 ? '' : 's'}` : ''}
        </div>

        {error ? <div style={{ color: '#C62828', fontSize: 12, marginBottom: 8 }}>{error}</div> : null}

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {loading ? (
            <div style={{ color: '#6B5B40', fontSize: 13 }}>Loading…</div>
          ) : groups.length === 0 ? (
            <div style={{ color: '#6B5B40', fontSize: 13, fontStyle: 'italic' }}>No completed items yet.</div>
          ) : (
            groups.map((g) => (
              <div key={g.date} style={{ marginBottom: 18 }}>
                <div
                  className="serif"
                  style={{
                    fontSize: 15, fontWeight: 600, color: '#2D3436',
                    borderBottom: '1px solid #C9BB9A',
                    paddingBottom: 4, marginBottom: 8,
                  }}
                >
                  {dateLabel(g.date)}
                  <span style={{ color: '#A89368', fontWeight: 400, fontSize: 12 }}> · {g.items.length}</span>
                </div>
                {g.items.map((it) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0' }}>
                    <DoneCheck />
                    {it.priority ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#A89368', minWidth: 16, marginTop: 1 }}>
                        {it.priority}{it.priority_num != null ? it.priority_num : ''}
                      </span>
                    ) : null}
                    <span style={{
                      fontSize: 13,
                      color: '#2D3436',
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
