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
export const pullForwardDay = (date) => api.post(`/day/${date}/pull-forward`).then((r) => r.data);
export const createTask = (payload) => api.post('/tasks', payload).then((r) => r.data);
export const updateTask = (id, patch) => api.patch(`/tasks/${id}`, patch).then((r) => r.data);
export const deleteTask = (id) => api.delete(`/tasks/${id}`).then((r) => r.data);
export const reorderTasks = (ids) => api.post('/tasks/reorder', { ids }).then((r) => r.data);

// Appointments now use start_at / end_at (ISO local 'YYYY-MM-DDTHH:MM').
export const createAppointment = (payload) => api.post('/appointments', payload).then((r) => r.data);
export const updateAppointment = (id, patch) => api.patch(`/appointments/${id}`, patch).then((r) => r.data);
export const deleteAppointment = (id) => api.delete(`/appointments/${id}`).then((r) => r.data);

export const createNote = (payload) => api.post('/notes', payload).then((r) => r.data);
export const updateNote = (id, patch) => api.patch(`/notes/${id}`, patch).then((r) => r.data);
export const deleteNote = (id) => api.delete(`/notes/${id}`).then((r) => r.data);
export const reorderNotes = (ids) => api.post('/notes/reorder', { ids }).then((r) => r.data);

export const createOngoing = (payload) => api.post('/ongoing', payload).then((r) => r.data);
export const updateOngoing = (id, patch) => api.patch(`/ongoing/${id}`, patch).then((r) => r.data);
export const deleteOngoing = (id) => api.delete(`/ongoing/${id}`).then((r) => r.data);
export const reorderOngoing = (ids) => api.post('/ongoing/reorder', { ids }).then((r) => r.data);
export const saveNotesText = (date, content) => api.put(`/notes-text/${date}`, { content }).then((r) => r.data);

export const getMasterTasks = (year, month) =>
  api.get('/master-tasks', { params: { year, month } }).then((r) => r.data);
export const createMasterTask = (payload) => api.post('/master-tasks', payload).then((r) => r.data);
export const updateMasterTask = (id, patch) => api.patch(`/master-tasks/${id}`, patch).then((r) => r.data);
export const deleteMasterTask = (id) => api.delete(`/master-tasks/${id}`).then((r) => r.data);
export const reorderMasterTasks = (ids) => api.post('/master-tasks/reorder', { ids }).then((r) => r.data);

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
