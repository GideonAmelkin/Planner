const fetch = require('node-fetch');
const { google } = require('googleapis');
const { all, run } = require('./db');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5002';

const GOOGLE_REDIRECT = `${BACKEND_URL}/api/calendar/google/callback`;
const MS_REDIRECT = `${BACKEND_URL}/api/calendar/outlook/callback`;
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];
const MS_SCOPES = ['Calendars.Read', 'User.Read', 'offline_access'];

function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
function microsoftConfigured() {
  return !!(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
}

function googleClient() {
  if (!googleConfigured()) throw new Error('Google OAuth not configured');
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT
  );
}

function startGoogleAuth() {
  const url = googleClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
  });
  return url;
}

async function finishGoogleAuth(code) {
  const oauth2 = googleClient();
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  let email = null;
  let name = null;
  try {
    const oauthApi = google.oauth2({ version: 'v2', auth: oauth2 });
    const me = await oauthApi.userinfo.get();
    email = me.data.email || null;
    name = me.data.name || null;
  } catch (_) {}
  await run(
    `INSERT INTO calendar_accounts (provider, email, display_name, access_token, refresh_token, expires_at)
     VALUES ('google', ?, ?, ?, ?, ?)
     ON CONFLICT(provider, email) DO UPDATE SET
       display_name  = excluded.display_name,
       access_token  = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, calendar_accounts.refresh_token),
       expires_at    = excluded.expires_at`,
    [email, name, tokens.access_token, tokens.refresh_token || null, tokens.expiry_date || null]
  );
}

function startMicrosoftAuth() {
  if (!microsoftConfigured()) throw new Error('Microsoft OAuth not configured');
  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: MS_REDIRECT,
    response_mode: 'query',
    scope: MS_SCOPES.join(' '),
    prompt: 'select_account',
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

async function exchangeMsCode({ code, refreshToken }) {
  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    redirect_uri: MS_REDIRECT,
    scope: MS_SCOPES.join(' '),
  });
  if (code) {
    body.append('grant_type', 'authorization_code');
    body.append('code', code);
  } else {
    body.append('grant_type', 'refresh_token');
    body.append('refresh_token', refreshToken);
  }
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Microsoft token: ${json.error_description || json.error || res.status}`);
  return json;
}

async function finishMicrosoftAuth(code) {
  const t = await exchangeMsCode({ code });
  const expiresAt = Date.now() + (t.expires_in || 3600) * 1000;
  let email = null;
  let name = null;
  try {
    const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${t.access_token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      email = me.mail || me.userPrincipalName || null;
      name = me.displayName || null;
    }
  } catch (_) {}
  await run(
    `INSERT INTO calendar_accounts (provider, email, display_name, access_token, refresh_token, expires_at)
     VALUES ('outlook', ?, ?, ?, ?, ?)
     ON CONFLICT(provider, email) DO UPDATE SET
       display_name  = excluded.display_name,
       access_token  = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, calendar_accounts.refresh_token),
       expires_at    = excluded.expires_at`,
    [email, name, t.access_token, t.refresh_token || null, expiresAt]
  );
}

async function refreshGoogleIfNeeded(account) {
  const oauth2 = googleClient();
  oauth2.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at,
  });
  const stale = !account.expires_at || account.expires_at < Date.now() + 60_000;
  if (stale && account.refresh_token) {
    const { credentials } = await oauth2.refreshAccessToken();
    await run(
      `UPDATE calendar_accounts SET access_token = ?, expires_at = ?,
              refresh_token = COALESCE(?, refresh_token)
        WHERE id = ?`,
      [credentials.access_token, credentials.expiry_date || null, credentials.refresh_token || null, account.id]
    );
    oauth2.setCredentials(credentials);
  }
  return oauth2;
}

async function refreshMicrosoftIfNeeded(account) {
  const stale = !account.expires_at || account.expires_at < Date.now() + 60_000;
  if (stale && account.refresh_token) {
    const t = await exchangeMsCode({ refreshToken: account.refresh_token });
    const expiresAt = Date.now() + (t.expires_in || 3600) * 1000;
    await run(
      `UPDATE calendar_accounts SET access_token = ?, expires_at = ?,
              refresh_token = COALESCE(?, refresh_token)
        WHERE id = ?`,
      [t.access_token, expiresAt, t.refresh_token || null, account.id]
    );
    return t.access_token;
  }
  return account.access_token;
}

function localTzName() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (_) {
    return 'UTC';
  }
}

function toLocalIso(dt) {
  if (!dt) return null;
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dayWindow(dateISO) {
  // Build local-day boundaries in this server's TZ.
  const [y, m, d] = dateISO.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0);
  return { start, end };
}

async function fetchGoogleEventsForDate(account, dateISO) {
  const oauth2 = await refreshGoogleIfNeeded(account);
  const cal = google.calendar({ version: 'v3', auth: oauth2 });
  const { start, end } = dayWindow(dateISO);
  const res = await cal.events.list({
    calendarId: 'primary',
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 200,
  });
  const items = res.data.items || [];
  return items.map((ev) => {
    const allDay = !!(ev.start && ev.start.date);
    const startAt = allDay ? `${ev.start.date}T00:00` : toLocalIso(ev.start.dateTime);
    const endAt = allDay ? `${ev.end.date}T00:00` : toLocalIso(ev.end.dateTime);
    return {
      id: `g-${ev.id}`,
      provider: 'google',
      account_id: account.id,
      calendar_email: account.email,
      title: ev.summary || '(no title)',
      location: ev.location || null,
      start_at: startAt,
      end_at: endAt,
      all_day: allDay,
      organizer: (ev.organizer && (ev.organizer.email || ev.organizer.displayName)) || null,
      link: ev.htmlLink || null,
    };
  });
}

async function fetchMicrosoftEventsForDate(account, dateISO) {
  const accessToken = await refreshMicrosoftIfNeeded(account);
  const { start, end } = dayWindow(dateISO);
  const tz = localTzName();
  const url = new URL('https://graph.microsoft.com/v1.0/me/calendarView');
  url.searchParams.set('startDateTime', start.toISOString());
  url.searchParams.set('endDateTime', end.toISOString());
  url.searchParams.set('$orderby', 'start/dateTime');
  url.searchParams.set('$top', '200');
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: `outlook.timezone="${tz}"`,
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Graph ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const items = json.value || [];
  return items.map((ev) => {
    const allDay = !!ev.isAllDay;
    return {
      id: `o-${ev.id}`,
      provider: 'outlook',
      account_id: account.id,
      calendar_email: account.email,
      title: ev.subject || '(no title)',
      location: (ev.location && ev.location.displayName) || null,
      start_at: toLocalIso(ev.start && ev.start.dateTime),
      end_at: toLocalIso(ev.end && ev.end.dateTime),
      all_day: allDay,
      organizer: (ev.organizer && ev.organizer.emailAddress && ev.organizer.emailAddress.name) || null,
      link: ev.webLink || null,
    };
  });
}

async function listEventsForDate(dateISO) {
  const accounts = await all('SELECT * FROM calendar_accounts ORDER BY provider, id');
  if (accounts.length === 0) return { events: [], errors: [] };

  const settled = await Promise.allSettled(
    accounts.map((acct) => {
      if (acct.provider === 'google') return fetchGoogleEventsForDate(acct, dateISO);
      if (acct.provider === 'outlook') return fetchMicrosoftEventsForDate(acct, dateISO);
      return Promise.resolve([]);
    })
  );

  const events = [];
  const errors = [];
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    const acct = accounts[i];
    if (r.status === 'fulfilled') {
      events.push(...r.value);
    } else {
      errors.push({
        account_id: acct.id,
        provider: acct.provider,
        email: acct.email,
        message: (r.reason && r.reason.message) || String(r.reason),
      });
    }
  }
  events.sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
  return { events, errors };
}

async function listAccounts() {
  return all(
    `SELECT id, provider, email, display_name, expires_at FROM calendar_accounts ORDER BY provider, id`
  );
}

async function disconnectAccount(id) {
  return run('DELETE FROM calendar_accounts WHERE id = ?', [id]);
}

module.exports = {
  googleConfigured,
  microsoftConfigured,
  startGoogleAuth,
  finishGoogleAuth,
  startMicrosoftAuth,
  finishMicrosoftAuth,
  listEventsForDate,
  listAccounts,
  disconnectAccount,
};
