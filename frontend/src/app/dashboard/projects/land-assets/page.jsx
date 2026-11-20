'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Search, SlidersHorizontal, Building2,
  MapPin, FileText, Layers, ChevronRight,
  MoreHorizontal, Pencil, Eye, Landmark,
  CheckSquare, Clock, AlertCircle,
} from 'lucide-react';
import { projectApi } from '../../../../lib/api';
import { useAuth } from '../../../../hooks/useAuth';

// ─── Lookup tables ────────────────────────────────────────────────────────────

const ASSET_TYPE_META = {
  land:     { label: 'Ardhi / Kiwanja', badge: 'badge-navy',    icon: MapPin   },
  building: { label: 'Jengo',           badge: 'badge-gold',    icon: Building2 },
  both:     { label: 'Ardhi na Jengo',  badge: 'badge-success', icon: Layers   },
};

const OWNERSHIP_META = {
  owned:      { label: 'Miliki Kamili', badge: 'badge-success', dot: 'active'  },
  leased:     { label: 'Kwa Pango',     badge: 'badge-warning', dot: 'pending' },
  in_process: { label: 'Inaendelea',   badge: 'badge-neutral', dot: 'inactive'},
};

// ─── Badge components ─────────────────────────────────────────────────────────

function AssetTypeBadge({ type }) {
  const meta = ASSET_TYPE_META[type] || { label: type, badge: 'badge-neutral' };
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}

function OwnershipBadge({ status }) {
  const meta = OWNERSHIP_META[status] || { label: status, badge: 'badge-neutral', dot: 'inactive' };
  return (
    <span className={`badge ${meta.badge}`}>
      <span className={`status-dot ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

// ─── Currency / number formatters ─────────────────────────────────────────────

function fmtTzs(val) {
  if (!val && val !== 0) return '—';
  return 'TShs ' + Number(val).toLocaleString('en-TZ', { maximumFractionDigits: 0 });
}

function fmtSqm(val) {
  if (!val) return '—';
  return Number(val).toLocaleString('en-TZ', { maximumFractionDigits: 1 }) + ' m²';
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

// ─── Row action menu ──────────────────────────────────────────────────────────

function RowMenu({ asset, canEdit }) {
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
              href={`/dashboard/projects/land-assets/${asset.id}`}
              className="menu-item"
              onClick={() => setOpen(false)}
            >
              <Eye size={14} /> Angalia
            </Link>
            {canEdit && (
              <Link
                href={`/dashboard/projects/land-assets/${asset.id}/edit`}
                className="menu-item"
                onClick={() => setOpen(false)}
              >
                <Pencil size={14} /> Hariri
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LandAssetsPage() {
  const { user } = useAuth();
  const isAdmin = ['pastor', 'elder'].includes(user?.role);

  const [assets,      setAssets]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [meta,        setMeta]        = useState({ total: 0, page: 1, pages: 1 });
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    search: '', asset_type: '', ownership_status: '', page: 1,
  });

  // ── Derived totals from loaded assets (lightweight; no extra endpoint) ──────
  const [counts, setCounts] = useState({ land: 0, building: 0, both: 0, owned: 0 });

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await projectApi.getLandAssets(filters);
      const data = res.data;
      setAssets(data.assets);
      setMeta(data.meta);

      // Build quick counts from the current full page (approximate but fast)
      const c = { land: 0, building: 0, both: 0, owned: 0 };
      (data.assets || []).forEach(a => {
        if (a.asset_type === 'land')     c.land++;
        if (a.asset_type === 'building') c.building++;
        if (a.asset_type === 'both')     c.both++;
        if (a.ownership_status === 'owned') c.owned++;
      });
      setCounts(c);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  // ── Filter handlers ───────────────────────────────────────────────────────

  const setFilter = (key, val) =>
    setFilters(f => ({ ...f, [key]: val, page: 1 }));

  const setPage = (p) =>
    setFilters(f => ({ ...f, page: p }));

  const hasActiveFilters =
    filters.asset_type || filters.ownership_status || filters.search;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="page-header">
        <p className="page-header-eyebrow">§9 Ardhi na Majengo</p>
        <h1 className="page-header-title">Mali za Ardhi</h1>
        <p className="page-header-subtitle">
          Rejista ya viwanja, majengo, na mali zote za ardhi za usharika.
        </p>
        <div className="page-header-actions">
          {isAdmin && (
            <Link href="/dashboard/projects/land-assets/new" className="btn btn-primary">
              <Plus size={16} /> Mali Mpya
            </Link>
          )}
          <Link href="/dashboard/projects" className="btn btn-ghost-inverse">
            <Layers size={15} /> Miradi
          </Link>
        </div>
      </div>

      <div className="page-body space-y-8">

        {/* ── Summary strip ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Mali Zote"
            value={meta.total || '—'}
            sub="Viwanja na majengo"
            icon={Landmark}
          />
          <SummaryCard
            label="Viwanja"
            value={counts.land + counts.both || '—'}
            sub={`${counts.both} ardhi na jengo`}
            icon={MapPin}
          />
          <SummaryCard
            label="Majengo"
            value={counts.building || '—'}
            sub="Majengo peke yake"
            icon={Building2}
          />
          <SummaryCard
            label="Miliki Kamili"
            value={counts.owned || '—'}
            sub="Hati zilizoandikishwa"
            icon={CheckSquare}
          />
        </div>

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="search-bar flex-1">
            <Search size={15} className="text-neutral-400 flex-shrink-0" />
            <input
              placeholder="Tafuta jina, eneo, au namba ya kiwanja..."
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
            {(filters.asset_type || filters.ownership_status) && (
              <span className="badge badge-gold ml-1">!</span>
            )}
          </button>
          {isAdmin && (
            <Link
              href="/dashboard/projects/land-assets/new"
              className="btn btn-primary sm:hidden"
            >
              <Plus size={15} /> Ongeza
            </Link>
          )}
        </div>

        {showFilters && (
          <div className="card">
            <div className="card-body">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="form-label">Aina ya Mali</label>
                  <select
                    className="select"
                    value={filters.asset_type}
                    onChange={e => setFilter('asset_type', e.target.value)}
                  >
                    <option value="">Zote</option>
                    {Object.entries(ASSET_TYPE_META).map(([v, m]) => (
                      <option key={v} value={v}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Hali ya Umiliki</label>
                  <select
                    className="select"
                    value={filters.ownership_status}
                    onChange={e => setFilter('ownership_status', e.target.value)}
                  >
                    <option value="">Zote</option>
                    {Object.entries(OWNERSHIP_META).map(([v, m]) => (
                      <option key={v} value={v}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group flex items-end">
                  <button
                    className="btn btn-ghost"
                    onClick={() =>
                      setFilters({ search: '', asset_type: '', ownership_status: '', page: 1 })
                    }
                  >
                    Futa vichujio
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Main table ───────────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Rejista ya Mali za Ardhi</h2>
              {!loading && (
                <p className="card-subtitle">
                  Mali {meta.total} zimeandikishwa
                </p>
              )}
            </div>
          </div>

          {/* ── Loading ── */}
          {loading ? (
            <div className="card-body space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton h-14 rounded-lg" />
              ))}
            </div>

          /* ── Empty ── */
          ) : assets.length === 0 ? (
            <div className="empty-state">
              <Building2 className="empty-state-icon" />
              <p className="empty-state-title">Hakuna mali zilizopatikana</p>
              <p className="empty-state-body">
                {hasActiveFilters
                  ? 'Hakuna mali zinazolingana na vichujio vyako. Jaribu kutafuta tena.'
                  : 'Anza kwa kuongeza kiwanja au jengo la kwanza la usharika.'}
              </p>
              {isAdmin && !hasActiveFilters && (
                <div className="empty-state-actions">
                  <Link href="/dashboard/projects/land-assets/new" className="btn btn-primary">
                    <Plus size={15} /> Mali Mpya
                  </Link>
                </div>
              )}
            </div>

          /* ── Data ── */
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Jina la Mali</th>
                      <th>Aina</th>
                      <th>Umiliki</th>
                      <th>Eneo</th>
                      <th>Ukubwa</th>
                      {isAdmin && <th>Thamani</th>}
                      <th>Miradi</th>
                      <th>Nyaraka</th>
                      <th style={{ width: 48 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map(a => {
                      const TypeIcon = ASSET_TYPE_META[a.asset_type]?.icon || Building2;
                      return (
                        <tr key={a.id}>
                          {/* Name */}
                          <td>
                            <div>
                              <Link
                                href={`/dashboard/projects/land-assets/${a.id}`}
                                className="font-medium text-neutral-800 hover:text-gold-600 transition-colors"
                              >
                                {a.name}
                              </Link>
                              {a.plot_number && (
                                <p className="text-xs text-neutral-500 mt-0.5">
                                  Plot: {a.plot_number}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Asset type */}
                          <td><AssetTypeBadge type={a.asset_type} /></td>

                          {/* Ownership */}
                          <td><OwnershipBadge status={a.ownership_status} /></td>

                          {/* Location */}
                          <td>
                            <div className="flex items-center gap-1.5 text-sm text-neutral-600">
                              {a.area_name ? (
                                <>
                                  <MapPin size={12} className="text-neutral-400 flex-shrink-0" />
                                  <span>{a.area_name}{a.region ? `, ${a.region}` : ''}</span>
                                </>
                              ) : '—'}
                            </div>
                          </td>

                          {/* Area */}
                          <td className="text-sm text-neutral-600">
                            {fmtSqm(a.area_sqm)}
                          </td>

                          {/* Valuation (admin only) */}
                          {isAdmin && (
                            <td className="text-sm text-neutral-700 font-mono">
                              {fmtTzs(a.valuation)}
                            </td>
                          )}

                          {/* Linked projects */}
                          <td>
                            {a.linked_project_count > 0 ? (
                              <span className="badge badge-navy">
                                {a.linked_project_count} mradi{a.linked_project_count !== 1 ? '' : ''}
                              </span>
                            ) : (
                              <span className="text-xs text-neutral-400">—</span>
                            )}
                          </td>

                          {/* Documents */}
                          <td>
                            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                              <FileText size={13} />
                              {a.document_count ?? 0}
                            </div>
                          </td>

                          {/* Actions */}
                          <td>
                            <RowMenu asset={a} canEdit={isAdmin} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-neutral-100">
                {assets.map(a => (
                  <Link
                    key={a.id}
                    href={`/dashboard/projects/land-assets/${a.id}`}
                    className="flex items-center gap-3 px-4 py-4 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-neutral-800 text-sm truncate">
                          {a.name}
                        </span>
                        <AssetTypeBadge type={a.asset_type} />
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <OwnershipBadge status={a.ownership_status} />
                        {a.area_name && (
                          <span className="text-xs text-neutral-500 flex items-center gap-1">
                            <MapPin size={11} />
                            {a.area_name}
                          </span>
                        )}
                      </div>
                      {a.plot_number && (
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Plot {a.plot_number}
                          {a.area_sqm ? ` · ${fmtSqm(a.area_sqm)}` : ''}
                        </p>
                      )}
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

        {/* ── Ownership status legend ──────────────────────────────────────── */}
        <div className="card">
          <div className="card-body">
            <p className="text-xs font-medium text-neutral-500 mb-3">Maelezo ya Hali</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(OWNERSHIP_META).map(([key, m]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className={`badge ${m.badge}`}>
                    <span className={`status-dot ${m.dot}`} />
                    {m.label}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {key === 'owned'      && '— Hati miliki kamili ipo'}
                    {key === 'leased'     && '— Kupangwa kwa muda'}
                    {key === 'in_process' && '— Hati inaendelea kuandaliwa'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}