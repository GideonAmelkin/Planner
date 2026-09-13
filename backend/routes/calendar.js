// Calendar accounts and the OAuth connect/callback pairs. The callback paths
// are registered with Google and Microsoft; do not rename them.
const { Router } = require('express');
const calendarService = require('../calendarService');
const { asyncHandler, idParam } = require('../lib/http');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

const router = Router();

router.get('/calendar/accounts', asyncHandler(async (req, res) => {
  res.json({
    accounts: await calendarService.listAccounts(),
    providers: {
      google: calendarService.googleConfigured(),
      outlook: calendarService.microsoftConfigured(),
    },
  });
}));

router.delete('/calendar/accounts/:id', asyncHandler(async (req, res) => {
  const id = idParam(req);
  if (id === null) return res.status(400).json({ error: 'invalid id' });
  await calendarService.disconnectAccount(id);
  res.json({ ok: true });
}));

router.get('/calendar/google/connect', (req, res) => {
  if (!calendarService.googleConfigured()) {
    return res.status(400).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.' });
  }
  res.redirect(calendarService.startGoogleAuth());
});

router.get('/calendar/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/?calendar_error=${encodeURIComponent(error)}`);
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    await calendarService.finishGoogleAuth(String(code));
    res.redirect(`${FRONTEND_URL}/?connected=google`);
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`${FRONTEND_URL}/?calendar_error=${encodeURIComponent(err.message || 'google_auth_failed')}`);
  }
});

router.get('/calendar/outlook/connect', (req, res) => {
  if (!calendarService.microsoftConfigured()) {
    return res.status(400).json({ error: 'Microsoft OAuth not configured. Set MS_CLIENT_ID and MS_CLIENT_SECRET in backend/.env.' });
  }
  res.redirect(calendarService.startMicrosoftAuth());
});

router.get('/calendar/outlook/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/?calendar_error=${encodeURIComponent(error)}`);
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    await calendarService.finishMicrosoftAuth(String(code));
    res.redirect(`${FRONTEND_URL}/?connected=outlook`);
  } catch (err) {
    console.error('Outlook callback error:', err);
    res.redirect(`${FRONTEND_URL}/?calendar_error=${encodeURIComponent(err.message || 'outlook_auth_failed')}`);
  }
});

module.exports = router;
