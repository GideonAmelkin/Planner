// Calendar accounts and the OAuth connect/callback pair for each provider.
// The callback paths are registered with Google and Microsoft; do not rename.
const { Router } = require('express');
const { providers, connectAccount, listAccounts, disconnectAccount } = require('../calendarService');
const { asyncHandler, idParam } = require('../lib/http');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const ENV_HINT = {
  google: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.',
  outlook: 'Set MS_CLIENT_ID and MS_CLIENT_SECRET in backend/.env.',
};

const router = Router();

router.get('/calendar/accounts', asyncHandler(async (req, res) => {
  const configured = {};
  for (const [name, p] of Object.entries(providers)) configured[name] = p.configured();
  res.json({ accounts: await listAccounts(), providers: configured });
}));

router.delete('/calendar/accounts/:id', asyncHandler(async (req, res) => {
  const id = idParam(req);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  await disconnectAccount(id);
  res.json({ ok: true });
}));

const toFrontend = (res, query) => res.redirect(`${FRONTEND_URL}/?${query}`);

for (const [name, p] of Object.entries(providers)) {
  router.get(`/calendar/${name}/connect`, (req, res) => {
    if (!p.configured()) {
      return res.status(400).json({ error: `${name} OAuth not configured. ${ENV_HINT[name]}` });
    }
    res.redirect(p.authUrl());
  });

  router.get(`/calendar/${name}/callback`, async (req, res) => {
    const { code, error } = req.query;
    if (error) return toFrontend(res, `calendar_error=${encodeURIComponent(error)}`);
    if (!code) return res.status(400).json({ error: 'Missing code' });
    try {
      await connectAccount(name, String(code));
      toFrontend(res, `connected=${name}`);
    } catch (err) {
      console.error(`${name} callback error:`, err);
      toFrontend(res, `calendar_error=${encodeURIComponent(err.message || `${name}_auth_failed`)}`);
    }
  });
}

module.exports = router;
