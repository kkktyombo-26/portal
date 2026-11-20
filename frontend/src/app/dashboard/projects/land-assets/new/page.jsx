'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, MapPin, Building2,
  Layers, FileText, User, AlertCircle,
} from 'lucide-react';
import { projectApi } from '../../../../../lib/api';
import { userApi } from '../../../../../lib/api';

// ─── Field options ────────────────────────────────────────────────────────────

const ASSET_TYPE_OPTIONS = [
  { value: 'land',     label: 'Ardhi / Kiwanja' },
  { value: 'building', label: 'Jengo' },
  { value: 'both',     label: 'Ardhi na Jengo' },
];

const OWNERSHIP_OPTIONS = [
  { value: 'owned',      label: 'Miliki Kamili' },
  { value: 'leased',     label: 'Kwa Pango' },
  { value: 'in_process', label: 'Inaendelea (Hati inaandaliwa)' },
];

const TZ_REGIONS = [
  'Arusha','Dar es Salaam','Dodoma','Geita','Iringa','Kagera','Katavi',
  'Kigoma','Kilimanjaro','Lindi','Manyara','Mara','Mbeya','Morogoro',
  'Mtwara','Mwanza','Njombe','Pemba Kaskazini','Pemba Kusini','Pwani',
  'Rukwa','Ruvuma','Shinyanga','Simiyu','Singida','Songwe','Tabora',
  'Tanga','Unguja Kaskazini','Unguja Kusini','Unguja Mjini Magharibi',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name:              '',
  asset_type:        'land',
  ownership_status:  'owned',
  plot_number:       '',
  title_deed_number: '',
  area_name:         '',
  region:            '',
  gps_lat:           '',
  gps_lng:           '',
  area_sqm:          '',
  usage:             '',
  valuation:         '',
  valuation_date:    '',
  responsible_id:    '',
  description:       '',
  notes:             '',
};

function fieldError(errors, key) {
  return errors[key]
    ? <p className="form-error">{errors[key]}</p>
    : null;
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gold-50 flex items-center justify-center flex-shrink-0">
            <Icon size={16} className="text-gold-600" />
          </span>
          <div>
            <h2 className="card-title">{title}</h2>
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewLandAssetPage() {
  const router = useRouter();

  const [form,     setForm]     = useState(EMPTY_FORM);
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [apiError, setApiError] = useState('');
  const [members,  setMembers]  = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // ── Load members for the responsible_id dropdown ──────────────────────────

  useEffect(() => {
    userApi.getMembers({ limit: 500, sortBy: 'full_name', order: 'asc' })
      .then(res => setMembers(res.data?.members ?? res.data?.data ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, []);

  // ── Field helpers ─────────────────────────────────────────────────────────

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }));
  };

  // ── Validation ────────────────────────────────────────────────────────────

  function validate() {
    const e = {};
    if (!form.name.trim())        e.name        = 'Jina la mali linahitajika.';
    if (!form.asset_type)         e.asset_type  = 'Chagua aina ya mali.';
    if (!form.ownership_status)   e.ownership_status = 'Chagua hali ya umiliki.';

    if (form.gps_lat && isNaN(Number(form.gps_lat)))
      e.gps_lat = 'Latitudi lazima iwe nambari halisi.';
    if (form.gps_lng && isNaN(Number(form.gps_lng)))
      e.gps_lng = 'Longitudi lazima iwe nambari halisi.';
    if (form.area_sqm && isNaN(Number(form.area_sqm)))
      e.area_sqm = 'Ukubwa lazima uwe nambari halisi.';
    if (form.valuation && isNaN(Number(form.valuation)))
      e.valuation = 'Thamani lazima iwe nambari halisi.';

    return e;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError('');

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Scroll to first error
      const firstKey = Object.keys(errs)[0];
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSaving(true);
    try {
      // Strip empty strings → null so the API doesn't store blank values
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
      );

      // Coerce numeric fields
      if (payload.area_sqm)   payload.area_sqm   = Number(payload.area_sqm);
      if (payload.valuation)  payload.valuation   = Number(payload.valuation);
      if (payload.gps_lat)    payload.gps_lat     = Number(payload.gps_lat);
      if (payload.gps_lng)    payload.gps_lng     = Number(payload.gps_lng);
      if (payload.responsible_id) payload.responsible_id = Number(payload.responsible_id);

      const res = await projectApi.createLandAsset(payload);
      const newId = res.data?.asset?.id ?? res.data?.id;

      router.push(
        newId
          ? `/dashboard/projects/land-assets/${newId}`
          : '/dashboard/projects/land-assets'
      );
    } catch (err) {
      setApiError(err.message || 'Hitilafu imetokea. Jaribu tena.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="page-header">
        <p className="page-header-eyebrow">§9 Ardhi na Majengo</p>
        <h1 className="page-header-title">Mali Mpya</h1>
        <p className="page-header-subtitle">
          Andika kiwanja, jengo, au mali yoyote ya ardhi ya usharika.
        </p>
        <div className="page-header-actions">
          <Link href="/dashboard/projects/land-assets" className="btn btn-ghost-inverse">
            <ArrowLeft size={15} /> Rudi kwenye Orodha
          </Link>
        </div>
      </div>

      <div className="page-body">
        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-6" style={{ maxWidth: 800 }}>

            {/* ── API error banner ───────────────────────────────────────── */}
            {apiError && (
              <div className="banner banner-danger flex items-start gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                {apiError}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════
                SECTION 1 — Taarifa za Msingi
            ══════════════════════════════════════════════════════════════ */}
            <Section
              icon={Building2}
              title="Taarifa za Msingi"
              subtitle="Jina, aina, na hali ya umiliki wa mali"
            >
              {/* Name — full width */}
              <div className="form-group sm:col-span-2" id="field-name">
                <label className="form-label">
                  Jina la Mali <span className="text-danger">*</span>
                </label>
                <input
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  placeholder='mfano: "Kiwanja cha Kanisa Kuu"'
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  maxLength={255}
                />
                {fieldError(errors, 'name')}
              </div>

              {/* Asset type */}
              <div className="form-group" id="field-asset_type">
                <label className="form-label">
                  Aina ya Mali <span className="text-danger">*</span>
                </label>
                <select
                  className={`select ${errors.asset_type ? 'input-error' : ''}`}
                  value={form.asset_type}
                  onChange={e => set('asset_type', e.target.value)}
                >
                  {ASSET_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {fieldError(errors, 'asset_type')}
              </div>

              {/* Ownership status */}
              <div className="form-group" id="field-ownership_status">
                <label className="form-label">
                  Hali ya Umiliki <span className="text-danger">*</span>
                </label>
                <select
                  className={`select ${errors.ownership_status ? 'input-error' : ''}`}
                  value={form.ownership_status}
                  onChange={e => set('ownership_status', e.target.value)}
                >
                  {OWNERSHIP_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {fieldError(errors, 'ownership_status')}
              </div>

              {/* Usage */}
              <div className="form-group sm:col-span-2">
                <label className="form-label">Matumizi ya Mali</label>
                <input
                  className="input"
                  placeholder='mfano: "Ibada, Makazi ya Kasisi, Biashara"'
                  value={form.usage}
                  onChange={e => set('usage', e.target.value)}
                  maxLength={255}
                />
              </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                SECTION 2 — Usajili wa Kisheria
            ══════════════════════════════════════════════════════════════ */}
            <Section
              icon={FileText}
              title="Usajili wa Kisheria"
              subtitle="Namba za kiwanja na hati miliki"
            >
              <div className="form-group">
                <label className="form-label">Namba ya Kiwanja (Plot No.)</label>
                <input
                  className="input"
                  placeholder="mfano: 123/IV/A"
                  value={form.plot_number}
                  onChange={e => set('plot_number', e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Namba ya Hati Miliki (Title Deed)</label>
                <input
                  className="input"
                  placeholder="mfano: COT/DSM/00123"
                  value={form.title_deed_number}
                  onChange={e => set('title_deed_number', e.target.value)}
                  maxLength={100}
                />
              </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                SECTION 3 — Mahali
            ══════════════════════════════════════════════════════════════ */}
            <Section
              icon={MapPin}
              title="Mahali pa Mali"
              subtitle="Eneo na kuratibu za GPS (si lazima)"
            >
              {/* Area name */}
              <div className="form-group">
                <label className="form-label">Jina la Eneo / Mtaa</label>
                <input
                  className="input"
                  placeholder='mfano: "Yombo Vituka, Temeke"'
                  value={form.area_name}
                  onChange={e => set('area_name', e.target.value)}
                  maxLength={255}
                />
              </div>

              {/* Region */}
              <div className="form-group">
                <label className="form-label">Mkoa</label>
                <select
                  className="select"
                  value={form.region}
                  onChange={e => set('region', e.target.value)}
                >
                  <option value="">— Chagua mkoa —</option>
                  {TZ_REGIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* GPS */}
              <div className="form-group" id="field-gps_lat">
                <label className="form-label">Latitudi (GPS)</label>
                <input
                  className={`input ${errors.gps_lat ? 'input-error' : ''}`}
                  placeholder="-6.8160"
                  value={form.gps_lat}
                  onChange={e => set('gps_lat', e.target.value)}
                  inputMode="decimal"
                />
                {fieldError(errors, 'gps_lat')}
              </div>

              <div className="form-group" id="field-gps_lng">
                <label className="form-label">Longitudi (GPS)</label>
                <input
                  className={`input ${errors.gps_lng ? 'input-error' : ''}`}
                  placeholder="39.2803"
                  value={form.gps_lng}
                  onChange={e => set('gps_lng', e.target.value)}
                  inputMode="decimal"
                />
                {fieldError(errors, 'gps_lng')}
              </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                SECTION 4 — Ukubwa na Thamani
            ══════════════════════════════════════════════════════════════ */}
            <Section
              icon={Layers}
              title="Ukubwa na Thamani"
              subtitle="Eneo la uso na tathmini ya fedha"
            >
              {/* Area sqm */}
              <div className="form-group" id="field-area_sqm">
                <label className="form-label">Ukubwa (Mita za Mraba)</label>
                <div className="input-group">
                  <input
                    className={`input ${errors.area_sqm ? 'input-error' : ''}`}
                    placeholder="0.00"
                    value={form.area_sqm}
                    onChange={e => set('area_sqm', e.target.value)}
                    inputMode="decimal"
                  />
                  <span className="input-addon">m²</span>
                </div>
                {fieldError(errors, 'area_sqm')}
              </div>

              {/* Valuation */}
              <div className="form-group" id="field-valuation">
                <label className="form-label">Thamani ya Tathmini (TShs)</label>
                <div className="input-group">
                  <span className="input-addon">TShs</span>
                  <input
                    className={`input ${errors.valuation ? 'input-error' : ''}`}
                    placeholder="0"
                    value={form.valuation}
                    onChange={e => set('valuation', e.target.value)}
                    inputMode="decimal"
                  />
                </div>
                {fieldError(errors, 'valuation')}
              </div>

              {/* Valuation date */}
              <div className="form-group">
                <label className="form-label">Tarehe ya Tathmini</label>
                <input
                  type="date"
                  className="input"
                  value={form.valuation_date}
                  onChange={e => set('valuation_date', e.target.value)}
                />
              </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                SECTION 5 — Msimamizi
            ══════════════════════════════════════════════════════════════ */}
            <Section
              icon={User}
              title="Msimamizi wa Mali"
              subtitle="Mtu anayehusika na usimamizi wa mali hii"
            >
              <div className="form-group sm:col-span-2">
                <label className="form-label">Msimamizi (Kiongozi)</label>
                {loadingMembers ? (
                  <div className="skeleton h-10 rounded-lg" />
                ) : (
                  <select
                    className="select"
                    value={form.responsible_id}
                    onChange={e => set('responsible_id', e.target.value)}
                  >
                    <option value="">— Chagua mtu —</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                        {m.phone ? ` — ${m.phone}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </Section>

            {/* ══════════════════════════════════════════════════════════════
                SECTION 6 — Maelezo zaidi
            ══════════════════════════════════════════════════════════════ */}
            <div className="card">
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-gold-50 flex items-center justify-center flex-shrink-0">
                    <FileText size={16} className="text-gold-600" />
                  </span>
                  <div>
                    <h2 className="card-title">Maelezo na Vidokezo</h2>
                    <p className="card-subtitle">Taarifa za ziada (si lazima)</p>
                  </div>
                </div>
              </div>
              <div className="card-body space-y-4">
                <div className="form-group">
                  <label className="form-label">Maelezo ya Mali</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Mipaka, hali ya mali, historia fupi..."
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vidokezo vya Ndani (Notes)</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Vidokezo vya ziada kwa timu..."
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {/* ── Form footer — sticky action bar ──────────────────────────── */}
            <div
              className="card"
              style={{
                position: 'sticky',
                bottom: 16,
                zIndex: 20,
              }}
            >
              <div className="card-body">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-sm text-neutral-500">
                    Sehemu zenye <span className="text-danger">*</span> zinahitajika.
                  </p>
                  <div className="flex gap-3">
                    <Link
                      href="/dashboard/projects/land-assets"
                      className="btn btn-secondary"
                    >
                      Ghairi
                    </Link>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving}
                    >
                      <Save size={15} />
                      {saving ? 'Inahifadhi...' : 'Hifadhi Mali'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}