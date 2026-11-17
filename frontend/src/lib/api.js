import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token from localStorage — read fresh on every request so tokens
// set after import time (OTP login, token refresh) are always picked up.
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

    // 401 = token missing or expired — clear session and send to login.
    // ⚠️  Use /get-account, not /auth/login (that route doesn't exist).
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('church_token');
      localStorage.removeItem('church_user');
      window.location.href = '/get-account';
    }

    return Promise.reject(new Error(message));
  }
);

export const authApi = {
  login:           (data) => api.post('/auth/login', data),
  register:        (data) => api.post('/auth/register', data),
  me:              ()     => api.get('/auth/me'),
  requestPhoneOTP: (data) => api.post('/auth/phone-login/request', data),
  verifyPhoneOTP:  (data) => api.post('/auth/phone-login/verify', data),
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
  getAll:               ()         => api.get('/ministries'),
  getMemberMinistries:  (userId)   => api.get(`/ministries/member/${userId}`),
  syncMemberMinistries: (userId, ministryIds) =>
    api.put(`/ministries/member/${userId}/sync`, { ministryIds }),
};

export const announcementApi = {
  getAll: ()     => api.get('/announcements'),
  create: (data) => api.post('/announcements', data),
  delete: (id)   => api.delete(`/announcements/${id}`),
  update: (id, data) => api.put(`/announcements/${id}`, data),
};

export const groupApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))
    ).toString();
    return api.get(`/groups${qs ? `?${qs}` : ''}`);
  },
  getById:         (id)       => api.get(`/groups/${id}`),
  create:          (data)     => api.post('/groups', data),
  update:          (id, data) => api.put(`/groups/${id}`, data),
  archive:         (id)       => api.put(`/groups/${id}/archive`),
  getMemberGroups: (userId)   => api.get(`/groups/member/${userId}`),
  syncMemberGroups:(userId, groupIds) => api.put(`/groups/member/${userId}/sync`, { groupIds }),
  delete:          (id)       => api.delete(`/groups/${id}`),
  getMembers: (id, params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))
    ).toString();
    return api.get(`/groups/${id}/members${qs ? `?${qs}` : ''}`);
  },
  addMember:    (id, data)         => api.post(`/groups/${id}/members`, data),
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

export const siteContentApi = {
  getAll:     ()            => api.get('/site-content'),
  getOne:     (key)         => api.get(`/site-content/${key}`),
  getSection: (key)         => api.get(`/site-content/${key}`),
  save:       (key, value)  => api.put(`/site-content/${key}`, value),
  reset:      (key)         => api.delete(`/site-content/${key}`),
};

export const dependantApi = {
  getAll: (userId)              => api.get(`/users/${userId}/dependants`),
  add:    (userId, data)        => api.post(`/users/${userId}/dependants`, data),
  update: (userId, depId, data) => api.patch(`/users/${userId}/dependants/${depId}`, data),
  remove: (userId, depId)       => api.delete(`/users/${userId}/dependants/${depId}`),
};

// ─────────────────────────────────────────────────────────────────────────────
// Meetings & Resolutions (Vikao na Maazimio)
// Ref: BSS-KKKT-2026-006
// ─────────────────────────────────────────────────────────────────────────────

/** Shared query-string builder — strips empty/null/undefined values */
const qs = (params = {}) => {
  const str = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)
    )
  ).toString();
  return str ? `?${str}` : '';
};

export const meetingApi = {

  // ── Meeting Types (catalogue) ─────────────────────────────────────────────

  /**
   * GET /api/meetings/types
   * @param {Object} params
   * @param {string} params.scope — church | group | both
   */
  getTypes: (params = {}) => api.get(`/meetings/types${qs(params)}`),

  // ── Meetings CRUD ─────────────────────────────────────────────────────────

  /**
   * GET /api/meetings
   * @param {Object} params
   * @param {number}  params.group_id  — filter to one group (omit = all accessible)
   * @param {string}  params.scope     — 'church' (group_id IS NULL) | 'group' (group_id NOT NULL)
   * @param {string}  params.status    — scheduled | held | cancelled | postponed
   * @param {string}  params.from      — YYYY-MM-DD  meeting_date range start
   * @param {string}  params.to        — YYYY-MM-DD  meeting_date range end
   * @param {1|'1'}   params.upcoming  — shortcut: status=scheduled AND date >= today
   */
  getAll: (params = {}) => api.get(`/meetings${qs(params)}`),

  /** GET /api/meetings/:id */
  getById: (id) => api.get(`/meetings/${id}`),

  /**
   * POST /api/meetings
   * @param {Object} data
   * @param {number|null} data.group_id          — null = church-level
   * @param {number}      data.meeting_type_id
   * @param {string}      data.title
   * @param {string}      data.meeting_date      — YYYY-MM-DD
   * @param {string}      [data.start_time]      — HH:MM
   * @param {string}      [data.end_time]        — HH:MM
   * @param {string}      [data.venue]
   * @param {number}      [data.convened_by_id]
   * @param {number}      [data.secretary_id]
   * @param {boolean}     [data.quorum_met]
   * @param {number}      [data.total_attendees]
   * @param {string}      [data.agenda]
   * @param {string}      [data.summary]
   * @param {string}      [data.status]          — default 'scheduled'
   * @param {string}      [data.cancellation_reason]
   */
  create: (data) => api.post('/meetings', data),

  /** PUT /api/meetings/:id */
  update: (id, data) => api.put(`/meetings/${id}`, data),

  /** DELETE /api/meetings/:id  — pastor/elder only */
  delete: (id) => api.delete(`/meetings/${id}`),

  // ── Attendees ─────────────────────────────────────────────────────────────

  /** GET /api/meetings/:id/attendees */
  getAttendees: (id) => api.get(`/meetings/${id}/attendees`),

  /**
   * POST /api/meetings/:id/attendees
   * @param {number} id  — meeting id
   * @param {Object} data
   * @param {number} data.member_id
   * @param {string} [data.attendance_type]  — present | apology | absent  (default: present)
   * @param {string} [data.role_in_meeting]  — Mwenyekiti | Katibu | …
   * @param {string} [data.notes]
   */
  addAttendee: (id, data) => api.post(`/meetings/${id}/attendees`, data),

  /**
   * POST /api/meetings/:id/attendees/bulk
   * Replaces the entire attendee list atomically.
   * @param {number}   id
   * @param {Object[]} attendees  — [{ member_id, attendance_type?, role_in_meeting?, notes? }]
   */
  bulkSyncAttendees: (id, attendees) =>
    api.post(`/meetings/${id}/attendees/bulk`, { attendees }),

  /**
   * PUT /api/meetings/:id/attendees/:attendanceId
   * @param {number} id
   * @param {number} attendanceId
   * @param {Object} data  — { attendance_type?, role_in_meeting?, notes? }
   */
  updateAttendee: (id, attendanceId, data) =>
    api.put(`/meetings/${id}/attendees/${attendanceId}`, data),

  /** DELETE /api/meetings/:id/attendees/:attendanceId */
  removeAttendee: (id, attendanceId) =>
    api.delete(`/meetings/${id}/attendees/${attendanceId}`),

  // ── Resolutions (Maamuzi) ─────────────────────────────────────────────────

  /**
   * GET /api/meetings/:id/resolutions
   * @param {number} id
   * @param {Object} params
   * @param {string} params.status — pending | in_progress | completed | cancelled | deferred
   */
  getResolutions: (id, params = {}) =>
    api.get(`/meetings/${id}/resolutions${qs(params)}`),

  /**
   * POST /api/meetings/:id/resolutions
   * @param {number} id  — meeting id
   * @param {Object} data
   * @param {string}  data.description
   * @param {number}  [data.resolution_number]       — auto-incremented if omitted
   * @param {number}  [data.responsible_member_id]
   * @param {string}  [data.responsible_note]        — free-text if not a system user
   * @param {string}  [data.deadline]                — YYYY-MM-DD
   * @param {string}  [data.implementation_status]   — default 'pending'
   * @param {string}  [data.progress_notes]
   */
  addResolution: (id, data) => api.post(`/meetings/${id}/resolutions`, data),

  /**
   * PUT /api/meetings/:id/resolutions/:resolutionId
   * Same fields as addResolution. Also accepts completion_date.
   * Setting implementation_status='completed' auto-sets completion_date if not provided.
   */
  updateResolution: (id, resolutionId, data) =>
    api.put(`/meetings/${id}/resolutions/${resolutionId}`, data),

  /** DELETE /api/meetings/:id/resolutions/:resolutionId — pastor/elder only */
  deleteResolution: (id, resolutionId) =>
    api.delete(`/meetings/${id}/resolutions/${resolutionId}`),

  // ── Documents (Minutes PDFs & attachments) ────────────────────────────────

  /** GET /api/meetings/:id/documents */
  getDocuments: (id) => api.get(`/meetings/${id}/documents`),

  /**
   * POST /api/meetings/:id/documents
   * Multipart upload — use FormData.
   * @param {number}   id
   * @param {FormData} formData  — fields: file (required), document_type?, title?
   *
   * @example
   *   const fd = new FormData();
   *   fd.append('file', fileObject);
   *   fd.append('document_type', 'minutes');
   *   fd.append('title', 'Kumbukumbu za Mkutano wa Kamati – Aprili 2026');
   *   meetingApi.uploadDocument(meetingId, fd);
   */
  uploadDocument: (id, formData) =>
    api.post(`/meetings/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** DELETE /api/meetings/:id/documents/:documentId */
  deleteDocument: (id, documentId) =>
    api.delete(`/meetings/${id}/documents/${documentId}`),

  // ── Dashboard ─────────────────────────────────────────────────────────────

  /**
   * GET /api/meetings/dashboard/open-resolutions
   * Returns pending/in_progress resolutions tagged with urgency.
   * Powers the "Maazimio ambayo hayajakamilika" dashboard card.
   * @param {Object} params
   * @param {1|'1'}  params.overdue   — only resolutions past their deadline
   * @param {number} params.group_id  — scope to one group
   */
  getOpenResolutions: (params = {}) =>
    api.get(`/meetings/dashboard/open-resolutions${qs(params)}`),

  /**
   * GET /api/meetings/dashboard/upcoming
   * Next N scheduled meetings the user has access to.
   * @param {Object} params
   * @param {number} params.limit  — default 5, max 20
   */
  getUpcomingMeetings: (params = {}) =>
    api.get(`/meetings/dashboard/upcoming${qs(params)}`),

  // ── RSVP Workflow ─────────────────────────────────────────────────────────────

/**
 * GET /api/meetings/:id/rsvp-summary
 * Returns invite + RSVP breakdown for the detail page strip.
 */
getRsvpSummary: (id) => api.get(`/meetings/${id}/rsvp-summary`),

/**
 * POST /api/meetings/:id/send-invites
 * Manager sends WhatsApp attendance links to selected members.
 *
 * @param {number}   id
 * @param {Object}   data
 * @param {number[]} [data.member_ids]   — explicit list of user IDs
 * @param {string}   [data.scope]        — 'group' | 'church' | 'jumuiya'
 * @param {string}   [data.jumuiya_name] — required when scope = 'jumuiya'
 * @param {boolean}  [data.resend]       — re-send to already-invited members
 */
sendInvites: (id, data) => api.post(`/meetings/${id}/send-invites`, data),

/**
 * GET /api/meetings/:id/my-rsvp
 * Returns the logged-in member's current RSVP + meeting info.
 * Used to populate the /attend/[meetingId] page.
 */
getMyRsvp: (id) => api.get(`/meetings/${id}/my-rsvp`),

/**
 * POST /api/meetings/:id/rsvp
 * Authenticated member submits their RSVP.
 * @param {number} id
 * @param {string} response — 'rsvp_yes' | 'rsvp_apology' | 'rsvp_no'
 */
submitRsvp: (id, response) => api.post(`/meetings/${id}/rsvp`, { response }),

/**
 * PATCH /api/meetings/:id/attendees/:attendanceId/confirm
 * Manager confirms actual attendance for one member.
 * @param {number} id
 * @param {number} attendanceId
 * @param {string} attendance_type — 'present' | 'apology' | 'absent'
 */
confirmAttendee: (id, attendanceId, attendance_type) =>
  api.patch(`/meetings/${id}/attendees/${attendanceId}/confirm`, { attendance_type }),

/**
 * PATCH /api/meetings/:id/attendees/confirm-all
 * Bulk confirm: convert all rsvp_yes rows → present.
 */
confirmAll: (id) => api.patch(`/meetings/${id}/attendees/confirm-all`),
};

export default api;