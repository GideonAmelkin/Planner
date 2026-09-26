import React, { useEffect, useMemo, useState } from 'react';
import { getGarminEndpoints, callGarmin, postGarmin } from '../../services/api';
import { COLORS, outlineButton } from '../../styles';
import { titleCase } from '../../utils/garminFormat';

const GROUP_ORDER = ['profile', 'daily', 'sleep', 'heart', 'stress', 'body_battery', 'recovery', 'training', 'activities', 'workouts', 'body', 'hydration', 'nutrition', 'wellness', 'goals_badges', 'devices', 'gear', 'golf', 'system'];

const inputStyle = { border: `1px solid ${COLORS.hairline}`, background: 'white', padding: '3px 6px', fontSize: 12, width: 150, maxWidth: '100%' };
const kindPill = (kind) => ({
  fontSize: 9, fontWeight: 700, letterSpacing: 0.6, padding: '1px 6px', borderRadius: 2,
  color: kind === 'read' ? COLORS.done : kind === 'write' ? COLORS.danger : COLORS.faint,
  border: `1px solid ${kind === 'read' ? COLORS.done : kind === 'write' ? COLORS.danger : COLORS.faint}`,
});

// Every Garmin endpoint in the registry, with its parameters as inputs and the raw
// JSON result underneath. Dates default to the day being viewed.
export default function EndpointExplorer({ dateISO }) {
  const [endpoints, setEndpoints] = useState(null);
  const [error, setError] = useState(null);
  const [openGroups, setOpenGroups] = useState({});
  const [filter, setFilter] = useState('');

  useEffect(() => {
    getGarminEndpoints().then((d) => setEndpoints(d.endpoints || [])).catch((e) => setError(e.message || String(e)));
  }, []);

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const by = {};
    for (const e of endpoints || []) {
      if (q && !e.name.includes(q) && !e.group.includes(q)) continue;
      (by[e.group] = by[e.group] || []).push(e);
    }
    return GROUP_ORDER.filter((g) => by[g]).map((g) => [g, by[g]]);
  }, [endpoints, filter]);

  if (error) return <div style={{ color: COLORS.danger, fontSize: 12 }}>{error}</div>;
  if (!endpoints) return <div style={{ color: COLORS.muted, fontSize: 12 }}>Loading endpoints...</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, fontSize: 12, color: COLORS.muted }}>
        <span>{endpoints.length} endpoints mapped from connect.garmin.com. Reads are GET, writes are POST, file transfers are not exposed.</span>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter" style={{ ...inputStyle, width: 140 }} />
      </div>
      {groups.map(([group, list]) => {
        const open = !!openGroups[group];
        return (
          <div key={group} style={{ borderTop: `1px solid ${COLORS.hairline}` }}>
            <button
              type="button"
              onClick={() => setOpenGroups((o) => ({ ...o, [group]: !o[group] }))}
              style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '8px 0', display: 'flex', justifyContent: 'space-between', color: COLORS.ink, fontSize: 13, fontWeight: 600 }}
            >
              <span>{titleCase(group)} <span style={{ color: COLORS.muted, fontWeight: 400 }}>({list.length})</span></span>
              <span style={{ color: COLORS.accent }}>{open ? '▾' : '▸'}</span>
            </button>
            {open ? list.map((e) => <EndpointRow key={e.name} entry={e} dateISO={dateISO} />) : null}
          </div>
        );
      })}
    </div>
  );
}

function EndpointRow({ entry, dateISO }) {
  const [values, setValues] = useState(() => {
    const v = {};
    for (const p of entry.params) if (p.type === 'date') v[p.name] = dateISO;
    return v;
  });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    setValues((v) => {
      const next = { ...v };
      for (const p of entry.params) if (p.type === 'date') next[p.name] = dateISO;
      return next;
    });
  }, [dateISO, entry.params]);

  const run = async (refresh = false) => {
    if (entry.kind === 'write' && !window.confirm(`Send ${entry.name} to Garmin? This changes your Garmin Connect data.`)) return;
    setBusy(true);
    const params = {};
    for (const p of entry.params) if (values[p.name] !== undefined && values[p.name] !== '') params[p.name] = values[p.name];
    try {
      const out = entry.kind === 'write' ? await postGarmin(entry.name, params) : await callGarmin(entry.name, params, { refresh });
      setResult(out);
      setShowJson(true);
    } catch (err) {
      setResult({ ok: false, error: err.message || String(err) });
    }
    setBusy(false);
  };

  const unsupported = entry.kind === 'unsupported';
  const summary = result ? (result.ok
    ? `ok${result.cached ? ' (cached)' : ''}${Array.isArray(result.data) ? `, ${result.data.length} items` : ''}`
    : `error: ${result.error}`) : null;

  return (
    <div style={{ padding: '6px 0 8px 12px', borderTop: `1px dashed ${COLORS.faint}`, fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <code style={{ fontSize: 12, color: unsupported ? COLORS.faint : COLORS.ink }}>{entry.name}</code>
        <span style={kindPill(entry.kind)}>{entry.kind === 'read' ? 'GET' : entry.kind === 'write' ? 'POST' : 'N/A'}</span>
        {!unsupported ? (
          <>
            <button disabled={busy} onClick={() => run(false)} style={outlineButton(COLORS.ink, { small: true, disabled: busy })}>{busy ? '...' : (entry.kind === 'write' ? 'Send' : 'Fetch')}</button>
            {entry.kind === 'read' ? <button disabled={busy} onClick={() => run(true)} title="Bypass the cache" style={outlineButton(COLORS.muted, { small: true, disabled: busy })}>Refresh</button> : null}
          </>
        ) : null}
        {summary ? (
          <button type="button" onClick={() => setShowJson((s) => !s)} style={{ border: 'none', background: 'transparent', color: result.ok ? COLORS.done : COLORS.danger, fontSize: 11, padding: 0 }}>
            {summary} {showJson ? '▾' : '▸'}
          </button>
        ) : null}
      </div>
      {entry.params.length ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {entry.params.map((p) => (
            <label key={p.name} style={{ display: 'flex', flexDirection: 'column', fontSize: 10, color: COLORS.muted }}>
              <span>{p.name}{p.required ? ' *' : ''} <span style={{ color: COLORS.faint }}>{p.type}</span></span>
              <input
                type={p.type === 'date' ? 'date' : 'text'}
                value={values[p.name] || ''}
                onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
                disabled={unsupported}
                style={inputStyle}
              />
            </label>
          ))}
        </div>
      ) : null}
      {showJson && result ? (
        <pre style={{ margin: '6px 0 0 0', padding: 8, background: 'white', border: `1px solid ${COLORS.hairline}`, fontSize: 11, maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {JSON.stringify(result.data !== undefined ? result.data : result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
