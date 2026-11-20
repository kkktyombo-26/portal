'use client';

/**
 * ProjectFormPage
 * ───────────────
 * Handles both:
 *   /projects/new          → create
 *   /projects/[id]/edit    → update
 *
 * Usage (new):
 *   <ProjectFormPage />
 *
 * Usage (edit):
 *   <ProjectFormPage projectId={params.id} />
 *
 * What it covers:
 *   • Core project fields (§13)
 *   • Progress photo upload via R2 (one photo per session — more can be added
 *     from the detail page after creation)
 *   • Supervisor + land asset selects (FK lookups)
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, Upload, X, ImagePlus,
  AlertCircle, CheckCircle2,
} from 'lucide-react';

import { userApi, projectApi } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { R2UploadService } from '../../lib/r2UploadService';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROJECT_TYPES = [
  'Ujenzi', 'Ukarabati', 'Barabara', 'Mifereji', 'Uzio',
  'Umeme', 'Maji', 'Ofisi', 'Nyingine',
];

const STATUS_OPTIONS = [
  { value: 'planning',  label: 'Inapangwa'     },
  { value: 'active',    label: 'Inaendelea'    },
  { value: 'on_hold',   label: 'Imesimamishwa' },
  { value: 'completed', label: 'Imekamilika'   },
  { value: 'cancelled', label: 'Imefutwa'      },
];

const EMPTY_FORM = {
  name:              '',
  description:       '',
  project_type:      '',
  status:            'planning',
  progress_pct:      0,
  start_date:        '',
  expected_end_date: '',
  actual_end_date:   '',
  budget:            '',
  supervised_by_id:  '',
  land_asset_id:     '',
  notes:             '',
};

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className={`toast ${type}`}>
      {type === 'success'
        ? <CheckCircle2 size={16} className="text-success flex-shrink-0" />
        : <AlertCircle  size={16} className="text-danger  flex-shrink-0" />}
      <span className="flex-1 text-sm">{message}</span>
      <button onClick={onDismiss} className="text-white/60 hover:text-white ml-2">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Photo upload widget ──────────────────────────────────────────────────────

function PhotoUpload({ photos, onAdd, onRemove }) {
  const inputRef   = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [error,     setError]     = useState('');

  const handleFiles = async (files) => {
    const file = files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Tafadhali chagua picha (JPG, PNG, WebP).');
      return;
    }
    setError('');
    setUploading(true);
    setProgress(0);
    try {
      const result = await R2UploadService.uploadFromFile({
        file,
        folder: 'projects/photos',
        onProgress: setProgress,
      });
      onAdd({
        file_url:      result.secureUrl,
        thumbnail_url: result.secureUrl,
        mime_type:     result.mimeType,
        file_size_kb:  Math.round(file.size / 1024),
        caption:       '',
        taken_date:    new Date().toISOString().split('T')[0],
        progress_pct_at_photo: 0,
      });
    } catch (err) {
      setError('Upakiaji umeshindwa. Jaribu tena.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {photos.map((ph, i) => (
          <div
            key={i}
            className="relative rounded-lg overflow-hidden border border-neutral-200 flex-shrink-0"
            style={{ width: 100, height: 100 }}
          >
            <img
              src={ph.file_url}
              alt={ph.caption || `Picha ${i + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-danger transition-colors"
              aria-label="Ondoa picha"
            >
              <X size={10} className="text-white" />
            </button>
          </div>
        ))}

        {/* Upload button */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="relative rounded-lg border-2 border-dashed border-neutral-300 hover:border-gold-400 transition-colors flex flex-col items-center justify-center gap-1 text-neutral-400 hover:text-gold-600 flex-shrink-0"
          style={{ width: 100, height: 100 }}
        >
          {uploading ? (
            <>
              <div className="w-10 h-1.5 progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-2xs">{progress}%</span>
            </>
          ) : (
            <>
              <ImagePlus size={22} />
              <span className="text-2xs font-medium">Pakia picha</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {error && (
        <p className="form-error flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      {/* Caption fields */}
      {photos.map((ph, i) => (
        <div key={i} className="grid grid-cols-2 gap-3">
          <div className="form-group">
            <label className="form-label">Maelezo ya Picha {i + 1}</label>
            <input
              className="input input-sm"
              placeholder="Hiari..."
              value={ph.caption}
              onChange={e => {
                const updated = [...photos];
                updated[i] = { ...ph, caption: e.target.value };
                onAdd(updated, true); // true = replace all
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Maendeleo wakati wa picha</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0} max={100} step={5}
                className="flex-1"
                value={ph.progress_pct_at_photo}
                onChange={e => {
                  const updated = [...photos];
                  updated[i] = { ...ph, progress_pct_at_photo: Number(e.target.value) };
                  onAdd(updated, true);
                }}
              />
              <span className="text-xs text-neutral-500 w-8 text-right">
                {ph.progress_pct_at_photo}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function ProjectFormPage({ projectId }) {
  const router = useRouter();
  const { user } = useAuth();
  const isEdit = Boolean(projectId);

  const [form,       setForm]       = useState(EMPTY_FORM);
  const [photos,     setPhotos]     = useState([]);
  const [members,    setMembers]    = useState([]);
  const [landAssets, setLandAssets] = useState([]);
  const [loading,    setLoading]    = useState(isEdit);
  const [saving,     setSaving]     = useState(false);
  const [errors,     setErrors]     = useState({});
  const [toast,      setToast]      = useState(null);

  // ── Load lookups + existing project ────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        const [membersRes, assetsRes] = await Promise.all([
          userApi.getMembers({ limit: 200 }),
          projectApi.getLandAssets({ limit: 200 }),
        ]);
        setMembers(membersRes.data.members ?? membersRes.data ?? []);
        setLandAssets(assetsRes.data.assets ?? []);

        if (isEdit) {
          const res = await projectApi.getById(projectId);
          const p   = res.data.project;
          setForm({
            name:              p.name              ?? '',
            description:       p.description       ?? '',
            project_type:      p.project_type      ?? '',
            status:            p.status            ?? 'planning',
            progress_pct:      p.progress_pct      ?? 0,
            start_date:        p.start_date        ?? '',
            expected_end_date: p.expected_end_date ?? '',
            actual_end_date:   p.actual_end_date   ?? '',
            budget:            p.budget            ?? '',
            supervised_by_id:  p.supervised_by_id  ?? '',
            land_asset_id:     p.land_asset_id     ?? '',
            notes:             p.notes             ?? '',
          });
        }
      } catch (err) {
        console.error(err);
        setToast({ message: 'Hitilafu wakati wa kupakia data.', type: 'danger' });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [projectId, isEdit]);

  // ── Field helpers ─────────────────────────────────────────────────────────

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }));
  };

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = () => {
    const errs = {};
    if (!form.name.trim())
      errs.name = 'Jina la mradi linahitajika.';
    if (form.budget && isNaN(Number(form.budget)))
      errs.budget = 'Bajeti lazima iwe namba.';
    if (form.progress_pct < 0 || form.progress_pct > 100)
      errs.progress_pct = 'Maendeleo lazima yawe kati ya 0 na 100.';
    return errs;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        budget:           form.budget ? Number(form.budget) : null,
        supervised_by_id: form.supervised_by_id || null,
        land_asset_id:    form.land_asset_id    || null,
        progress_pct:     Number(form.progress_pct),
        start_date:        form.start_date        || null,
        expected_end_date: form.expected_end_date || null,
        actual_end_date:   form.actual_end_date   || null,
      };

      let pid = projectId;

      if (isEdit) {
        await projectApi.update(projectId, payload);
      } else {
        const res = await projectApi.create(payload);
        pid = res.data.project_id;
      }

      // Upload any photos collected during the form session
      if (photos.length) {
        await Promise.all(
          photos.map(ph => projectApi.addPhoto(pid, ph))
        );
      }

      setToast({ message: isEdit ? 'Mradi umesasishwa.' : 'Mradi umeundwa.', type: 'success' });
      setTimeout(() => router.push(`/dashboard/projects/${pid}`), 1200);
    } catch (err) {
      setToast({ message: err.message || 'Hitilafu. Jaribu tena.', type: 'danger' });
    } finally {
      setSaving(false);
    }
  };

  // ── Photo handlers ────────────────────────────────────────────────────────

  const handleAddPhoto = (phOrAll, replace = false) => {
    if (replace) { setPhotos(phOrAll); return; }
    setPhotos(prev => [...prev, phOrAll]);
  };

  const handleRemovePhoto = (idx) =>
    setPhotos(prev => prev.filter((_, i) => i !== idx));

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="page-header">
          <div className="skeleton h-5 w-32 rounded mb-2" />
          <div className="skeleton h-8 w-56 rounded" />
        </div>
        <div className="page-body space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="page-header">
        <p className="page-header-eyebrow">§13 Miradi ya Usharika</p>
        <h1 className="page-header-title">
          {isEdit ? 'Hariri Mradi' : 'Mradi Mpya'}
        </h1>
        <p className="page-header-subtitle">
          {isEdit
            ? 'Sasisha taarifa za mradi.'
            : 'Jaza fomu hapa chini kuanza mradi mpya wa kanisa.'}
        </p>
        <div className="page-header-actions">
          <Link href={isEdit ? `/dashboard/projects/${projectId}` : '/dashboard/projects'} className="btn btn-ghost-inverse">
            <ArrowLeft size={15} /> Rudi
          </Link>
        </div>
      </div>

      <div className="page-body">
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left column: main fields ──────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Identity */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Taarifa za Mradi</h2>
                </div>
                <div className="card-body space-y-5">

                  <div className="form-group">
                    <label className="form-label" htmlFor="name">
                      Jina la Mradi <span className="text-danger">*</span>
                    </label>
                    <input
                      id="name"
                      className={`input ${errors.name ? 'error' : ''}`}
                      placeholder="Mfano: Ujenzi wa Ukumbi wa Kanisa"
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                    />
                    {errors.name && <p className="form-error">{errors.name}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="description">Maelezo</label>
                    <textarea
                      id="description"
                      className="textarea"
                      placeholder="Elezea madhumuni na kazi za mradi..."
                      rows={3}
                      value={form.description}
                      onChange={e => set('description', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label" htmlFor="project_type">Aina ya Mradi</label>
                      <select
                        id="project_type"
                        className="select"
                        value={form.project_type}
                        onChange={e => set('project_type', e.target.value)}
                      >
                        <option value="">Chagua aina...</option>
                        {PROJECT_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="status">Hali</label>
                      <select
                        id="status"
                        className="select"
                        value={form.status}
                        onChange={e => set('status', e.target.value)}
                      >
                        {STATUS_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="progress_pct">
                      Maendeleo — {form.progress_pct}%
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="progress_pct"
                        type="range"
                        min={0} max={100} step={5}
                        className="flex-1"
                        value={form.progress_pct}
                        onChange={e => set('progress_pct', Number(e.target.value))}
                      />
                    </div>
                    <div className="progress-bar mt-2">
                      <div
                        className="progress-fill"
                        style={{ width: `${form.progress_pct}%` }}
                      />
                    </div>
                    {errors.progress_pct && (
                      <p className="form-error">{errors.progress_pct}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="notes">Maelezo ya Ziada</label>
                    <textarea
                      id="notes"
                      className="textarea"
                      placeholder="Vidokezo, maagizo maalum..."
                      rows={2}
                      value={form.notes}
                      onChange={e => set('notes', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Tarehe</h2>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="form-group">
                      <label className="form-label" htmlFor="start_date">Tarehe ya Kuanza</label>
                      <input
                        id="start_date"
                        type="date"
                        className="input"
                        value={form.start_date}
                        onChange={e => set('start_date', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="expected_end_date">
                        Kukamilika (Iliyopangwa)
                      </label>
                      <input
                        id="expected_end_date"
                        type="date"
                        className="input"
                        value={form.expected_end_date}
                        onChange={e => set('expected_end_date', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="actual_end_date">
                        Kukamilika (Halisi)
                      </label>
                      <input
                        id="actual_end_date"
                        type="date"
                        className="input"
                        value={form.actual_end_date}
                        onChange={e => set('actual_end_date', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Photos */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Picha za Mradi</h2>
                  <p className="card-subtitle">Picha za hiari — zinaonyesha maendeleo</p>
                </div>
                <div className="card-body">
                  <PhotoUpload
                    photos={photos}
                    onAdd={handleAddPhoto}
                    onRemove={handleRemovePhoto}
                  />
                </div>
              </div>
            </div>

            {/* ── Right column: sidebar fields ──────────────────────────────── */}
            <div className="space-y-6">

              {/* Budget */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Fedha</h2>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label" htmlFor="budget">Bajeti (TShs)</label>
                    <div className="input-group">
                      <span className="input-icon text-xs font-medium">TShs</span>
                      <input
                        id="budget"
                        type="number"
                        min={0}
                        step={1000}
                        className={`input ${errors.budget ? 'error' : ''}`}
                        style={{ paddingLeft: '3.25rem' }}
                        placeholder="0"
                        value={form.budget}
                        onChange={e => set('budget', e.target.value)}
                      />
                    </div>
                    {errors.budget && <p className="form-error">{errors.budget}</p>}
                    <p className="form-hint">Hiari — bajeti ya jumla ya mradi</p>
                  </div>
                </div>
              </div>

              {/* People */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Msimamizi</h2>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label" htmlFor="supervised_by_id">
                      Mtu Anayesimamia
                    </label>
                    <select
                      id="supervised_by_id"
                      className="select"
                      value={form.supervised_by_id}
                      onChange={e => set('supervised_by_id', e.target.value)}
                    >
                      <option value="">— Chagua mwanachama —</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                          {m.phone ? ` · ${m.phone}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="form-hint">Mtu anayewajibika kusimamia mradi</p>
                  </div>
                </div>
              </div>

              {/* Land asset */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Eneo la Ardhi</h2>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label" htmlFor="land_asset_id">
                      Mali ya Ardhi / Jengo
                    </label>
                    <select
                      id="land_asset_id"
                      className="select"
                      value={form.land_asset_id}
                      onChange={e => set('land_asset_id', e.target.value)}
                    >
                      <option value="">— Hiari —</option>
                      {landAssets.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.area_name ? ` · ${a.area_name}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="form-hint">
                      Unganisha mradi na kiwanja au jengo la kanisa
                    </p>
                  </div>
                  {landAssets.length === 0 && (
                    <div className="banner banner-gold mt-3 text-sm">
                      Hakuna mali ya ardhi iliyosajiliwa.{' '}
                      <Link href="/dashboard/projects/land-assets/new" className="font-medium underline">
                        Ongeza hapa
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary w-full btn-lg"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="animate-spin-slow inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />
                    Inahifadhi...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    {isEdit ? 'Hifadhi Mabadiliko' : 'Unda Mradi'}
                  </>
                )}
              </button>

              {isEdit && (
                <Link
                  href={`/dashboard/projects/${projectId}`}
                  className="btn btn-secondary w-full"
                >
                  Ghairi
                </Link>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="toast-area">
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
}