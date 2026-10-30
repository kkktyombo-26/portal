

import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token from localStorage;
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('church_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.response?.data?.errors?.[0]?.message ||
      'Something went wrong';
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('church_token');
      localStorage.removeItem('church_user');
      window.location.href = '/auth/login';
    }
    return Promise.reject(new Error(message));
  }
);

export const authApi = {
  login:    (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me:       ()     => api.get('/auth/me'),
  adminCreate:  (data) => api.post('/auth/admin-create', data),
  adminBulkCreate: (data) => api.post('/auth/admin-bulk-create', data),
};

export const userApi = {
  getAll:   ()       => api.get('/users'),
  getOne:   (id)     => api.get(`/users/${id}`),
  update:   (id, d)  => api.put(`/users/${id}`, d),
  delete:   (id)     => api.delete(`/users/${id}`),
  getStats: ()       => api.get('/users/stats'),
  changePassword: (userId, data) =>
  api.put(`/users/${userId}/password`, data),
};

export const announcementApi = {
  getAll: ()     => api.get('/announcements'),
  create: (data) => api.post('/announcements', data),
  delete: (id)   => api.delete(`/announcements/${id}`),
};

export const groupApi = {
  getAll:       ()            => api.get('/groups'),
  getById:      (id)          => api.get(`/groups/${id}`),
  create:       (data)        => api.post('/groups', data),
  update:       (id, d)       => api.put(`/groups/${id}`, d),
  delete:       (id)          => api.delete(`/groups/${id}`),
  getMembers:   (id)          => api.get(`/groups/${id}/members`),
  addMember:    (id, userId)  => api.post(`/groups/${id}/members`, { user_id: userId }),
  removeMember: (id, userId)  => api.delete(`/groups/${id}/members/${userId}`),
};

export const eventApi = {
  getAll:  ()       => api.get('/events'),
  create:  (data)   => api.post('/events', data),
  update:  (id, d)  => api.put(`/events/${id}`, d),
  delete:  (id)     => api.delete(`/events/${id}`),
};

export const formTemplateApi = {
  getAll:  ()               => api.get('/form-templates'),
  getOne:  (id)             => api.get(`/form-templates/${id}`),
  create:  (payload)        => api.post('/form-templates', payload),
  update:  (id, payload)    => api.put(`/form-templates/${id}`, payload),
  remove:  (id)             => api.delete(`/form-templates/${id}`),
};

// ── Site Content API ──────────────────────────────────────────────────────────
export const siteContentApi = {
  // GET /api/site-content  → { success, data: { hero_slides: […], schedule: […], … } }
  getAll: () => api.get('/site-content'),

  // GET /api/site-content/:key  → { success, data: <value>, updatedAt }
  getOne:      (key)        => api.get(`/site-content/${key}`),

  // Alias used by the content editor page
  getSection:  (key)        => api.get(`/site-content/${key}`),

  // PUT /api/site-content/:key  (pastor | elder)
  save:        (key, value) => api.put(`/site-content/${key}`, value),

  // DELETE /api/site-content/:key  (pastor only)
  // Removes the DB row so the frontend falls back to the hardcoded default.
  reset:       (key)        => api.delete(`/site-content/${key}`),
};

// Replace the existing dependantApi block in lib/api.js with this:

export const dependantApi = {
  getAll: (userId)               => api.get(`/users/${userId}/dependants`),
  add:    (userId, data)         => api.post(`/users/${userId}/dependants`, data),
  update: (userId, depId, data)  => api.patch(`/users/${userId}/dependants/${depId}`, data),
  remove: (userId, depId)        => api.delete(`/users/${userId}/dependants/${depId}`),
};
export default api;