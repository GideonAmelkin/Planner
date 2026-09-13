// External calendars. Each provider implements the same small interface and
// the rest of the file (account storage, token refresh, per-day event fetch)
// is provider-agnostic.
//
//   configured()            true when the OAuth client credentials are in .env
//   authUrl()               where to send the browser to start consent
//   exchangeCode(code)      -> { email, name, access_token, refresh_token, expires_at }
//   refresh(account)        -> { access_token, refresh_token?, expires_at }
//   fetchEvents(account, dateISO, accessToken) -> normalized event list
const fetch = require('node-fetch');
const { google } = require('googleapis');
const { all, run } = require('./db');
const { toLocalDateTime, dayWindow } = require('./lib/dates');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5002';

// Refresh when the access token has less than this long left.
const REFRESH_MARGIN_MS = 60 * 1000;
// Microsoft omits expires_in on some responses; assume the standard hour.
const DEFAULT_TOKEN_TTL_S = 3600;
const MAX_EVENTS_PER_DAY = 200;

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];
const MS_SCOPES = ['Calendars.Read', 'User.Read', 'offline_access'];
const MS_AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const MS_GRAPH = 'https://graph.microsoft.com/v1.0';

// Google ---------------------------------------------------------------------

function googleClient() {
  if (!providers.google.configured()) throw new Error('Google OAuth not configured');
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${BACKEND_URL}/api/calendar/google/callback`
  );
}

const googleProvider = {
  configured: () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),

  authUrl: () => googleClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
  }),

  async exchangeCode(code) {
    const oauth2 = googleClient();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);
    let email = null;
    let name = null;
    try {
      const me = await google.oauth2({ version: 'v2', auth: oauth2 }).userinfo.get();
      email = me.data.email || null;
      name = me.data.name || null;
    } catch (_) { /* profile is optional; the account still works without it */ }
    return {
      email, name,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at: tokens.expiry_date || null,
    };
  },

  async refresh(account) {
    const oauth2 = googleClient();
    oauth2.setCredentials({ refresh_token: account.refresh_token });
    const { credentials } = await oauth2.refreshAccessToken();
    return {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || null,
      expires_at: credentials.expiry_date || null,
    };
  },

  async fetchEvents(account, dateISO, accessToken) {
    const oauth2 = googleClient();
    oauth2.setCredentials({ access_token: accessToken, refresh_token: account.refresh_token });
    const { start, end } = dayWindow(dateISO);
    const res = await google.calendar({ version: 'v3', auth: oauth2 }).events.list({
      calendarId: 'primary',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: MAX_EVENTS_PER_DAY,
    });
    return (res.data.items || []).map((ev) => {
      const allDay = !!(ev.start && ev.start.date);
      return {
        id: `g-${ev.id}`,
        provider: 'google',
        account_id: account.id,
        calendar_email: account.email,
        title: ev.summary || '(no title)',
        location: ev.location || null,
        start_at: allDay ? `${ev.start.date}T00:00` : toLocalDateTime(ev.start.dateTime),
        end_at: allDay ? `${ev.end.date}T00:00` : toLocalDateTime(ev.end.dateTime),
        all_day: allDay,
        organizer: (ev.organizer && (ev.organizer.email || ev.organizer.displayName)) || null,
        link: ev.htmlLink || null,
      };
    });
  },
};

// Microsoft (Outlook) ----------------------------------------------------------

async function msToken(grant) {
  const body = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID,
    client_secret: process.env.MS_CLIENT_SECRET,
    redirect_uri: `${BACKEND_URL}/api/calendar/outlook/callback`,
    scope: MS_SCOPES.join(' '),
    ...grant,
  });
  const res = await fetch(`${MS_AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Microsoft token: ${json.error_description || json.error || res.status}`);
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token || null,
    expires_at: Date.now() + (json.expires_in || DEFAULT_TOKEN_TTL_S) * 1000,
  };
}

const outlookProvider = {
  configured: () => !!(process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET),

  authUrl() {
    if (!this.configured()) throw new Error('Microsoft OAuth not configured');
    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${BACKEND_URL}/api/calendar/outlook/callback`,
      response_mode: 'query',
      scope: MS_SCOPES.join(' '),
      prompt: 'select_account',
    });
    return `${MS_AUTHORITY}/authorize?${params.toString()}`;
  },

  async exchangeCode(code) {
    const t = await msToken({ grant_type: 'authorization_code', code });
    let email = null;
    let name = null;
    try {
      const meRes = await fetch(`${MS_GRAPH}/me`, { headers: { Authorization: `Bearer ${t.access_token}` } });
      if (meRes.ok) {
        const me = await meRes.json();
        email = me.mail || me.userPrincipalName || null;
        name = me.displayName || null;
      }
    } catch (_) { /* profile is optional */ }
    return { email, name, ...t };
  },

  refresh: (account) => msToken({ grant_type: 'refresh_token', refresh_token: account.refresh_token }),

  async fetchEvents(account, dateISO, accessToken) {
    const { start, end } = dayWindow(dateISO);
    const url = new URL(`${MS_GRAPH}/me/calendarView`);
    url.searchParams.set('startDateTime', start.toISOString());
    url.searchParams.set('endDateTime', end.toISOString());
    url.searchParams.set('$orderby', 'start/dateTime');
    url.searchParams.set('$top', String(MAX_EVENTS_PER_DAY));
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: `outlook.timezone="${localTzName()}"`,
      },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Graph ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    return (json.value || []).map((ev) => ({
      id: `o-${ev.id}`,
      provider: 'outlook',
      account_id: account.id,
      calendar_email: account.email,
      title: ev.subject || '(no title)',
      location: (ev.location && ev.location.displayName) || null,
      start_at: toLocalDateTime(ev.start && ev.start.dateTime),
      end_at: toLocalDateTime(ev.end && ev.end.dateTime),
      all_day: !!ev.isAllDay,
      organizer: (ev.organizer && ev.organizer.emailAddress && ev.organizer.emailAddress.name) || null,
      link: ev.webLink || null,
    }));
  },
};

function localTzName() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (_) {
    return 'UTC';
  }
}

const providers = { google: googleProvider, outlook: outlookProvider };

// Provider-agnostic account handling -------------------------------------------

// Finish an OAuth flow: exchange the code and store (or update) the account.
async function connectAccount(provider, code) {
  const p = providers[provider];
  if (!p) throw new Error(`unknown provider ${provider}`);
  const t = await p.exchangeCode(code);
  await run(
    `INSERT INTO calendar_accounts (provider, email, display_name, access_token, refresh_token, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider, email) DO UPDATE SET
       display_name  = excluded.display_name,
       access_token  = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, calendar_accounts.refresh_token),
       expires_at    = excluded.expires_at`,
    [provider, t.email, t.name, t.access_token, t.refresh_token, t.expires_at]
  );
}

// Return a usable access token for the account, refreshing and persisting
// new credentials when the stored token is stale.
async function freshAccessToken(account) {
  const stale = !account.expires_at || account.expires_at < Date.now() + REFRESH_MARGIN_MS;
  if (!stale || !account.refresh_token) return account.access_token;
  const t = await providers[account.provider].refresh(account);
  await run(
    `UPDATE calendar_accounts SET access_token = ?, expires_at = ?,
            refresh_token = COALESCE(?, refresh_token)
      WHERE id = ?`,
    [t.access_token, t.expires_at, t.refresh_token, account.id]
  );
  return t.access_token;
}

async function fetchEventsForAccount(account, dateISO) {
  const p = providers[account.provider];
  if (!p) return [];
  const accessToken = await freshAccessToken(account);
  return p.fetchEvents(account, dateISO, accessToken);
}

// All external events on a day across every connected account. One account's
// failure is reported in `errors` without blocking the others.
async function listEventsForDate(dateISO) {
  const accounts = await all('SELECT * FROM calendar_accounts ORDER BY provider, id');
  if (accounts.length === 0) return { events: [], errors: [] };

  const settled = await Promise.allSettled(accounts.map((acct) => fetchEventsForAccount(acct, dateISO)));
  const events = [];
  const errors = [];
  settled.forEach((r, i) => {
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
  });
  events.sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
  return { events, errors };
}

const listAccounts = () => all(
  'SELECT id, provider, email, display_name, expires_at FROM calendar_accounts ORDER BY provider, id'
);
const disconnectAccount = (id) => run('DELETE FROM calendar_accounts WHERE id = ?', [id]);

module.exports = { providers, connectAccount, listEventsForDate, listAccounts, disconnectAccount };
