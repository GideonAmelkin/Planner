// Garmin tab endpoints, all under /api/garmin. Reads are cached server-side; refresh=1 bypasses.
import api from '../shared/api';

export const getGarminStatus = () => api.get('/garmin/status').then((r) => r.data);
export const garminLogin = () => api.post('/garmin/login').then((r) => r.data);
export const garminMfa = (code) => api.post('/garmin/login/mfa', { code }).then((r) => r.data);
export const garminLogout = () => api.post('/garmin/logout').then((r) => r.data);
export const getGarminDay = (date, { refresh = false } = {}) =>
  api.get(`/garmin/day/${date}`, { params: refresh ? { refresh: 1 } : {} }).then((r) => r.data);
export const getGarminEndpoints = () => api.get('/garmin/endpoints').then((r) => r.data);
export const callGarmin = (name, params = {}, { refresh = false } = {}) =>
  api.get(`/garmin/${name}`, { params: refresh ? { ...params, refresh: 1 } : params, validateStatus: () => true })
    .then((r) => r.data);
export const garminBatch = (calls, { refresh = false } = {}) =>
  api.post('/garmin/batch', { calls, refresh }).then((r) => r.data);
export const postGarmin = (name, body = {}) =>
  api.post(`/garmin/${name}`, body, { validateStatus: () => true }).then((r) => r.data);
