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
  login:           (data) => api.post('/auth/login', data),
  register:        (data) => api.post('/auth/register', data),
  me:              ()     => api.get('/auth/me'),
  adminCreate:     (data) => api.post('/auth/admin-create', data),
  adminBulkCreate: (data) => api.post('/auth/admin-bulk-create', data),

  /**
   * GET /api/auth/members
   *
   * All params are optional and combinable:
   * @param {Object} params
   * @param {string}  params.sortBy        — full_name | jumuiya | gender | marital_status |
   *                                         occupation | created_at | member_since | date_of_birth
   * @param {string}  params.order         — asc | desc
   * @param {string}  params.jumuiya       — exact jumuiya name
   * @param {number}  params.ministry      — ministry ID
   * @param {string}  params.gender        — Male | Female
   * @param {string}  params.marital_status
   * @param {string}  params.member_status — hai | amehamia | amefariki
   * @param {number}  params.group_id
   * @param {string}  params.search        — partial match on name / phone / ahadi_number / namba
   * @param {number}  params.page          — default 1
   * @param {number}  params.limit         — default 50, max 200
   */
  getMembers: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)
      )
    ).toString();
    return api.get(`/auth/members${qs ? `?${qs}` : ''}`);
  },
};

export const userApi = {
  getAll:   ()       => api.get('/users'),
  getOne:   (id)     => api.get(`/users/${id}`),
  update:   (id, d)  => api.put(`/users/${id}`, d),
  delete:   (id)     => api.delete(`/users/${id}`),
  getStats: ()       => api.get('/users/stats'),
   getMembers: (params) => api.get('/auth/members', { 
    params: { limit: 500, ...params } 
  }),
  changePassword: (userId, data) =>
    api.put(`/users/${userId}/password`, data),
};

export const ministryApi = {
  // GET /api/ministries
  // Returns full catalogue: [{ id, name, category, description }]
  getAll: () =>
    api.get('/ministries'),

  // GET /api/ministries/member/:userId
  // Returns member's current memberships: [{ ministry_id, name, category }]
  getMemberMinistries: (userId) =>
    api.get(`/ministries/member/${userId}`),

  // PUT /api/ministries/member/:userId/sync
  // Replaces the member's ministry set with the supplied ID array.
  // ministryIds: number[]
  syncMemberMinistries: (userId, ministryIds) =>
    api.put(`/ministries/member/${userId}/sync`, { ministryIds }),
};

export const announcementApi = {
  getAll: ()     => api.get('/announcements'),
  create: (data) => api.post('/announcements', data),
  delete: (id)   => api.delete(`/announcements/${id}`),
};

export const groupApi = {
  // GET /api/groups?type=jumuiya&year=2025&is_archived=0
  getAll: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))
    ).toString();
    return api.get(`/groups${qs ? `?${qs}` : ''}`);
  },

  // GET /api/groups/:id
  getById: (id) => api.get(`/groups/${id}`),

  // POST /api/groups
  create: (data) => api.post('/groups', data),
  // data shape: { name, name_sw, type, description?, year?, start_date?, end_date?, leader_id? }

  // PUT /api/groups/:id
  update: (id, data) => api.put(`/groups/${id}`, data),

  // PUT /api/groups/:id/archive
  archive: (id) => api.put(`/groups/${id}/archive`),

  // DELETE /api/groups/:id
  delete: (id) => api.delete(`/groups/${id}`),

  // GET /api/groups/:id/members?year=2025&status=active
  getMembers: (id, params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))
    ).toString();
    return api.get(`/groups/${id}/members${qs ? `?${qs}` : ''}`);
  },

  // POST /api/groups/:id/members
  addMember: (id, data) => api.post(`/groups/${id}/members`, data),
  // data shape: { user_id, year?, role_in_group?, joined_date? }

  // DELETE /api/groups/:id/members/:membershipId   (soft-remove by membership row id)
  removeMember: (id, membershipId) => api.delete(`/groups/${id}/members/${membershipId}`),
};

export const eventApi = {
  getAll:  ()       => api.get('/events'),
  create:  (data)   => api.post('/events', data),
  update:  (id, d)  => api.put(`/events/${id}`, d),
  delete:  (id)     => api.delete(`/events/${id}`),
};

export const formTemplateApi = {
  getAll:  ()            => api.get('/form-templates'),
  getOne:  (id)          => api.get(`/form-templates/${id}`),
  create:  (payload)     => api.post('/form-templates', payload),
  update:  (id, payload) => api.put(`/form-templates/${id}`, payload),
  remove:  (id)          => api.delete(`/form-templates/${id}`),
};

export const committeeApi = {
  getAll:               ()            => api.get('/committees'),
  getMemberCommittees:  (userId)      => api.get(`/committees/member/${userId}`),
  syncMemberCommittees: (userId, ids) => api.put(`/committees/member/${userId}/sync`, { committeeIds: ids }),
};

// ── Site Content API ──────────────────────────────────────────────────────────
export const siteContentApi = {
  // GET /api/site-content  → { success, data: { hero_slides: […], schedule: […], … } }
  getAll: () => api.get('/site-content'),

  // GET /api/site-content/:key  → { success, data: <value>, updatedAt }
  getOne:     (key)         => api.get(`/site-content/${key}`),

  // Alias used by the content editor page
  getSection: (key)         => api.get(`/site-content/${key}`),

  // PUT /api/site-content/:key  (pastor | elder)
  save:       (key, value)  => api.put(`/site-content/${key}`, value),

  // DELETE /api/site-content/:key  (pastor only)
  // Removes the DB row so the frontend falls back to the hardcoded default.
  reset:      (key)         => api.delete(`/site-content/${key}`),
};

export const dependantApi = {
  getAll: (userId)              => api.get(`/users/${userId}/dependants`),
  add:    (userId, data)        => api.post(`/users/${userId}/dependants`, data),
  update: (userId, depId, data) => api.patch(`/users/${userId}/dependants/${depId}`, data),
  remove: (userId, depId)       => api.delete(`/users/${userId}/dependants/${depId}`),
};

export default api;