// Social tab endpoints, all under /api/social. The videos come from the TikTok tracker's
// db on the server (404 means it is not there); the review is 404 until the first run.
import api from '../shared/api';

const okOr404 = { validateStatus: (s) => s === 200 || s === 404 };

export const getSocialStatus = () => api.get('/social/status').then((r) => r.data);
export const getSocialVideos = () => api.get('/social/videos', okOr404).then((r) => r.data);
export const getSocialVideo = (id) => api.get(`/social/videos/${id}`).then((r) => r.data);
export const getReview = () => api.get('/social/review', okOr404).then((r) => r.data);
// 202 started, 409 already running, 429 throttled, 503 no API key on the server.
export const generateReview = () => api.post('/social/review/generate', {}, {
  validateStatus: (s) => s === 202 || s === 409 || s === 429 || s === 503,
}).then((r) => ({ status: r.status, ...r.data }));

// Competitors card.
export const getCompetitors = () => api.get('/social/competitors').then((r) => r.data);
// action: add | remove. 400 bad handle, 409 at the account cap.
export const changeCompetitor = (handle, action) => api.post('/social/competitors/handles', { handle, action }, {
  validateStatus: (s) => s === 200 || s === 400 || s === 409,
}).then((r) => ({ status: r.status, ...r.data }));
export const putCompetitorSettings = (body) => api.put('/social/competitors/settings', body, {
  validateStatus: (s) => s === 200 || s === 400,
}).then((r) => ({ status: r.status, ...r.data }));
export const saveCompetitorVideo = (id, note) => api.put(`/social/competitors/saves/${id}`, { note }).then((r) => r.data);
export const unsaveCompetitorVideo = (id) => api.delete(`/social/competitors/saves/${id}`).then((r) => r.data);
