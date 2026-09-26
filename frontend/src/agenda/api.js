// Agenda tab endpoints: the daily spread's lists, appointments and Monthly Goals.
// getDay (the whole spread) stays in shared/api.js because Settings reads it too.
import api from '../shared/api';

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
