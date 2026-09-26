import React, { useEffect, useState } from 'react';
import { getGarminStatus, garminLogin, garminMfa, garminLogout } from '../services/api';
import { COLORS, outlineButton } from '../styles';

// The Garmin Connect block inside Settings: status, Sign in (with the MFA code
// box when Garmin asks for one), Sign out.
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
      setStatus({ connected: false, configured: false, python_ok: false });
      setMessage({ text: err.message || String(err), error: true });
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
    if (!window.confirm('Sign out of Garmin Connect? The Health tab will stop updating until you sign in again.')) return;
    setBusy(true);
    try { await garminLogout(); setMessage({ text: 'Signed out.', error: false }); } catch (err) { setMessage({ text: err.message || String(err), error: true }); }
    setBusy(false);
    load();
  };

  const connected = !!(status && status.connected);
  const configured = !!(status && status.configured && status.python_ok);
  const name = status && status.profile && status.profile.full_name;

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, letterSpacing: 0.3, color: COLORS.ink }}>Garmin Connect</div>
      {!status ? (
        <div style={{ color: COLORS.muted, fontSize: 13 }}>Loading...</div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap',
          padding: '6px 8px', border: `1px solid ${COLORS.hairline}`, marginBottom: 6, background: 'white',
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              Garmin
              {status.email ? <span style={{ color: COLORS.muted, fontWeight: 400 }}> · {status.email}</span> : null}
            </div>
            <div style={{ fontSize: 11, color: connected ? COLORS.done : COLORS.muted }}>
              {connected ? `Connected${name ? ` as ${name}` : ''}` : (status.signing_in ? 'Sign-in in progress' : 'Not connected')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {connected ? (
              <button disabled={busy} onClick={signOut} style={outlineButton(COLORS.danger, { disabled: busy })}>Sign out</button>
            ) : (
              <button
                disabled={busy || !configured || needsMfa}
                onClick={signIn}
                title={configured ? '' : 'GARMIN_EMAIL / GARMIN_PASSWORD not set in backend/.env, or the Python client is not installed'}
                style={outlineButton(COLORS.garmin, { disabled: busy || !configured || needsMfa })}>
                {busy ? 'Signing in...' : 'Sign in'}
              </button>
            )}
          </div>
        </div>
      )}

      {needsMfa ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={(e) => { if (e.key === 'Enter') submitCode(); }}
            placeholder="Verification code"
            inputMode="numeric"
            autoFocus
            style={{ border: `1px solid ${COLORS.hairline}`, padding: '5px 8px', fontSize: 13, width: 160, background: 'white' }}
          />
          <button disabled={busy || !code} onClick={submitCode} style={outlineButton(COLORS.garmin, { disabled: busy || !code })}>Verify</button>
        </div>
      ) : null}

      {message ? (
        <div style={{ fontSize: 12, color: message.error ? COLORS.danger : COLORS.muted, marginBottom: 6 }}>{message.text}</div>
      ) : null}

      {status && !configured ? (
        <div style={{ marginTop: 8, padding: 10, background: '#FFF8E1', border: '1px solid #E0D5B5', fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>
          <strong>Setup required.</strong>{' '}
          {!status.configured ? <>Add <code>GARMIN_EMAIL</code> and <code>GARMIN_PASSWORD</code> to <code>backend/.env</code> on the server. </> : null}
          {!status.python_ok ? <>The Python client is missing; see the Garmin section of <code>deploy/README.md</code>.</> : null}
        </div>
      ) : null}
    </div>
  );
}
