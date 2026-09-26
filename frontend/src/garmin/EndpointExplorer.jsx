import React, { useEffect, useMemo, useState } from 'react';
import { getGarminEndpoints, callGarmin, postGarmin } from './api';
import { G, pillButton, outlineButton } from './theme';
import { titleCase } from '../shared/format';

const GROUP_ORDER = ['profile', 'daily', 'sleep', 'heart', 'stress', 'body_battery', 'recovery', 'training', 'activities', 'workouts', 'body', 'hydration', 'nutrition', 'wellness', 'goals_badges', 'devices', 'gear', 'golf', 'system'];

const inputStyle = { border: `1px solid ${G.faint}`, borderRadius: 4, background: 'white', padding: '4px 8px', fontSize: 12, width: 150, maxWidth: '100%', fontFamily: G.font, color: G.text };
const kindPill = (kind) => ({
  fontSize: 9, fontWeight: 600, letterSpacing: 1, padding: '2px 7px', borderRadius: 10,
  color: 'white',
  background: kind === 'read' ? G.green : kind === 'write' ? G.metric.stress : G.faint,
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

  if (error) return <div style={{ color: G.metric.heart, fontSize: 12 }}>{error}</div>;
  if (!endpoints) return <div style={{ color: G.muted, fontSize: 12 }}>Loading endpoints...</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, fontSize: 12, color: G.muted }}>
        <span>{endpoints.length} endpoints mapped from connect.garmin.com. Reads are GET, writes are POST, file transfers are not exposed.</span>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter" style={{ ...inputStyle, width: 140 }} />
      </div>
      {groups.map(([group, list]) => {
        const open = !!openGroups[group];
        return (
          <div key={group} style={{ borderTop: `1px solid ${G.border}` }}>
            <button
              type="button"
              onClick={() => setOpenGroups((o) => ({ ...o, [group]: !o[group] }))}
              style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '10px 0', display: 'flex', justifyContent: 'space-between', color: G.text, fontSize: 13, fontWeight: 400, fontFamily: G.font, cursor: 'pointer' }}
            >
              <span>{titleCase(group)} <span style={{ color: G.muted }}>({list.length})</span></span>
              <span style={{ color: G.blue }}>{open ? '⌃' : '⌄'}</span>
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
    <div style={{ padding: '8px 0 10px 12px', borderTop: `1px solid ${G.border}`, fontSize: 12, background: G.surface2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <code style={{ fontSize: 12, color: unsupported ? G.faint : G.text }}>{entry.name}</code>
        <span style={kindPill(entry.kind)}>{entry.kind === 'read' ? 'GET' : entry.kind === 'write' ? 'POST' : 'N/A'}</span>
        {!unsupported ? (
          <>
            <button disabled={busy} onClick={() => run(false)} style={{ ...pillButton(busy), padding: '2px 12px', fontSize: 11 }}>{busy ? '...' : (entry.kind === 'write' ? 'Send' : 'Fetch')}</button>
            {entry.kind === 'read' ? <button disabled={busy} onClick={() => run(true)} title="Bypass the cache" style={{ ...outlineButton(busy), padding: '1px 10px', fontSize: 11 }}>Refresh</button> : null}
          </>
        ) : null}
        {summary ? (
          <button type="button" onClick={() => setShowJson((s) => !s)} style={{ border: 'none', background: 'transparent', color: result.ok ? G.green : G.metric.heart, fontSize: 11, padding: 0, fontFamily: G.font, cursor: 'pointer' }}>
            {summary} {showJson ? '▾' : '▸'}
          </button>
        ) : null}
      </div>
      {entry.params.length ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {entry.params.map((p) => (
            <label key={p.name} style={{ display: 'flex', flexDirection: 'column', fontSize: 10, color: G.muted }}>
              <span>{p.name}{p.required ? ' *' : ''} <span style={{ color: G.faint }}>{p.type}</span></span>
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
        <pre style={{ margin: '8px 12px 0 0', padding: 10, background: 'white', border: `1px solid ${G.border}`, borderRadius: 4, fontSize: 11, maxHeight: 320, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {JSON.stringify(result.data !== undefined ? result.data : result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
