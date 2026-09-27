// Health tab endpoints, all under /api/health. Reads come from the Health store on the
// server; nothing here makes the page fetch Garmin live.
import api from '../shared/api';

export const getHealthDay = (date) => api.get(`/health/day/${date}`).then((r) => r.data);
export const getHealthStatus = () => api.get('/health/status').then((r) => r.data);
// 202 started, 429 throttled, 409 waiting for a sign-in; resolved, not thrown.
export const runHealthFetch = () => api.post('/health/fetch', {}, { validateStatus: (s) => s === 202 || s === 429 || s === 409 }).then((r) => ({ status: r.status, ...r.data }));
