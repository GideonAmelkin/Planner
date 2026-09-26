import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = error.config;
    if (!cfg || cfg.__retried) return Promise.reject(error);
    const isNetworkError = !error.response;
    if (!isNetworkError) return Promise.reject(error);
    cfg.__retried = true;
    await new Promise((r) => setTimeout(r, 1500));
    return api(cfg);
  }
);

export const getDay = (date) => api.get(`/day/${date}`).then((r) => r.data);

export const getRecap = () => api.get('/recap').then((r) => r.data);

export const getCalendarAccounts = () => api.get('/calendar/accounts').then((r) => r.data);
export const disconnectCalendarAccount = (id) => api.delete(`/calendar/accounts/${id}`).then((r) => r.data);

// Garmin Connect (Health tab). Reads are cached server-side; refresh=1 bypasses.
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

export const API_BASE = API_BASE_URL;

export default api;

// Home Workouts snapshot (Workout App tab). Read-only; the Mac ships the file.
export const getWorkoutStatus = () => api.get('/workout/status').then((r) => r.data);
export const getWorkoutDay = (date) => api.get(`/workout/day/${date}`, { validateStatus: (s) => s === 200 || s === 404 }).then((r) => r.data);
export const getWorkoutRecent = (end, days = 30) => api.get('/workout/recent', { params: { end, days }, validateStatus: (s) => s === 200 || s === 404 }).then((r) => r.data);
export const getWorkoutCatalog = () => api.get('/workout/catalog', { validateStatus: (s) => s === 200 || s === 404 }).then((r) => r.data);
