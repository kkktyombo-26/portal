// ─────────────────────────────────────────────────────────────────────────────
// Projects Module (Miradi ya Usharika)
// Ref: BSS-KKKT-2026-008
//
// Covers §9 (Ardhi na Majengo), §10 (Mikataba), §13 (Miradi)
// Add this export block to api.js alongside meetingApi, groupApi, etc.
// ─────────────────────────────────────────────────────────────────────────────

export const projectApi = {

  // ── Dashboard summary ─────────────────────────────────────────────────────

  /**
   * GET /api/projects/summary
   * Aggregate figures for the dashboard card: Miradi | Mikataba | Mali.
   */
  getSummary: () => api.get('/projects/summary'),


  // ═══════════════════════════════════════════════════════════════════════════
  // §13 — PROJECTS (miradi)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/projects
   * @param {Object} params
   * @param {string}  params.status        — planning | active | on_hold | completed | cancelled
   * @param {string}  params.project_type  — prefix match on project_type
   * @param {number}  params.supervised_by — user id of the supervisor
   * @param {string}  params.search        — partial match on name or description
   * @param {number}  params.page          — default 1
   * @param {number}  params.limit         — default 50, max 200
   */
  getAll: (params = {}) => api.get(`/projects${qs(params)}`),

  /** GET /api/projects/:id — full detail with contracts, photos, payment summary */
  getById: (id) => api.get(`/projects/${id}`),

  /**
   * POST /api/projects
   * @param {Object} data
   * @param {string}  data.name                — required
   * @param {string}  [data.description]
   * @param {string}  [data.project_type]      — Ujenzi | Barabara | Mifereji | Uzio | n.k.
   * @param {string}  [data.status]            — default 'planning'
   * @param {number}  [data.progress_pct]      — 0–100, default 0
   * @param {string}  [data.start_date]        — YYYY-MM-DD
   * @param {string}  [data.expected_end_date] — YYYY-MM-DD
   * @param {string}  [data.actual_end_date]   — YYYY-MM-DD
   * @param {number}  [data.budget]            — TShs
   * @param {number}  [data.supervised_by_id]
   * @param {number}  [data.land_asset_id]
   * @param {string}  [data.notes]
   */
  create: (data) => api.post('/projects', data),

  /**
   * PATCH /api/projects/:id
   * Send only the fields you want to change.
   */
  update: (id, data) => api.patch(`/projects/${id}`, data),

  /** DELETE /api/projects/:id — pastor/elder only */
  delete: (id) => api.delete(`/projects/${id}`),


  // ═══════════════════════════════════════════════════════════════════════════
  // §10 — CONTRACTS (project_contracts)
  // ═══════════════════════════════════════════════════════════════════════════

  /** GET /api/projects/:projectId/contracts */
  getContracts: (projectId) => api.get(`/projects/${projectId}/contracts`),

  /** GET /api/projects/:projectId/contracts/:contractId */
  getContract: (projectId, contractId) =>
    api.get(`/projects/${projectId}/contracts/${contractId}`),

  /**
   * POST /api/projects/:projectId/contracts
   * @param {number} projectId
   * @param {Object} data
   * @param {string}  data.title               — required
   * @param {string}  [data.contract_number]
   * @param {string}  [data.contractor_name]
   * @param {string}  [data.contractor_contact]
   * @param {string}  [data.scope_of_work]
   * @param {number}  [data.contract_value]    — TShs, default 0
   * @param {number}  [data.revised_value]
   * @param {number}  [data.retention_pct]     — e.g. 5 or 10
   * @param {string}  [data.signed_date]       — YYYY-MM-DD
   * @param {string}  [data.start_date]        — YYYY-MM-DD
   * @param {string}  [data.expected_end_date] — YYYY-MM-DD
   * @param {string}  [data.actual_end_date]   — YYYY-MM-DD
   * @param {string}  [data.contract_status]   — default 'draft'
   * @param {number}  [data.supervised_by_id]
   * @param {string}  [data.notes]
   */
  createContract: (projectId, data) =>
    api.post(`/projects/${projectId}/contracts`, data),

  /** PATCH /api/projects/:projectId/contracts/:contractId */
  updateContract: (projectId, contractId, data) =>
    api.patch(`/projects/${projectId}/contracts/${contractId}`, data),

  /** DELETE /api/projects/:projectId/contracts/:contractId — pastor/elder only */
  deleteContract: (projectId, contractId) =>
    api.delete(`/projects/${projectId}/contracts/${contractId}`),


  // ── Contract Variations ───────────────────────────────────────────────────

  /** GET /api/projects/:projectId/contracts/:contractId/variations */
  getVariations: (projectId, contractId) =>
    api.get(`/projects/${projectId}/contracts/${contractId}/variations`),

  /**
   * POST /api/projects/:projectId/contracts/:contractId/variations
   * variation_number is auto-assigned by the server.
   * @param {number} projectId
   * @param {number} contractId
   * @param {Object} data
   * @param {string}  data.title           — required
   * @param {string}  [data.description]
   * @param {number}  [data.amount]        — positive = cost, negative = saving
   * @param {string}  [data.status]        — pending | approved | rejected  (default 'pending')
   * @param {number}  [data.approved_by_id]
   * @param {string}  [data.approved_date] — YYYY-MM-DD
   * @param {string}  [data.notes]
   */
  createVariation: (projectId, contractId, data) =>
    api.post(`/projects/${projectId}/contracts/${contractId}/variations`, data),

  /**
   * PATCH /api/projects/:projectId/contracts/:contractId/variations/:variationId
   * Approving a variation (status → 'approved') auto-updates contract revised_value.
   */
  updateVariation: (projectId, contractId, variationId, data) =>
    api.patch(
      `/projects/${projectId}/contracts/${contractId}/variations/${variationId}`,
      data
    ),


  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS (project_payments)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/projects/:projectId/payments
   * @param {number} projectId
   * @param {Object} params
   * @param {number}  params.page
   * @param {number}  params.limit
   */
  getPayments: (projectId, params = {}) =>
    api.get(`/projects/${projectId}/payments${qs(params)}`),

  /**
   * POST /api/projects/:projectId/payments
   * @param {number} projectId
   * @param {Object} data
   * @param {number}  data.amount                    — required, must be > 0
   * @param {string}  data.payment_date              — required, YYYY-MM-DD
   * @param {number}  [data.contract_id]             — link to a specific contract
   * @param {string}  [data.payment_type]            — advance | interim | final | retention | variation | other
   * @param {string}  [data.payment_number]          — payment certificate number
   * @param {string}  [data.receipt_number]          — cross-ref §7
   * @param {string}  [data.payment_method]          — bank_transfer | cheque | mobile_money | cash
   * @param {string}  [data.period_from]             — YYYY-MM-DD
   * @param {string}  [data.period_to]               — YYYY-MM-DD
   * @param {number}  [data.approved_by_id]
   * @param {number}  [data.progress_pct_at_payment] — 0–100
   * @param {string}  [data.description]
   */
  createPayment: (projectId, data) =>
    api.post(`/projects/${projectId}/payments`, data),

  /** PATCH /api/projects/:projectId/payments/:paymentId — pastor/elder only */
  updatePayment: (projectId, paymentId, data) =>
    api.patch(`/projects/${projectId}/payments/${paymentId}`, data),

  /** DELETE /api/projects/:projectId/payments/:paymentId — pastor/elder only */
  deletePayment: (projectId, paymentId) =>
    api.delete(`/projects/${projectId}/payments/${paymentId}`),


  // ═══════════════════════════════════════════════════════════════════════════
  // DOCUMENTS (project_documents)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/projects/:projectId/documents
   * Non-pastor/elder callers automatically get confidential=0 filtered server-side.
   * @param {number} projectId
   * @param {Object} params
   * @param {string}  params.document_type — contract | variation | certificate | permit | report | invoice | plan | other
   * @param {number}  params.contract_id   — filter to one contract's documents
   * @param {0|1}     params.confidential  — pastor/elder only: '0' | '1'
   */
  getDocuments: (projectId, params = {}) =>
    api.get(`/projects/${projectId}/documents${qs(params)}`),

  /**
   * POST /api/projects/:projectId/documents
   * File must be uploaded to R2 first via /api/r2 — pass the returned URL here.
   * @param {number} projectId
   * @param {Object} data
   * @param {string}  data.title            — required
   * @param {string}  data.file_url         — required, R2 path/URL
   * @param {string}  [data.document_type]  — default 'other'
   * @param {number}  [data.contract_id]
   * @param {number}  [data.file_size_kb]
   * @param {string}  [data.mime_type]
   * @param {string}  [data.reference_number]
   * @param {string}  [data.document_date]  — YYYY-MM-DD
   * @param {0|1}     [data.confidential]   — default 0
   */
  addDocument: (projectId, data) =>
    api.post(`/projects/${projectId}/documents`, data),

  /** DELETE /api/projects/:projectId/documents/:documentId — pastor/elder only */
  deleteDocument: (projectId, documentId) =>
    api.delete(`/projects/${projectId}/documents/${documentId}`),


  // ═══════════════════════════════════════════════════════════════════════════
  // PHOTOS — picha za maendeleo (project_photos)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/projects/:projectId/photos
   * @param {number} projectId
   * @param {Object} params
   * @param {number}  params.page
   * @param {number}  params.limit
   */
  getPhotos: (projectId, params = {}) =>
    api.get(`/projects/${projectId}/photos${qs(params)}`),

  /**
   * POST /api/projects/:projectId/photos
   * Image must be uploaded to R2 first via /api/r2 — pass the returned URL here.
   * @param {number} projectId
   * @param {Object} data
   * @param {string}  data.file_url               — required, R2 path/URL
   * @param {string}  [data.thumbnail_url]        — optional smaller preview
   * @param {number}  [data.file_size_kb]
   * @param {string}  [data.mime_type]
   * @param {string}  [data.caption]
   * @param {string}  [data.taken_date]           — YYYY-MM-DD
   * @param {number}  [data.progress_pct_at_photo] — 0–100
   * @param {string}  [data.location_note]        — e.g. "Upande wa Kaskazini"
   * @param {number}  [data.sort_order]           — default 0
   */
  addPhoto: (projectId, data) =>
    api.post(`/projects/${projectId}/photos`, data),

  /**
   * PATCH /api/projects/:projectId/photos/:photoId
   * Updates caption, sort_order, taken_date, location_note, progress_pct_at_photo.
   */
  updatePhoto: (projectId, photoId, data) =>
    api.patch(`/projects/${projectId}/photos/${photoId}`, data),

  /** DELETE /api/projects/:projectId/photos/:photoId — pastor/elder only */
  deletePhoto: (projectId, photoId) =>
    api.delete(`/projects/${projectId}/photos/${photoId}`),


  // ═══════════════════════════════════════════════════════════════════════════
  // §9 — LAND ASSETS (ardhi na majengo)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/projects/land-assets
   * @param {Object} params
   * @param {string}  params.asset_type       — land | building | both
   * @param {string}  params.ownership_status — owned | leased | in_process
   * @param {string}  params.search           — partial match on name, area_name, plot_number
   * @param {number}  params.page
   * @param {number}  params.limit
   */
  getLandAssets: (params = {}) =>
    api.get(`/projects/land-assets${qs(params)}`),

  /** GET /api/projects/land-assets/:id — includes documents and linked projects */
  getLandAsset: (id) => api.get(`/projects/land-assets/${id}`),

  /**
   * POST /api/projects/land-assets — pastor/elder only
   * @param {Object} data
   * @param {string}  data.name                — required
   * @param {string}  [data.asset_type]        — land | building | both  (default 'land')
   * @param {string}  [data.plot_number]
   * @param {string}  [data.title_deed_number]
   * @param {string}  [data.ownership_status]  — owned | leased | in_process  (default 'owned')
   * @param {string}  [data.area_name]
   * @param {string}  [data.region]
   * @param {number}  [data.gps_lat]
   * @param {number}  [data.gps_lng]
   * @param {number}  [data.area_sqm]
   * @param {string}  [data.usage]             — Kanisa | Makazi | Biashara | n.k.
   * @param {number}  [data.valuation]         — TShs
   * @param {string}  [data.valuation_date]    — YYYY-MM-DD
   * @param {number}  [data.responsible_id]
   * @param {string}  [data.description]
   * @param {string}  [data.notes]
   */
  createLandAsset: (data) => api.post('/projects/land-assets', data),

  /** PATCH /api/projects/land-assets/:id — pastor/elder only */
  updateLandAsset: (id, data) => api.patch(`/projects/land-assets/${id}`, data),

  // ── Land asset documents ──────────────────────────────────────────────────

  /**
   * POST /api/projects/land-assets/:id/documents — pastor/elder only
   * Land docs are confidential by default (§9).
   * @param {number} id  — land_asset id
   * @param {Object} data
   * @param {string}  data.title            — required
   * @param {string}  data.file_url         — required, R2 path/URL
   * @param {string}  [data.document_type]  — title_deed | survey_plan | boundary_map |
   *                                          lease_agreement | transfer_deed |
   *                                          valuation_report | other
   * @param {number}  [data.file_size_kb]
   * @param {string}  [data.mime_type]
   * @param {string}  [data.document_date]  — YYYY-MM-DD
   * @param {0|1}     [data.confidential]   — default 1
   */
  addLandAssetDocument: (id, data) =>
    api.post(`/projects/land-assets/${id}/documents`, data),

  /** DELETE /api/projects/land-assets/:id/documents/:docId — pastor/elder only */
  deleteLandAssetDocument: (id, docId) =>
    api.delete(`/projects/land-assets/${id}/documents/${docId}`),
};