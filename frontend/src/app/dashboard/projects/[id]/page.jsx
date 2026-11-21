'use client';

/**
 * ProjectDetailPage
 * ─────────────────
 * Route: /dashboard/projects/[id]
 *
 * Usage:
 *   <ProjectDetailPage projectId={params.id} />
 *
 * Covers:
 *   • Project header — name, type badge, status, progress
 *   • Key figures — budget, paid, remaining
 *   • Tabs: Overview | Contracts | Payments | Photos | Documents
 *   • Overview: dates, supervisor, land asset, notes
 *   • Contracts list with totals
 *   • Payments list paginated
 *   • Photo gallery grid
 *   • Documents list
 *   • Actions: edit, add contract, add payment
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Pencil, Plus, FileText, Image as ImageIcon,
  Banknote, Building2, CalendarDays, User, MapPin,
  CheckCircle2, Clock, PauseCircle, XCircle, AlertCircle,
  ChevronRight, Download, Eye, Trash2, MoreHorizontal,
} from 'lucide-react';

import { projectApi } from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  planning:  { label: 'Inapangwa',     badge: 'badge-navy',    icon: Clock         },
  active:    { label: 'Inaendelea',    badge: 'badge-success', icon: CheckCircle2  },
  on_hold:   { label: 'Imesimamishwa', badge: 'badge-warning', icon: PauseCircle   },
  completed: { label: 'Imekamilika',   badge: 'badge-success', icon: CheckCircle2  },
  cancelled: { label: 'Imefutwa',      badge: 'badge-danger',  icon: XCircle       },
};

const CONTRACT_STATUS_CONFIG = {
  draft:      { label: 'Rasimu',        badge: 'badge-navy'    },
  active:     { label: 'Inatekelezwa',  badge: 'badge-success' },
  completed:  { label: 'Imekamilika',   badge: 'badge-gold'    },
  terminated: { label: 'Imesimamishwa', badge: 'badge-danger'  },
  disputed:   { label: 'Mgogoro',       badge: 'badge-warning' },
};

const PAYMENT_TYPE_LABELS = {
  advance:   'Awali',
  interim:   'Kati',
  final:     'Mwisho',
  retention: 'Retention',
  variation: 'Variation',
  other:     'Nyingine',
};

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, badge: 'badge-navy' };
  const Icon = cfg.icon ?? Clock;
  return (
    <span className={`badge ${cfg.badge}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function ProgressRing({ pct }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const fill = circ - (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke="#F59E0B"
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={fill}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-semibold text-neutral-800">{pct}%</span>
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="form-label">{label}</span>
      <span className="text-sm text-neutral-800 font-medium">{children || '—'}</span>
    </div>
  );
}

function EmptyTab({ icon: Icon, title, body, action }) {
  return (
    <div className="empty-state">
      <Icon size={40} className="empty-state-icon" />
      <p className="empty-state-title">{title}</p>
      <p className="empty-state-body">{body}</p>
      {action && <div className="empty-state-actions">{action}</div>}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'overview',   label: 'Muhtasari',   icon: Building2  },
  { key: 'contracts',  label: 'Mikataba',    icon: FileText   },
  { key: 'payments',   label: 'Malipo',      icon: Banknote   },
  { key: 'photos',     label: 'Picha',       icon: ImageIcon  },
  { key: 'documents',  label: 'Nyaraka',     icon: FileText   },
];

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ project }) {
  return (
    <div className="space-y-6">

      {/* Dates */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Tarehe</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <InfoRow label="Tarehe ya Kuanza">
              {project.start_date
                ? <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-gold-600" />{fmtDate(project.start_date)}</span>
                : null}
            </InfoRow>
            <InfoRow label="Kukamilika (Iliyopangwa)">
              {project.expected_end_date
                ? <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-gold-600" />{fmtDate(project.expected_end_date)}</span>
                : null}
            </InfoRow>
            <InfoRow label="Kukamilika (Halisi)">
              {project.actual_end_date
                ? <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-success" />{fmtDate(project.actual_end_date)}</span>
                : null}
            </InfoRow>
          </div>
        </div>
      </div>

      {/* People + Location */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Msimamizi</h3>
          </div>
          <div className="card-body">
            {project.supervised_by_name ? (
              <div className="flex items-center gap-3">
                <div className="avatar avatar-md">
                  {project.supervised_by_name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{project.supervised_by_name}</p>
                  <p className="text-xs text-neutral-600 flex items-center gap-1 mt-0.5">
                    <User size={11} /> Msimamizi wa Mradi
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Haijateuliwa</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Eneo la Ardhi</h3>
          </div>
          <div className="card-body">
            {project.land_asset_name ? (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--gold-subtle)' }}>
                  <MapPin size={16} style={{ color: 'var(--gold-dark)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-800">{project.land_asset_name}</p>
                  {project.land_asset_area && (
                    <p className="text-xs text-neutral-600 mt-0.5">{project.land_asset_area}</p>
                  )}
                  {project.land_asset_plot && (
                    <p className="text-xs text-neutral-500 mt-0.5">Plot: {project.land_asset_plot}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Hakuna eneo lililounganishwa</p>
            )}
          </div>
        </div>
      </div>

      {/* Description + Notes */}
      {(project.description || project.notes) && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Maelezo</h3>
          </div>
          <div className="card-body space-y-4">
            {project.description && (
              <div>
                <p className="form-label mb-1">Kwa Ufupi</p>
                <p className="text-sm text-neutral-700 leading-relaxed prose-full">{project.description}</p>
              </div>
            )}
            {project.notes && (
              <div>
                <p className="form-label mb-1">Maelezo ya Ziada</p>
                <p className="text-sm text-neutral-700 leading-relaxed prose-full">{project.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Contracts ───────────────────────────────────────────────────────────

function ContractsTab({ contracts, projectId, canEdit }) {
  if (!contracts.length) {
    return (
      <EmptyTab
        icon={FileText}
        title="Hakuna mikataba bado"
        body="Ongeza mkataba wa kwanza wa mradi huu."
        action={canEdit && (
          <Link href={`/dashboard/projects/${projectId}/contracts/new`} className="btn btn-primary btn-sm">
            <Plus size={14} /> Ongeza Mkataba
          </Link>
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Link href={`/dashboard/projects/${projectId}/contracts/new`} className="btn btn-primary btn-sm">
            <Plus size={14} /> Mkataba Mpya
          </Link>
        </div>
      )}

      {contracts.map(c => {
        const cfg = CONTRACT_STATUS_CONFIG[c.contract_status] ?? { label: c.contract_status, badge: 'badge-navy' };
        const paidPct = c.contract_value > 0 ? Math.min(100, Math.round((c.total_paid / c.contract_value) * 100)) : 0;
        return (
          <div key={c.id} className="card">
            <div className="card-header">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                  {c.contract_number && (
                    <span className="text-xs text-neutral-500 font-mono">{c.contract_number}</span>
                  )}
                </div>
                <h4 className="text-base font-semibold text-neutral-800 mt-1 leading-snug">{c.title}</h4>
                {c.contractor_name && (
                  <p className="text-xs text-neutral-500 mt-0.5">{c.contractor_name}</p>
                )}
              </div>
              {canEdit && (
                <Link
                  href={`/dashboard/projects/${projectId}/contracts/${c.id}`}
                  className="btn btn-secondary btn-sm flex-shrink-0"
                >
                  Angalia <ChevronRight size={13} />
                </Link>
              )}
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="form-label">Thamani</p>
                  <p className="text-sm font-semibold text-neutral-800">{fmt(c.contract_value)}</p>
                </div>
                {c.revised_value && (
                  <div>
                    <p className="form-label">Iliyorekebishwa</p>
                    <p className="text-sm font-semibold text-gold-700">{fmt(c.revised_value)}</p>
                  </div>
                )}
                <div>
                  <p className="form-label">Imelipwa</p>
                  <p className="text-sm font-semibold text-success">{fmt(c.total_paid)}</p>
                </div>
                {c.variation_count > 0 && (
                  <div>
                    <p className="form-label">Variations</p>
                    <p className="text-sm font-semibold text-neutral-800">{c.variation_count}</p>
                  </div>
                )}
              </div>

              {/* Payment progress bar */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-neutral-500">Maendeleo ya malipo</span>
                  <span className="text-xs font-semibold text-neutral-700">{paidPct}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${paidPct}%` }} />
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
                {c.signed_date    && <span>Ilisainiwa: {fmtShort(c.signed_date)}</span>}
                {c.start_date     && <span>Ilianza: {fmtShort(c.start_date)}</span>}
                {c.expected_end_date && <span>Itakamilika: {fmtShort(c.expected_end_date)}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Payments ────────────────────────────────────────────────────────────

function PaymentsTab({ projectId, canEdit }) {
  const [payments, setPayments]   = useState([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [meta, setMeta]           = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await projectApi.listPayments(projectId, { page: p, limit: 15 });
      setPayments(res.data.payments ?? []);
      setGrandTotal(res.data.grand_total ?? 0);
      setMeta(res.data.meta ?? { total: 0, page: p, pages: 1 });
    } catch {}
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(page); }, [page, load]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
      </div>
    );
  }

  if (!payments.length) {
    return (
      <EmptyTab
        icon={Banknote}
        title="Hakuna malipo bado"
        body="Rekodi ya kwanza ya malipo bado haijaingizwa."
        action={canEdit && (
          <Link href={`/dashboard/projects/${projectId}/payments/new`} className="btn btn-primary btn-sm">
            <Plus size={14} /> Rekodi Malipo
          </Link>
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="card card-navy">
        <div className="card-body">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Jumla Imelipwa</p>
              <p className="text-2xl font-bold text-white font-display">{fmt(grandTotal)}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-white/50 uppercase tracking-widest mb-1">Rekodi</p>
                <p className="text-lg font-semibold text-white">{meta.total}</p>
              </div>
              {canEdit && (
                <Link href={`/dashboard/projects/${projectId}/payments/new`} className="btn btn-primary btn-sm">
                  <Plus size={14} /> Ongeza
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarehe</th>
                <th>Aina</th>
                <th>Risiti</th>
                <th>Mkataba</th>
                <th className="text-right">Kiasi</th>
                <th>Idhinisho</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{fmtShort(p.payment_date)}</td>
                  <td>
                    <span className="badge badge-navy">{PAYMENT_TYPE_LABELS[p.payment_type] ?? p.payment_type}</span>
                  </td>
                  <td className="font-mono text-xs text-neutral-600">{p.receipt_number || '—'}</td>
                  <td className="text-sm text-neutral-600 max-w-xs truncate">{p.contract_title || '—'}</td>
                  <td className="text-right font-semibold text-neutral-800 whitespace-nowrap">{fmt(p.amount)}</td>
                  <td className="text-sm text-neutral-600">{p.approved_by_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.pages > 1 && (
          <div className="card-footer flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              Ukurasa {meta.page} ya {meta.pages} ({meta.total} rekodi)
            </span>
            <div className="pagination">
              <button className="page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                ‹
              </button>
              {[...Array(meta.pages)].map((_, i) => (
                <button
                  key={i + 1}
                  className={`page-btn ${meta.page === i + 1 ? 'active' : ''}`}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button className="page-btn" disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)}>
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Photos ──────────────────────────────────────────────────────────────

function PhotosTab({ projectId, canEdit }) {
  const [photos, setPhotos] = useState([]);
  const [meta, setMeta]     = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    projectApi.listPhotos(projectId, { limit: 50 })
      .then(res => {
        setPhotos(res.data.photos ?? []);
        setMeta(res.data.meta ?? {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {[...Array(8)].map((_, i) => <div key={i} className="skeleton rounded-lg aspect-square" />)}
      </div>
    );
  }

  if (!photos.length) {
    return (
      <EmptyTab
        icon={ImageIcon}
        title="Hakuna picha bado"
        body="Picha za maendeleo bado hazijaongezwa."
        action={canEdit && (
          <Link href={`/dashboard/projects/${projectId}/edit`} className="btn btn-primary btn-sm">
            <Plus size={14} /> Ongeza Picha
          </Link>
        )}
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((ph, i) => (
          <button
            key={ph.id}
            type="button"
            className="relative rounded-xl overflow-hidden aspect-square group cursor-pointer"
            style={{ background: 'var(--border-subtle)' }}
            onClick={() => setLightbox(ph)}
          >
            <img
              src={ph.thumbnail_url ?? ph.file_url}
              alt={ph.caption ?? `Picha ${i + 1}`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <Eye size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {ph.progress_pct_at_photo != null && (
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50">
                <div className="progress-bar" style={{ height: 3 }}>
                  <div className="progress-fill" style={{ width: `${ph.progress_pct_at_photo}%`, height: 3 }} />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="modal-overlay"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative max-w-3xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={lightbox.file_url}
              alt={lightbox.caption}
              className="w-full rounded-2xl"
              style={{ maxHeight: '80vh', objectFit: 'contain' }}
            />
            <div className="mt-3 flex items-start justify-between gap-4">
              <div>
                {lightbox.caption && (
                  <p className="text-white font-medium text-sm">{lightbox.caption}</p>
                )}
                {lightbox.taken_date && (
                  <p className="text-white/50 text-xs mt-0.5">{fmtDate(lightbox.taken_date)}</p>
                )}
              </div>
              {lightbox.progress_pct_at_photo != null && (
                <span className="badge badge-gold flex-shrink-0">
                  {lightbox.progress_pct_at_photo}% ilipigwa
                </span>
              )}
            </div>
            <button
              className="btn btn-ghost-inverse btn-sm absolute top-2 right-2"
              onClick={() => setLightbox(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Tab: Documents ───────────────────────────────────────────────────────────

function DocumentsTab({ projectId, canEdit }) {
  const [docs, setDocs]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectApi.listDocuments(projectId)
      .then(res => setDocs(res.data.documents ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}
      </div>
    );
  }

  if (!docs.length) {
    return (
      <EmptyTab
        icon={FileText}
        title="Hakuna nyaraka bado"
        body="PDF, mikataba, vibali na nyaraka nyingine zitaonekana hapa."
        action={canEdit && (
          <Link href={`/dashboard/projects/${projectId}/documents/new`} className="btn btn-primary btn-sm">
            <Plus size={14} /> Ongeza Nyaraka
          </Link>
        )}
      />
    );
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <Link href={`/dashboard/projects/${projectId}/documents/new`} className="btn btn-secondary btn-sm">
            <Plus size={14} /> Ongeza Nyaraka
          </Link>
        </div>
      )}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Jina</th>
                <th>Aina</th>
                <th>Tarehe</th>
                <th>Ukubwa</th>
                <th>Siri</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id}>
                  <td>
                    <p className="text-sm font-medium text-neutral-800">{d.title}</p>
                    {d.reference_number && (
                      <p className="text-xs text-neutral-500 font-mono mt-0.5">{d.reference_number}</p>
                    )}
                  </td>
                  <td><span className="badge badge-navy">{d.document_type}</span></td>
                  <td className="text-sm text-neutral-600 whitespace-nowrap">{fmtShort(d.document_date)}</td>
                  <td className="text-xs text-neutral-500">{d.file_size_kb ? `${d.file_size_kb} KB` : '—'}</td>
                  <td>
                    {d.confidential
                      ? <span className="badge badge-warning">Siri</span>
                      : <span className="badge badge-navy">Wazi</span>}
                  </td>
                  <td>
                    <a
                      href={d.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm btn-icon"
                      title="Pakua"
                    >
                      <Download size={14} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage({ projectId }) {
  const router       = useRouter();
  const { user }     = useAuth();
  const [project, setProject]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError]       = useState('');

  const canEdit = user && ['pastor', 'elder'].includes(user.role);

  useEffect(() => {
    projectApi.getById(projectId)
      .then(res => setProject(res.data.project))
      .catch(() => setError('Hitilafu wakati wa kupakia mradi.'))
      .finally(() => setLoading(false));
  }, [projectId]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="page-header">
          <div className="skeleton h-4 w-32 rounded mb-3" />
          <div className="skeleton h-8 w-64 rounded mb-2" />
          <div className="skeleton h-4 w-48 rounded" />
        </div>
        <div className="page-body space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
          </div>
          <div className="skeleton h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="page-header">
          <p className="page-header-eyebrow">§13 Miradi ya Usharika</p>
          <h1 className="page-header-title">Mradi Haupatikani</h1>
        </div>
        <div className="page-body">
          <div className="banner banner-danger">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Hitilafu</p>
              <p className="text-sm mt-0.5">{error || 'Mradi haukupatikana.'}</p>
            </div>
          </div>
          <Link href="/dashboard/projects" className="btn btn-secondary mt-4">
            <ArrowLeft size={15} /> Rudi kwenye Orodha
          </Link>
        </div>
      </div>
    );
  }

  const remaining = (project.budget ?? 0) - (project.total_paid ?? 0);
  const paidPct   = project.budget > 0
    ? Math.min(100, Math.round((project.total_paid / project.budget) * 100))
    : 0;
  const statusCfg = STATUS_CONFIG[project.status] ?? { label: project.status, badge: 'badge-navy' };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="page-header">
        <p className="page-header-eyebrow">§13 Miradi ya Usharika</p>

        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusBadge status={project.status} />
              {project.project_type && (
                <span className="badge badge-gold">{project.project_type}</span>
              )}
            </div>
            <h1 className="page-header-title">{project.name}</h1>
            {project.description && (
              <p className="page-header-subtitle">{project.description}</p>
            )}
          </div>

          {/* Progress ring — visible in header */}
          <div className="flex-shrink-0">
            <ProgressRing pct={project.progress_pct ?? 0} />
          </div>
        </div>

        <div className="page-header-actions">
          <Link href="/dashboard/projects" className="btn btn-ghost-inverse btn-sm">
            <ArrowLeft size={14} /> Rudi
          </Link>
          {canEdit && (
            <Link
              href={`/dashboard/projects/${projectId}/edit`}
              className="btn btn-primary btn-sm"
            >
              <Pencil size={14} /> Hariri
            </Link>
          )}
          {canEdit && (
            <Link
              href={`/dashboard/projects/${projectId}/contracts/new`}
              className="btn btn-ghost-inverse btn-sm"
            >
              <Plus size={14} /> Mkataba
            </Link>
          )}
        </div>
      </div>

      {/* ── Page body ──────────────────────────────────────────────────────── */}
      <div className="page-body space-y-6">

        {/* ── Financial summary cards ─────────────────────────────────────── */}
        {project.budget != null && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card">
              <p className="stat-label">Bajeti ya Mradi</p>
              <p className="stat-value">{fmt(project.budget)}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Imelipwa</p>
              <p className="stat-value" style={{ color: 'var(--success)' }}>
                {fmt(project.total_paid)}
              </p>
              <div className="mt-3 progress-bar">
                <div className="progress-fill success" style={{ width: `${paidPct}%` }} />
              </div>
              <p className="text-xs text-neutral-500 mt-1">{paidPct}% ya bajeti</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Iliyobaki</p>
              <p className="stat-value" style={{ color: remaining < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {fmt(Math.abs(remaining))}
              </p>
              {remaining < 0 && (
                <span className="badge badge-danger mt-2">Imezidi bajeti</span>
              )}
            </div>
          </div>
        )}

        {/* Sub-counts */}
        <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
          {project.contract_count > 0 && (
            <span className="flex items-center gap-1.5">
              <FileText size={14} className="text-neutral-400" />
              {project.contract_count} {project.contract_count === 1 ? 'mkataba' : 'mikataba'}
            </span>
          )}
          {project.payment_count > 0 && (
            <span className="flex items-center gap-1.5">
              <Banknote size={14} className="text-neutral-400" />
              {project.payment_count} malipo
            </span>
          )}
          {project.photo_count > 0 && (
            <span className="flex items-center gap-1.5">
              <ImageIcon size={14} className="text-neutral-400" />
              {project.photo_count} {project.photo_count === 1 ? 'picha' : 'picha'}
            </span>
          )}
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div>
          {/* Tab bar */}
          <div className="tabs scrollbar-thin overflow-x-auto">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`tab ${activeTab === t.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  <Icon size={15} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab panels */}
          <div className="mt-5">
            {activeTab === 'overview'  && <OverviewTab project={project} />}
            {activeTab === 'contracts' && (
              <ContractsTab
                contracts={project.contracts ?? []}
                projectId={projectId}
                canEdit={canEdit}
              />
            )}
            {activeTab === 'payments'  && <PaymentsTab projectId={projectId} canEdit={canEdit} />}
            {activeTab === 'photos'    && <PhotosTab projectId={projectId} canEdit={canEdit} />}
            {activeTab === 'documents' && <DocumentsTab projectId={projectId} canEdit={canEdit} />}
          </div>
        </div>
      </div>
    </div>
  );
}