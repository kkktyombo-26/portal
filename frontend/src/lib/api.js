import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token from localStorage
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
    const message = err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'Something went wrong';
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
};

export const userApi = {
  getAll:  ()       => api.get('/users'),
  getOne:  (id)     => api.get(`/users/${id}`),
  update:  (id, d)  => api.put(`/users/${id}`, d),
  delete:  (id)     => api.delete(`/users/${id}`),
  getStats:()       => api.get('/users/stats'),
};

export const announcementApi = {
  getAll:  ()       => api.get('/announcements'),
  create:  (data)   => api.post('/announcements', data),
  delete:  (id)     => api.delete(`/announcements/${id}`),
};

export const groupApi = {
  getAll:  ()       => api.get('/groups'),
  create:  (data)   => api.post('/groups', data),
  update:  (id, d)  => api.put(`/groups/${id}`, d),
  delete:  (id)     => api.delete(`/groups/${id}`),
};

export default api;

export const eventApi = {
  getAll:  ()       => api.get('/events'),
  create:  (data)   => api.post('/events', data),
  update:  (id, d)  => api.put(`/events/${id}`, d),
  delete:  (id)     => api.delete(`/events/${id}`),
};

// ── Add this to your existing lib/api.js ──────────────────────────────────
//
// Paste these exports alongside your existing userApi, announcementApi, etc.

export const formTemplateApi = {
  getAll: () =>
    apiClient.get('/form-templates'),

  getOne: (id) =>
    apiClient.get(`/form-templates/${id}`),

  create: (payload) =>
    apiClient.post('/form-templates', payload),

  update: (id, payload) =>
    apiClient.put(`/form-templates/${id}`, payload),

  remove: (id) =>
    apiClient.delete(`/form-templates/${id}`),
};
