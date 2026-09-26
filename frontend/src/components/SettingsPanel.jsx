import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCalendarAccounts, disconnectCalendarAccount, API_BASE } from '../services/api';
import GarminSettings from './GarminSettings';
import { COLORS, modalBackdrop, modalCard, modalClose, modalTitle, outlineButton, sectionDot, sectionHeader } from '../styles';

const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', background: COLORS.page, borderRadius: 8, marginBottom: 6 };
const noticeStyle = { marginTop: 12, padding: '10px 12px', background: COLORS.page, borderRadius: 8, fontSize: 12, color: COLORS.muted, lineHeight: 1.5 };

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

        <div style={{ ...sectionHeader, display: 'flex', alignItems: 'center' }}>
          <span style={sectionDot(COLORS.google)} />
          Connected Calendars
        </div>
        {error ? <div style={{ color: COLORS.danger, fontSize: 12, marginBottom: 8 }}>{error}</div> : null}

        {loading ? (
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Loading...</div>
        ) : data.accounts.length === 0 ? (
          <div style={{ color: COLORS.muted, fontSize: 13, marginBottom: 12 }}>
            No calendars connected. External events won't appear in the daily view until you connect one.
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {data.accounts.map((acct) => (
              <div key={acct.id} style={rowStyle}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {PROVIDER_NAMES[acct.provider] || acct.provider}
                    {acct.email ? <span style={{ color: COLORS.muted, fontWeight: 400 }}> · {acct.email}</span> : null}
                  </div>
                  {acct.display_name ? <div style={{ fontSize: 12, color: COLORS.muted }}>{acct.display_name}</div> : null}
                </div>
                <button onClick={() => disconnect(acct.id)} style={outlineButton(COLORS.danger)}>Disconnect</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
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
          <div style={noticeStyle}>
            <strong>Setup required.</strong>{' '}
            Some providers are disabled because their OAuth credentials aren't in <code>backend/.env</code> yet. See <code>~/Documents/Planner/CALENDAR_SETUP.md</code> for the one-time app-registration steps for{' '}
            {!data.providers.google ? <strong>Google</strong> : null}
            {(!data.providers.google && !data.providers.outlook) ? ' and ' : ''}
            {!data.providers.outlook ? <strong>Microsoft</strong> : null}.
          </div>
        ) : null}

        <GarminSettings />
      </div>
    </div>,
    document.body
  );
}

