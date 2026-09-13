import React, { useEffect, useState } from 'react';
import { getCalendarAccounts, disconnectCalendarAccount, API_BASE } from '../services/api';
import { COLORS, modalBackdrop, modalCard, modalClose, modalTitle, outlineButton } from '../styles';

const PROVIDER_NAMES = { google: 'Google', outlook: 'Outlook' };

export default function SettingsPanel({ onClose }) {
  const [data, setData] = useState({ accounts: [], providers: { google: false, outlook: false } });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await getCalendarAccounts();
      setData(d);
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

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...modalCard, width: 520 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="serif" style={modalTitle}>Settings</div>
          <button onClick={onClose} style={modalClose}>×</button>
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, letterSpacing: 0.3, color: COLORS.ink }}>Connected Calendars</div>
        {error ? <div style={{ color: COLORS.danger, fontSize: 12, marginBottom: 8 }}>{error}</div> : null}

        {loading ? (
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Loading…</div>
        ) : data.accounts.length === 0 ? (
          <div style={{ color: COLORS.muted, fontSize: 13, fontStyle: 'italic', marginBottom: 12 }}>
            No calendars connected. External events won't appear in the daily view until you connect one.
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {data.accounts.map((acct) => (
              <div key={acct.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 8px', border: `1px solid ${COLORS.hairline}`, marginBottom: 6,
                background: 'white',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {PROVIDER_NAMES[acct.provider] || acct.provider}
                    {acct.email ? <span style={{ color: COLORS.muted, fontWeight: 400 }}> · {acct.email}</span> : null}
                  </div>
                  {acct.display_name ? <div style={{ fontSize: 11, color: COLORS.muted }}>{acct.display_name}</div> : null}
                </div>
                <button onClick={() => disconnect(acct.id)} style={outlineButton(COLORS.danger)}>Disconnect</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            disabled={!data.providers.google}
            onClick={() => connect('google')}
            title={data.providers.google ? '' : 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set in backend/.env'}
            style={outlineButton(COLORS.google, { disabled: !data.providers.google })}>
            + Connect Google
          </button>
          <button
            disabled={!data.providers.outlook}
            onClick={() => connect('outlook')}
            title={data.providers.outlook ? '' : 'MS_CLIENT_ID / MS_CLIENT_SECRET not set in backend/.env'}
            style={outlineButton(COLORS.outlook, { disabled: !data.providers.outlook })}>
            + Connect Outlook
          </button>
        </div>

        {(!data.providers.google || !data.providers.outlook) ? (
          <div style={{ marginTop: 14, padding: 10, background: '#FFF8E1', border: '1px solid #E0D5B5', fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>
            <strong>Setup required.</strong>{' '}
            Some providers are disabled because their OAuth credentials aren't in <code>backend/.env</code> yet. See <code>~/Documents/Planner/CALENDAR_SETUP.md</code> for the one-time app-registration steps for{' '}
            {!data.providers.google ? <strong>Google</strong> : null}
            {(!data.providers.google && !data.providers.outlook) ? ' and ' : ''}
            {!data.providers.outlook ? <strong>Microsoft</strong> : null}.
          </div>
        ) : null}
      </div>
    </div>
  );
}

