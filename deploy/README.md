# Deploying the Planner to RT100

RT100 = Rocky Linux 9 box at `70.42.223.139` (`ssh gamelkin@70.42.223.139`), already
running the Real Estate Analyzer (`rea-api` on pm2 / port 5001, nginx `rea.conf` on
port 80). The Planner is deployed **alongside** it, fully isolated:

- UI (primary): `https://70-42-223-139.sslip.io/`  (nginx + Let's Encrypt, port 443)
- UI (fallback): `http://70.42.223.139:8080/`       (raw-IP, no TLS)
- API: nginx proxies `/api/` -> `127.0.0.1:5002` (backend stays internal)
- Backend: pm2 process `planner-backend`, port 5002

`70-42-223-139.sslip.io` is a free wildcard-DNS hostname (sslip.io) that resolves to the
IP with no signup. It exists so Google OAuth has a real HTTPS host to redirect to (Google
rejects raw-IP / plain-HTTP redirect URIs).

## Day-to-day redeploy (source-only)

The Mac repo (`~/Documents/Planner`, git) is the source of truth. The server checkout at
`~/apps/planner` is a plain copy with no git. **Never rsync the whole tree**: the server's
`backend/.env` (live HTTPS/OAuth config and Garmin credentials), `backend/planner.db` (real
data) and `backend/garmin-state/` (Garmin session) must never be overwritten by the Mac
copies. Push only the files you changed.

```bash
# 1. Mac: push the changed source files (and delete removed ones by name)
bash deploy/push.sh backend/server.js frontend/src/pages/DailyView.jsx
bash deploy/push.sh --delete frontend/src/components/Old.jsx

# 2. Server: install deps only when a package.json changed
ssh gamelkin@70.42.223.139 'cd ~/apps/planner/backend  && npm ci --omit=dev'
ssh gamelkin@70.42.223.139 'cd ~/apps/planner/frontend && npm ci'

# 3. Server: build the frontend and publish it (web root is user-owned, no sudo,
#    no nginx reload; rsync INTO the existing dir so SELinux context is inherited)
ssh gamelkin@70.42.223.139 '
  cd ~/apps/planner/frontend && REACT_APP_API_URL=/api npm run build \
  && rsync -a --delete build/ /var/www/planner/build/
'

# 4. Server: restart the backend (only if backend files changed) and smoke-test
ssh gamelkin@70.42.223.139 'pm2 restart planner-backend && bash ~/apps/planner/backend/scripts/smoke.sh'

# 5. Verify the live bundle changed
curl -s https://70-42-223-139.sslip.io/index.html | grep -o 'main\.[a-z0-9]*\.js'
```

Rollback = `git checkout <previous commit> -- <files>` on the Mac, then the same push.

## First-time install

Steps 3 to 6 below were run once on 2026-06-20 and do not need repeating. They are kept
for rebuilding the box from scratch. Copy the source with `deploy/push.sh` (or a
`rsync --exclude` list that excludes `backend/.env` and `backend/planner.db*`), then create
`backend/.env` on the server by hand from `backend/.env.example`.

```bash
# 0. (first time) SSH key
ssh-copy-id gamelkin@70.42.223.139

# 3. Install + build on the server (Node 20)
ssh gamelkin@70.42.223.139 '
  cd ~/apps/planner/backend  && npm install --omit=dev
  cd ~/apps/planner/frontend && npm install && REACT_APP_API_URL=/api npm run build
'

# 4. Backend env (server values):
#    backend/.env -> FRONTEND_URL=https://70-42-223-139.sslip.io
#                    BACKEND_URL=https://70-42-223-139.sslip.io
#                    GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET = the Personal Planner client

# 5. Publish build + nginx + pm2 + firewall (sudo; needs an interactive password)
ssh gamelkin@70.42.223.139 '
  sudo mkdir -p /var/www/planner/build && sudo chown -R gamelkin:gamelkin /var/www/planner
  rsync -a ~/apps/planner/frontend/build/ /var/www/planner/build/
  sudo restorecon -Rv /var/www/planner
  sudo cp ~/apps/planner/deploy/nginx-planner.conf /etc/nginx/conf.d/planner.conf
  sudo nginx -t && sudo systemctl reload nginx
  sudo firewall-cmd --permanent --add-port=8080/tcp && sudo firewall-cmd --reload
  pm2 start ~/apps/planner/deploy/ecosystem.config.js || pm2 restart planner-backend
  pm2 save
'

# 6. HTTPS (one-time; certbot edits planner.conf to add listen 443 + 80->443 redirect)
ssh gamelkin@70.42.223.139 '
  sudo dnf install -y epel-release && sudo dnf install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d 70-42-223-139.sslip.io --non-interactive --agree-tos \
       -m gideonamelkin@gmail.com --redirect
  sudo systemctl enable --now certbot-renew.timer
'
```

Ports 80/443 are already open in firewalld; only 8080 needed adding. Auto-renewal runs via
`certbot-renew.timer` (verify with `sudo certbot renew --dry-run` - note it inserts a random
delay of up to ~8 min on non-interactive runs, so give it time).

## Garmin Connect (Garmin tab)

One-time, done 2026-09-26. No sudo: `uv` lives in `~/.local/bin` and downloads its own
Python 3.12 (`garminconnect` needs 3.12; the box only ships 3.9).

```bash
ssh gamelkin@70.42.223.139 '
  curl -LsSf https://astral.sh/uv/install.sh | sh
  cd ~/apps/planner/backend/garmin
  ~/.local/bin/uv venv --python 3.12 .venv
  ~/.local/bin/uv pip install --python .venv/bin/python -r requirements.txt
  mkdir -p ~/apps/planner/backend/garmin-state && chmod 700 ~/apps/planner/backend/garmin-state
'
# backend/.env on the server: GARMIN_EMAIL=... GARMIN_PASSWORD=...  then chmod 600 backend/.env
ssh gamelkin@70.42.223.139 'pm2 restart planner-backend --update-env'
```

Then open Settings in the app and click **Sign in** under Garmin Connect (enter the
verification code if Garmin sends one). The token file refreshes itself afterwards; the
password is only used again if Garmin revokes the session. Fallback when uv cannot fetch a
Python: run `sudo dnf install -y python3.12` in Terminal.app, then
`python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt` in `backend/garmin`.

Upgrading the client: bump `backend/garmin/requirements.txt`, push it, rerun the `uv pip
install` line, restart the backend. If sign-in starts failing with a Cloudflare 429 or an
auth error after Garmin changes something, check the `python-garminconnect` project for a
release before touching the bridge.

Quick checks on the box:

```bash
cd ~/apps/planner/backend/garmin && .venv/bin/python bridge.py status
curl -s http://127.0.0.1:5002/api/garmin/status
curl -s "http://127.0.0.1:5002/api/garmin/get_user_summary?cdate=$(date +%F)" | head -c 300
```

## OAuth (calendar sync)

The Google client lives in its own dedicated `Personal Planner` Google Cloud project
(project number `684800270191`), separate from the Real Estate project. Authorized redirect
URI (Google Auth Platform -> Clients -> Personal Planner):

- Google: `https://70-42-223-139.sslip.io/api/calendar/google/callback`
- Outlook (optional, Azure): `https://70-42-223-139.sslip.io/api/calendar/outlook/callback`

Also required in the Google project: **Data Access** scopes `calendar.readonly` +
`userinfo.email`, and **Audience** in Testing with your account added as a Test user.
Test-mode refresh tokens expire ~weekly, so expect to re-click Connect Google periodically.

## Rollback (zero impact on rea)

```bash
ssh gamelkin@70.42.223.139 '
  sudo certbot delete --cert-name 70-42-223-139.sslip.io --non-interactive
  sudo rm /etc/nginx/conf.d/planner.conf && sudo systemctl reload nginx
  pm2 delete planner-backend && pm2 save
  sudo firewall-cmd --permanent --remove-port=8080/tcp && sudo firewall-cmd --reload
'
```
