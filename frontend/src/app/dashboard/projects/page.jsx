'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Search, SlidersHorizontal, FolderOpen,
  TrendingUp, CheckCircle2, Clock, PauseCircle,
  Building2, FileText, ChevronRight, MoreHorizontal,
  Trash2, Pencil, Eye,
} from 'lucide-react';
import { projectApi } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_META = {
  planning:  { label: 'Inapangwa',    badge: 'badge-navy',    dot: 'inactive' },
  active:    { label: 'Inaendelea',   badge: 'badge-success', dot: 'active'   },
  on_hold:   { label: 'Imesimamishwa',badge: 'badge-warning', dot: 'pending'  },
  completed: { label: 'Imekamilika',  badge: 'badge-gold',    dot: 'active'   },
  cancelled: { label: 'Imefutwa',     badge: 'badge-danger',  dot: 'danger'   },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, badge: 'badge-neutral' };
  return (
    <span className={`badge ${meta.badge}`}>
      <span className={`status-dot ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

// ─── Currency formatter ───────────────────────────────────────────────────────

function fmtTzs(val) {
  if (!val && val !== 0) return '—';
  return 'TShs ' + Number(val).toLocaleString('en-TZ', { maximumFractionDigits: 0 });
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, icon: Icon }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value ?? '—'}</p>
          {sub && <p className="text-xs text-neutral-500 mt-1">{sub}</p>}
        </div>
        {Icon && (
          <span className="w-9 h-9 rounded-lg bg-gold-50 flex items-center justify-center flex-shrink-0">
            <Icon size={18} className="text-gold-600" />
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, status }) {
  const fillClass =
    status === 'completed' ? 'progress-fill success' :
    status === 'cancelled' ? 'progress-fill danger'  : 'progress-fill';
  return (
    <div className="progress-bar flex-1" style={{ minWidth: 80 }}>
      <div className={fillClass} style={{ width: `${pct ?? 0}%` }} />
    </div>
  );
}

// ─── Row action menu ──────────────────────────────────────────────────────────

function RowMenu({ project, onDelete, canDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="btn btn-ghost btn-icon btn-sm"
        onClick={() => setOpen(v => !v)}
        aria-label="Vitendo"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="dropdown absolute right-0 top-9 z-20" style={{ minWidth: 160 }}>
            <Link
              href={`/projects/${project.id}`}
              className="menu-item"
              onClick={() => setOpen(false)}
            >
              <Eye size={14} /> Angalia
            </Link>
            <Link
              href={`/dashboard/projects/${project.id}/edit`}
              className="menu-item"
              onClick={() => setOpen(false)}
            >
              <Pencil size={14} /> Hariri
            </Link>
            {canDelete && (
              <>
                <div className="menu-separator" />
                <button
                  className="menu-item danger w-full"
                  onClick={() => { setOpen(false); onDelete(project); }}
                >
                  <Trash2 size={14} /> Futa
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { user } = useAuth();
  const isAdmin   = ['pastor', 'elder'].includes(user?.role);

  const [projects,  setProjects]  = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [meta,      setMeta]      = useState({ total: 0, page: 1, pages: 1 });
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    search: '', status: '', project_type: '', page: 1,
  });

  // Delete confirmation state
  const [delTarget, setDelTarget] = useState(null);
  const [deleting,  setDeleting]  = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, sumRes] = await Promise.all([
        projectApi.getAll(filters),
        projectApi.getSummary(),
      ]);
      setProjects(projRes.data.projects);
      setMeta(projRes.data.meta);
      setSummary(sumRes.data.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Filter handlers ───────────────────────────────────────────────────────

  const setFilter = (key, val) =>
    setFilters(f => ({ ...f, [key]: val, page: 1 }));

  const setPage = (p) => setFilters(f => ({ ...f, page: p }));

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      await projectApi.delete(delTarget.id);
      setDelTarget(null);
      fetchAll();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  // ── Derived summary numbers ────────────────────────────────────────────────

  const proj = summary?.projects ?? {};
  const land = summary?.land     ?? {};

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="page-header">
        <p className="page-header-eyebrow">§13 Miradi ya Usharika</p>
        <h1 className="page-header-title">Miradi</h1>
        <p className="page-header-subtitle">
          Usimamizi wa miradi ya ujenzi, miundombinu, na maendeleo ya kanisa.
        </p>
        <div className="page-header-actions">
          <Link href="/dashboard/projects/new" className="btn btn-primary">
            <Plus size={16} /> Mradi Mpya
          </Link>
          <Link href="/dashboard/projects/land-assets" className="btn btn-ghost-inverse">
            <Building2 size={15} /> Ardhi na Majengo
          </Link>
        </div>
      </div>

      <div className="page-body space-y-8">

        {/* ── Summary strip ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Miradi Yote"
            value={proj.total_projects ?? '—'}
            sub={`${proj.active_projects ?? 0} inaendelea`}
            icon={FolderOpen}
          />
          <SummaryCard
            label="Imekamilika"
            value={proj.completed_projects ?? '—'}
            sub={`${proj.planning_projects ?? 0} inapangwa`}
            icon={CheckCircle2}
          />
          <SummaryCard
            label="Maendeleo ya Wastani"
            value={proj.avg_progress_pct != null ? `${proj.avg_progress_pct}%` : '—'}
            sub="Miradi inayoendelea"
            icon={TrendingUp}
          />
          <SummaryCard
            label="Mali za Ardhi"
            value={land.total_assets ?? '—'}
            sub={`${land.land_count ?? 0} viwanja · ${land.building_count ?? 0} majengo`}
            icon={Building2}
          />
        </div>

        {/* ── Budget totals ───────────────────────────────────────────────── */}
        {isAdmin && proj.total_budget > 0 && (
          <div className="card">
            <div className="card-body">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="stat-label">Bajeti Yote</p>
                  <p className="text-xl font-semibold text-neutral-800 mt-0.5 font-display">
                    {fmtTzs(proj.total_budget)}
                  </p>
                </div>
                <div>
                  <p className="stat-label">Kilicholipwa</p>
                  <p className="text-xl font-semibold text-success mt-0.5 font-display">
                    {fmtTzs(proj.total_paid)}
                  </p>
                </div>
                <div>
                  <p className="stat-label">Kilichobaki</p>
                  <p className="text-xl font-semibold text-neutral-600 mt-0.5 font-display">
                    {fmtTzs((proj.total_budget ?? 0) - (proj.total_paid ?? 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="search-bar flex-1">
            <Search size={15} className="text-neutral-400 flex-shrink-0" />
            <input
              placeholder="Tafuta mradi..."
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
            />
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setShowFilters(v => !v)}
          >
            <SlidersHorizontal size={15} />
            Vichujio
            {(filters.status || filters.project_type) && (
              <span className="badge badge-gold ml-1">!</span>
            )}
          </button>
          <Link href="/dashboard/projects/new" className="btn btn-primary sm:hidden">
            <Plus size={15} /> Ongeza
          </Link>
        </div>

        {showFilters && (
          <div className="card">
            <div className="card-body">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="form-label">Hali</label>
                  <select
                    className="select"
                    value={filters.status}
                    onChange={e => setFilter('status', e.target.value)}
                  >
                    <option value="">Zote</option>
                    {Object.entries(STATUS_META).map(([v, m]) => (
                      <option key={v} value={v}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Aina ya Mradi</label>
                  <input
                    className="input"
                    placeholder="Ujenzi, Barabara..."
                    value={filters.project_type}
                    onChange={e => setFilter('project_type', e.target.value)}
                  />
                </div>
                <div className="form-group flex items-end">
                  <button
                    className="btn btn-ghost"
                    onClick={() => setFilters({ search: '', status: '', project_type: '', page: 1 })}
                  >
                    Futa vichujio
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Projects table / list ────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Orodha ya Miradi</h2>
              {!loading && (
                <p className="card-subtitle">{meta.total} mradi{meta.total !== 1 ? '' : ''}</p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="card-body space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-14 rounded-lg" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="empty-state">
              <FolderOpen className="empty-state-icon" />
              <p className="empty-state-title">Hakuna miradi</p>
              <p className="empty-state-body">
                {filters.search || filters.status
                  ? 'Hakuna miradi inayolingana na vichujio vyako.'
                  : 'Anza kwa kuongeza mradi wa kwanza wa kanisa.'}
              </p>
              <div className="empty-state-actions">
                <Link href="/dashboard/projects/new" className="btn btn-primary">
                  <Plus size={15} /> Mradi Mpya
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mradi</th>
                      <th>Aina</th>
                      <th>Hali</th>
                      <th>Maendeleo</th>
                      {isAdmin && <th>Bajeti</th>}
                      <th>Mikataba</th>
                      <th style={{ width: 48 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div>
                            <Link
                              href={`/dashboard/projects/${p.id}`}
                              className="font-medium text-neutral-800 hover:text-gold-600 transition-colors"
                            >
                              {p.name}
                            </Link>
                            {p.supervised_by_name && (
                              <p className="text-xs text-neutral-500 mt-0.5">
                                Msimamizi: {p.supervised_by_name}
                              </p>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="text-sm text-neutral-600">
                            {p.project_type || '—'}
                          </span>
                        </td>
                        <td><StatusBadge status={p.status} /></td>
                        <td>
                          <div className="flex items-center gap-2">
                            <ProgressBar pct={p.progress_pct} status={p.status} />
                            <span className="text-xs text-neutral-500 w-8 text-right flex-shrink-0">
                              {p.progress_pct ?? 0}%
                            </span>
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="text-sm text-neutral-700 font-mono">
                            {fmtTzs(p.budget)}
                          </td>
                        )}
                        <td>
                          <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <FileText size={13} />
                            {p.contract_count ?? 0}
                          </div>
                        </td>
                        <td>
                          <RowMenu
                            project={p}
                            onDelete={setDelTarget}
                            canDelete={isAdmin}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-neutral-100">
                {projects.map(p => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-3 px-4 py-4 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-neutral-800 text-sm truncate">
                          {p.name}
                        </span>
                        <StatusBadge status={p.status} />
                      </div>
                      {p.project_type && (
                        <p className="text-xs text-neutral-500 mt-0.5">{p.project_type}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <ProgressBar pct={p.progress_pct} status={p.status} />
                        <span className="text-xs text-neutral-500 flex-shrink-0">
                          {p.progress_pct ?? 0}%
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-neutral-300 flex-shrink-0" />
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {meta.pages > 1 && (
                <div className="card-footer flex items-center justify-between gap-4">
                  <p className="text-sm text-neutral-500">
                    Ukurasa {meta.page} kati ya {meta.pages}
                  </p>
                  <div className="pagination">
                    <button
                      className="page-btn"
                      disabled={meta.page <= 1}
                      onClick={() => setPage(meta.page - 1)}
                    >‹</button>
                    {[...Array(Math.min(meta.pages, 5))].map((_, i) => {
                      const pg = i + 1;
                      return (
                        <button
                          key={pg}
                          className={`page-btn ${pg === meta.page ? 'active' : ''}`}
                          onClick={() => setPage(pg)}
                        >{pg}</button>
                      );
                    })}
                    <button
                      className="page-btn"
                      disabled={meta.page >= meta.pages}
                      onClick={() => setPage(meta.page + 1)}
                    >›</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Delete confirmation modal ────────────────────────────────────────── */}
      {delTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDelTarget(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Futa Mradi</h3>
            </div>
            <div className="modal-body">
              <p className="text-sm text-neutral-600">
                Una uhakika unataka kufuta mradi{' '}
                <strong className="text-neutral-800">"{delTarget.name}"</strong>?
                Mikataba, malipo, picha, na nyaraka zote zitafutwa pamoja nao.
              </p>
              <div className="banner banner-danger mt-4">
                Kitendo hiki hakiwezi kutenduliwa.
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDelTarget(null)}
                disabled={deleting}
              >
                Ghairi
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Inafuta...' : 'Futa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}