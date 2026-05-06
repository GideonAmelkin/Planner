import React, { useEffect, useState } from 'react';
import { getCalendarAccounts, disconnectCalendarAccount, API_BASE } from '../services/api';

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
    window.location.href = `${API_BASE.replace('/api', '')}/api/calendar/${provider === 'google' ? 'google' : 'outlook'}/connect`;
  };

  const disconnect = async (id) => {
    if (!window.confirm('Disconnect this calendar?')) return;
    await disconnectCalendarAccount(id);
    await load();
  };

  return (
    <div style={{
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
          width: 520,
          background: '#FBF6E7',
          border: '1px solid #2D3436',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="serif" style={{ fontSize: 20, fontWeight: 500, color: '#2D3436' }}>Settings</div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: '#2D3436' }}>×</button>
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, letterSpacing: 0.3, color: '#2D3436' }}>Connected Calendars</div>
        {error ? <div style={{ color: '#C62828', fontSize: 12, marginBottom: 8 }}>{error}</div> : null}

        {loading ? (
          <div style={{ color: '#6B5B40', fontSize: 13 }}>Loading…</div>
        ) : data.accounts.length === 0 ? (
          <div style={{ color: '#6B5B40', fontSize: 13, fontStyle: 'italic', marginBottom: 12 }}>
            No calendars connected. External events won't appear in the daily view until you connect one.
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {data.accounts.map((acct) => (
              <div key={acct.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 8px', border: '1px solid #C9BB9A', marginBottom: 6,
                background: 'white',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {PROVIDER_NAMES[acct.provider] || acct.provider}
                    {acct.email ? <span style={{ color: '#6B5B40', fontWeight: 400 }}> · {acct.email}</span> : null}
                  </div>
                  {acct.display_name ? <div style={{ fontSize: 11, color: '#6B5B40' }}>{acct.display_name}</div> : null}
                </div>
                <button onClick={() => disconnect(acct.id)} style={btnStyle('#C62828')}>Disconnect</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            disabled={!data.providers.google}
            onClick={() => connect('google')}
            title={data.providers.google ? '' : 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set in backend/.env'}
            style={btnStyle('#1565C0', !data.providers.google)}>
            + Connect Google
          </button>
          <button
            disabled={!data.providers.outlook}
            onClick={() => connect('outlook')}
            title={data.providers.outlook ? '' : 'MS_CLIENT_ID / MS_CLIENT_SECRET not set in backend/.env'}
            style={btnStyle('#00695C', !data.providers.outlook)}>
            + Connect Outlook
          </button>
        </div>

        {(!data.providers.google || !data.providers.outlook) ? (
          <div style={{ marginTop: 14, padding: 10, background: '#FFF8E1', border: '1px solid #E0D5B5', fontSize: 11, color: '#6B5B40', lineHeight: 1.5 }}>
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

function btnStyle(color = '#2D3436', disabled = false) {
  return {
    border: `1px solid ${color}`,
    background: disabled ? '#F0EAD6' : 'white',
    color: disabled ? '#A89368' : color,
    fontSize: 12,
    padding: '5px 12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 2,
    fontWeight: 600,
    letterSpacing: 0.3,
  };
}
