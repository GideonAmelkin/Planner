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

export const API_BASE = API_BASE_URL;

export default api;
