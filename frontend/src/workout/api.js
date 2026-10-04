// Workout tab endpoints, all under /api/workout. Read-only apart from the Refresh request; the Mac
// ships the snapshot (404 means no snapshot yet).
import api from '../shared/api';

export const getWorkoutStatus = () => api.get('/workout/status').then((r) => r.data);
export const getWorkoutRecent = (end, days = 30) => api.get('/workout/recent', { params: { end, days }, validateStatus: (s) => s === 200 || s === 404 }).then((r) => r.data);
export const getWorkoutCatalog = () => api.get('/workout/catalog', { validateStatus: (s) => s === 200 || s === 404 }).then((r) => r.data);
export const getWorkoutStrength = () => api.get('/workout/strength', { validateStatus: (s) => s === 200 || s === 404 }).then((r) => r.data);
// Ask the Mac for a sync now (the Refresh button); answered when status.refresh.answered_at is set.
export const requestWorkoutRefresh = () => api.post('/workout/refresh').then((r) => r.data);
