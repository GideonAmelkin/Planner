import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCalendarAccounts, disconnectCalendarAccount, getDay, getWorkoutStatus, API_BASE } from '../services/api';
import { todayISO } from '../utils/dayInfo';
import ConnectionRow from './ConnectionRow';
import GarminSettings from './GarminSettings';
import { COLORS, modalBackdrop, modalCard, modalClose, modalTitle, outlineButton, pill, sectionHeader } from '../styles';

const PROVIDERS = [
  { key: 'google', name: 'Google', color: COLORS.google, hint: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set in backend/.env' },
  { key: 'outlook', name: 'Outlook', color: COLORS.outlook, hint: 'MS_CLIENT_ID / MS_CLIENT_SECRET not set in backend/.env' },
];
const noticeStyle = { marginTop: 12, padding: '10px 12px', background: COLORS.page, borderRadius: 8, fontSize: 12, color: COLORS.muted, lineHeight: 1.5 };
const FRESH_MS = 48 * 60 * 60 * 1000;

function relative(iso) {
  const t = Date.parse(iso);
  if (!t) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

// The Home Workouts snapshot the Mac ships every 6 hours: nothing to click here.
function WorkoutConnection() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    getWorkoutStatus()
      .then(setStatus)
      .catch((err) => setStatus({ available: false, error: err.message || String(err) }));
  }, []);
  if (!status) return <ConnectionRow status="off" name="Home Workouts" detail="Loading..." />;
  const receivedAt = status.received_at ? Date.parse(status.received_at) : null;
  const fresh = status.available && receivedAt && Date.now() - receivedAt < FRESH_MS;
  const detail = status.available
    ? `Synced ${relative(status.received_at)}${fresh ? '' : ', the Mac has not synced in two days'}`
    : 'No snapshot on the server yet';
  return (
    <ConnectionRow status={fresh ? 'ok' : 'error'} name="Home Workouts" detail={detail} detailColor={fresh ? undefined : COLORS.danger}>
      <span style={pill} title="The Mac exports the Home Workouts app and ships one snapshot every 6 hours">Mac sync</span>
    </ConnectionRow>
  );
}

export default function SettingsPanel({ onClose }) {
  const [data, setData] = useState({ accounts: [], providers: { google: false, outlook: false } });
  const [errorsByAccount, setErrorsByAccount] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [d, day] = await Promise.all([
        getCalendarAccounts(),
        getDay(todayISO()).catch(() => null),
      ]);
      setData(d);
      const map = {};
      for (const e of (day && day.calendar_errors) || []) map[e.account_id] = e.message;
      setErrorsByAccount(map);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const connect = (provider) => {
    // API_BASE ends in /api; the OAuth entry points live under it.
    window.location.href = `${API_BASE}/calendar/${provider}/connect`;
  };

  const disconnect = async (id) => {
    if (!window.confirm('Disconnect this calendar?')) return;
    await disconnectCalendarAccount(id);
    await load();
  };

  const withAccounts = PROVIDERS.filter((p) => data.accounts.some((a) => a.provider === p.key));

  // Rendered into document.body so the sticky rail's stacking context cannot trap the backdrop.
  return createPortal(
    <div style={modalBackdrop} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...modalCard, width: 560, maxWidth: '92vw' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={modalTitle}>Settings</div>
          <button onClick={onClose} style={modalClose}>×</button>
        </div>

        <div style={sectionHeader}>Connections</div>
        {error ? <div style={{ color: COLORS.danger, fontSize: 12, marginBottom: 8 }}>{error}</div> : null}

        {loading ? (
          <ConnectionRow status="off" name="Calendars" detail="Loading..." />
        ) : PROVIDERS.map((p) => {
          const accounts = data.accounts.filter((a) => a.provider === p.key);
          const enabled = !!data.providers[p.key];
          if (accounts.length === 0) {
            return (
              <ConnectionRow key={p.key} status="off" name={p.name} detail={enabled ? 'Not connected' : 'Not configured'}>
                <button
                  disabled={!enabled}
                  onClick={() => connect(p.key)}
                  title={enabled ? '' : p.hint}
                  style={outlineButton(p.color, { disabled: !enabled })}>
                  Connect
                </button>
              </ConnectionRow>
            );
          }
          return accounts.map((acct) => {
            const failure = errorsByAccount[acct.id];
            return (
              <ConnectionRow
                key={`${p.key}-${acct.id}`}
                status={failure ? 'error' : 'ok'}
                name={<>{p.name}{acct.email ? <span style={{ color: COLORS.muted, fontWeight: 400 }}> · {acct.email}</span> : null}</>}
                detail={failure || acct.display_name || 'Connected'}
                detailColor={failure ? COLORS.danger : undefined}
              >
                <button onClick={() => disconnect(acct.id)} style={outlineButton(COLORS.danger)}>Disconnect</button>
              </ConnectionRow>
            );
          });
        })}

        <GarminSettings />
        <WorkoutConnection />

        {!loading && withAccounts.length > 0 ? (
          <div style={{ fontSize: 12, color: COLORS.muted, margin: '6px 4px 0' }}>
            Connect another:{' '}
            {withAccounts.map((p, i) => (
              <React.Fragment key={p.key}>
                {i > 0 ? ' · ' : ''}
                <button
                  type="button"
                  onClick={() => connect(p.key)}
                  style={{ border: 'none', background: 'transparent', padding: 0, color: p.color, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {p.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        ) : null}

        {(!data.providers.google || !data.providers.outlook) ? (
          <div style={noticeStyle}>
            <strong>Setup required.</strong>{' '}
            Some providers are disabled because their OAuth credentials aren't in <code>backend/.env</code> yet. See <code>~/Documents/Planner/CALENDAR_SETUP.md</code> for the one-time app-registration steps for{' '}
            {!data.providers.google ? <strong>Google</strong> : null}
            {(!data.providers.google && !data.providers.outlook) ? ' and ' : ''}
            {!data.providers.outlook ? <strong>Microsoft</strong> : null}.
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
