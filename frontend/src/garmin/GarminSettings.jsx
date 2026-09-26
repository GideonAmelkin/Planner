import React, { useEffect, useState } from 'react';
import { getGarminStatus, garminLogin, garminMfa, garminLogout } from './api';
import ConnectionRow from '../shared/ConnectionRow';
import { COLORS, outlineButton } from '../shared/styles';

const noticeStyle = { marginTop: 6, marginBottom: 6, padding: '10px 12px', background: COLORS.page, borderRadius: 8, fontSize: 12, color: COLORS.muted, lineHeight: 1.5 };

// The Garmin row in Settings > Connections: status dot, Sign In / Sign Out,
// the MFA code box when Garmin asks for one, and the setup notice.
export default function GarminSettings() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState(null);   // { text, error }

  const load = async () => {
    try {
      const s = await getGarminStatus();
      setStatus(s);
      setNeedsMfa(!!s.needs_mfa);
    } catch (err) {
      setStatus({ connected: false, configured: false, python_ok: false, error: err.message || String(err) });
    }
  };

  useEffect(() => { load(); }, []);

  const finish = (out) => {
    if (out.ok) {
      setNeedsMfa(false);
      setCode('');
      setMessage({ text: `Signed in as ${out.profile && out.profile.full_name ? out.profile.full_name : 'Garmin user'}.`, error: false });
    } else if (out.needs_mfa) {
      setNeedsMfa(true);
      setMessage({ text: 'Garmin sent a verification code. Enter it below.', error: false });
    } else {
      setMessage({ text: out.error || 'Sign-in failed.', error: true });
    }
  };

  const signIn = async () => {
    setBusy(true);
    setMessage({ text: 'Signing in to Garmin Connect (this can take up to a minute)...', error: false });
    try { finish(await garminLogin()); } catch (err) { setMessage({ text: err.message || String(err), error: true }); }
    setBusy(false);
    load();
  };

  const submitCode = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try { finish(await garminMfa(code.trim())); } catch (err) { setMessage({ text: err.message || String(err), error: true }); }
    setBusy(false);
    load();
  };

  const signOut = async () => {
    if (!window.confirm('Sign out of Garmin Connect? The Garmin tab will stop updating until you sign in again.')) return;
    setBusy(true);
    try { await garminLogout(); setMessage({ text: 'Signed out.', error: false }); } catch (err) { setMessage({ text: err.message || String(err), error: true }); }
    setBusy(false);
    load();
  };

  if (!status) {
    return <ConnectionRow status="off" name="Garmin" detail="Loading..." />;
  }

  const connected = !!status.connected;
  const configured = !!(status.configured && status.python_ok);
  const name = status.profile && status.profile.full_name;
  const hasError = !!status.error || (configured && status.token_file && !connected && !status.signing_in);

  let dot = 'off';
  let detail = 'Not connected';
  let detailColor;
  if (connected) {
    dot = 'ok';
    detail = `Connected${name ? ` as ${name}` : ''}${status.email ? ` (${status.email})` : ''}`;
  } else if (status.signing_in) {
    detail = 'Sign-in in progress';
  } else if (hasError) {
    dot = 'error';
    detail = status.error || 'Session expired, sign in again';
    detailColor = COLORS.danger;
  } else if (!configured) {
    detail = 'Not configured';
  }

  return (
    <div>
      <ConnectionRow status={dot} name="Garmin" detail={detail} detailColor={detailColor}>
        {connected ? (
          <button disabled={busy} onClick={signOut} style={outlineButton(COLORS.danger, { disabled: busy })}>Sign Out</button>
        ) : (
          <button
            disabled={busy || !configured || needsMfa}
            onClick={signIn}
            title={configured ? '' : 'GARMIN_EMAIL / GARMIN_PASSWORD not set in backend/.env, or the Python client is not installed'}
            style={outlineButton(COLORS.garmin, { disabled: busy || !configured || needsMfa })}>
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        )}
      </ConnectionRow>

      {needsMfa ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '0 0 8px 4px' }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={(e) => { if (e.key === 'Enter') submitCode(); }}
            placeholder="Verification code"
            inputMode="numeric"
            autoFocus
            style={{ border: `1px solid ${COLORS.hairline}`, borderRadius: 8, padding: '6px 10px', fontSize: 13, width: 160, background: COLORS.paper }}
          />
          <button disabled={busy || !code} onClick={submitCode} style={outlineButton(COLORS.garmin, { disabled: busy || !code })}>Verify</button>
        </div>
      ) : null}

      {message ? (
        <div style={{ fontSize: 12, color: message.error ? COLORS.danger : COLORS.muted, margin: '0 0 8px 4px' }}>{message.text}</div>
      ) : null}

      {!configured ? (
        <div style={noticeStyle}>
          <strong>Setup required.</strong>{' '}
          {!status.configured ? <>Add <code>GARMIN_EMAIL</code> and <code>GARMIN_PASSWORD</code> to <code>backend/.env</code> on the server. </> : null}
          {!status.python_ok ? <>The Python client is missing; see the Garmin section of <code>deploy/README.md</code>.</> : null}
        </div>
      ) : null}
    </div>
  );
}
