# Calendar Connection Setup

The Planner pulls events from Google Calendar and Outlook (any account type — personal `outlook.com` / `hotmail.com`, or Microsoft 365 work / school) and shows them alongside manual appointments on the daily view.

This is a one-time setup. The provider buttons in **Settings** stay disabled until you fill in the credentials below.

---

## Google Calendar

1. Go to https://console.cloud.google.com → create a project (or pick an existing one).
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - App name: anything (e.g. "Personal Planner")
   - User support email: your email
   - Developer contact: your email
   - Add scopes: `.../auth/calendar.readonly` and `.../auth/userinfo.email`
   - **Test users**: add your own Google account email
   - Save (no need to publish — test mode is fine for personal use)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: "Personal Planner"
   - Authorized redirect URI: `http://localhost:5002/api/calendar/google/callback`
   - Create
5. Copy the **Client ID** and **Client secret** values.
6. Open `~/Documents/Planner/backend/.env` and set:
   ```
   GOOGLE_CLIENT_ID=<paste client id>
   GOOGLE_CLIENT_SECRET=<paste client secret>
   ```
7. Restart the backend: `bash ~/Documents/Planner/stop.sh && bash ~/Documents/Planner/start.sh`
8. In the app: **Settings → + Connect Google** → consent → you'll be returned to the planner with the Google calendar connected.

> **Heads-up:** while the OAuth consent screen is in "Testing" mode, refresh tokens issued to test users expire after **7 days**. You'll be prompted to reconnect once a week. To skip that, you can submit the app for verification (more steps), but for personal use the weekly reconnect is usually fine.

---

## Microsoft (Outlook / Microsoft 365)

1. Go to https://portal.azure.com → **Microsoft Entra ID** (formerly Azure AD).
2. **App registrations → New registration**:
   - Name: "Personal Planner"
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (the "common" tenant — accepts work, school, and `outlook.com`)
   - Redirect URI: select **Web**, then enter `http://localhost:5002/api/calendar/outlook/callback`
   - Register
3. On the new app's overview page, copy the **Application (client) ID**.
4. **Certificates & secrets → Client secrets → New client secret**:
   - Description: "planner"
   - Expires: 24 months (or longer if your tenant allows)
   - Add — then **immediately copy the Value column** (you can't see it again later).
5. **API permissions → Add a permission → Microsoft Graph → Delegated permissions**:
   - `Calendars.Read`
   - `User.Read`
   - `offline_access`
   - Add. (No admin consent needed for personal accounts; for work tenants the first sign-in will prompt.)
6. Open `~/Documents/Planner/backend/.env` and set:
   ```
   MS_CLIENT_ID=<paste application (client) id>
   MS_CLIENT_SECRET=<paste secret value from step 4>
   ```
7. Restart the backend.
8. In the app: **Settings → + Connect Outlook** → sign in with whichever account you want → consent → connected.

You can connect multiple accounts of either provider (e.g. one personal Gmail + one work Microsoft 365). Each shows up as its own row in Settings, with its own colored events on the timeline.

---

## What you'll see after connecting

- The **Appointment Schedule** section becomes a vertical timeline (7 AM – 8 PM, 60px/hour).
- Events render as colored blocks at their actual start time, sized to their duration:
  - **Blue** stripe — Google
  - **Teal** stripe — Outlook
  - **Cream/black** stripe — manual appointments you typed into the planner
- Overlapping events split into side-by-side columns within the same time band.
- All-day events render as small pills above the timeline (not in the time grid).
- Click any external event block → opens it in Google Calendar / Outlook in a new tab.
- Click an empty area on the timeline → inline "Add appointment" form (manual appointments only). Click a manual block to edit or delete it.

External events are read-only from the planner. Edits, creations, and deletions happen in the source apps.

---

## Disconnecting

**Settings → Disconnect** next to any account. The app removes the stored tokens; events from that account stop appearing immediately.

If a token goes bad (e.g. you changed your password) you'll see a red banner above the timeline pointing you back to **Settings** to reconnect.
