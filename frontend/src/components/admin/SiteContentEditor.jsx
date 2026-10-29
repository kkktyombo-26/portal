// components/admin/SiteContentEditor.jsx
// Pastor / elder admin page for editing landing page content blocks.
// Route suggestion: /dashboard/content
//
// Usage in a Next.js page:
//   import SiteContentEditor from '@/components/admin/SiteContentEditor';
//   export default function ContentPage() { return <SiteContentEditor />; }

'use client';
import { useState, useEffect, useCallback } from 'react';
import { fetchAllSiteContent } from '@/hooks/useSiteContent';

// ── Config: which blocks exist and how to render their fields ─────────────────
const BLOCKS = [
  {
    key:   'translations_en',
    label: 'Text Labels (English)',
    hint:  'Nav labels, button text, section headings.',
    fields: [
      { id: 'nav_services',    label: 'Nav: Services' },
      { id: 'nav_schedule',    label: 'Nav: Schedule' },
      { id: 'nav_location',    label: 'Nav: Find Us' },
      { id: 'hero_sub',        label: 'Hero subtitle' },
      { id: 'hero_cta',        label: 'Hero CTA button' },
      { id: 'carousel_title',  label: 'Gallery section title' },
      { id: 'carousel_sub',    label: 'Gallery section subtitle' },
      { id: 'schedule_title',  label: 'Schedule section title' },
      { id: 'schedule_note',   label: 'Schedule footnote' },
      { id: 'portal_title',    label: 'Portal CTA title' },
      { id: 'portal_sub',      label: 'Portal CTA subtitle', multiline: true },
      { id: 'portal_cta',      label: 'Portal register button' },
      { id: 'youtube_title',   label: 'YouTube section title' },
      { id: 'youtube_sub',     label: 'YouTube section subtitle' },
      { id: 'youtube_cta',     label: 'YouTube subscribe button' },
      { id: 'pastor_title',    label: 'Pastor section heading' },
      { id: 'pastor_name',     label: 'Pastor name' },
      { id: 'pastor_role',     label: 'Pastor role' },
      { id: 'pastor_bio',      label: 'Pastor bio', multiline: true },
      { id: 'pastor_meet',     label: 'Meet pastor button' },
      { id: 'pastor_hours_title', label: 'Office hours heading' },
      { id: 'pastor_hours_note',  label: 'Office hours footnote' },
    ],
  },
  {
    key:   'translations_sw',
    label: 'Text Labels (Kiswahili)',
    hint:  'Same fields — Swahili translations.',
    fields: [
      { id: 'nav_services',    label: 'Nav: Huduma' },
      { id: 'nav_schedule',    label: 'Nav: Ratiba' },
      { id: 'nav_location',    label: 'Nav: Eneo Letu' },
      { id: 'hero_sub',        label: 'Hero subtitle (Sw)' },
      { id: 'hero_cta',        label: 'Hero CTA button (Sw)' },
      { id: 'carousel_title',  label: 'Gallery title (Sw)' },
      { id: 'carousel_sub',    label: 'Gallery subtitle (Sw)' },
      { id: 'schedule_title',  label: 'Ratiba heading (Sw)' },
      { id: 'schedule_note',   label: 'Ratiba footnote (Sw)' },
      { id: 'portal_title',    label: 'Portal title (Sw)' },
      { id: 'portal_sub',      label: 'Portal subtitle (Sw)', multiline: true },
      { id: 'portal_cta',      label: 'Portal button (Sw)' },
      { id: 'youtube_title',   label: 'YouTube title (Sw)' },
      { id: 'youtube_sub',     label: 'YouTube subtitle (Sw)' },
      { id: 'youtube_cta',     label: 'YouTube button (Sw)' },
      { id: 'pastor_title',    label: 'Pastor heading (Sw)' },
      { id: 'pastor_name',     label: 'Pastor jina' },
      { id: 'pastor_role',     label: 'Pastor wadhifa' },
      { id: 'pastor_bio',      label: 'Pastor wasifu', multiline: true },
      { id: 'pastor_meet',     label: 'Kitufe cha kukutana' },
      { id: 'pastor_hours_title', label: 'Kichwa cha masaa' },
      { id: 'pastor_hours_note',  label: 'Kumbuka ya masaa' },
    ],
  },
  {
    key:   'schedule',
    label: 'Weekly Schedule',
    hint:  'Sunday services, Bible study, prayer night, rehearsal.',
    type:  'schedule',
  },
  {
    key:   'pastor_hours',
    label: 'Pastoral Office Hours',
    hint:  'Days and time ranges the pastor is available.',
    type:  'pastor_hours',
  },
  {
    key:   'staff',
    label: 'Leadership / Staff',
    hint:  'Names, roles, and photo URLs for the leadership cards.',
    type:  'staff',
  },
  {
    key:   'gallery_slides',
    label: 'Gallery Slides',
    hint:  'Photo URLs and captions for the gallery carousel.',
    type:  'gallery',
  },
  {
    key:   'hero_slides',
    label: 'Hero Carousel Slides',
    hint:  'Background images, titles, subtitles, and CTA links for the hero.',
    type:  'hero',
  },
];

// ── Palette (matches landing page) ───────────────────────────────────────────
const C = {
  navy: '#1B3A6B', navyD: '#0f2347', navyL: '#E8EDF5',
  gold: '#C8A84B', goldL: '#F5EDD0',
  cream: '#F0EDE6', stone: '#E6E2D9',
  ink: '#0f172a', muted: '#64748b',
  danger: '#DC2626', success: '#16a34a',
};

const inp = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: `1px solid ${C.navy}22`, background: '#fff',
  fontSize: 13, color: C.ink, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

function getToken() {
  const fromCookie = document.cookie.match(/(?:^|; )token=([^;]*)/)?.[1];
  return fromCookie
    ? decodeURIComponent(fromCookie)
    : (localStorage.getItem('token') ?? '');
}

async function saveBlock(key, value) {
  const res = await fetch(`${API}/site-content/${key}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify(value),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Save failed');
  return json.data;
}

// ─── Simple key/value flat object editor ──────────────────────────────────────
function FlatEditor({ fields, value, onChange }) {
  const data = value ?? {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {fields.map(f => (
        <div key={f.id}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 4, letterSpacing: '0.04em' }}>
            {f.label}
          </label>
          {f.multiline
            ? <textarea rows={3} value={data[f.id] ?? ''} onChange={e => onChange({ ...data, [f.id]: e.target.value })} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}/>
            : <input type="text" value={data[f.id] ?? ''} onChange={e => onChange({ ...data, [f.id]: e.target.value })} style={inp}/>
          }
        </div>
      ))}
    </div>
  );
}

// ─── Schedule editor ──────────────────────────────────────────────────────────
const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const DEFAULT_SCHEDULE_ITEM = { dayKey: 'sunday', time: '', serviceEn: '', serviceSw: '', highlight: false };

function ScheduleEditor({ value, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i, patch) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r);
    onChange(next);
  };
  const add    = () => onChange([...rows, { ...DEFAULT_SCHEDULE_ITEM }]);
  const remove = i => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ background: '#fff', border: `1px solid ${C.navy}14`, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Day</label>
              <select value={row.dayKey} onChange={e => update(i, { dayKey: e.target.value })} style={{ ...inp }}>
                {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Time</label>
              <input type="text" value={row.time} onChange={e => update(i, { time: e.target.value })} placeholder="e.g. 7:00 AM" style={inp}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Service (English)</label>
              <input type="text" value={row.serviceEn} onChange={e => update(i, { serviceEn: e.target.value })} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Huduma (Kiswahili)</label>
              <input type="text" value={row.serviceSw} onChange={e => update(i, { serviceSw: e.target.value })} style={inp}/>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.ink, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!row.highlight} onChange={e => update(i, { highlight: e.target.checked })}/>
              Highlight (gold stripe)
            </label>
            <button onClick={() => remove(i)} style={{ border: 'none', background: 'none', color: C.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '4px 0' }}>Remove</button>
          </div>
        </div>
      ))}
      <button onClick={add} style={{ alignSelf: 'flex-start', padding: '8px 18px', borderRadius: 8, border: `1.5px dashed ${C.navy}33`, background: 'transparent', color: C.navy, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        + Add row
      </button>
    </div>
  );
}

// ─── Pastor hours editor ──────────────────────────────────────────────────────
const DEFAULT_HOUR = { dayKey: 'monday', timeEn: '', timeSw: '' };

function PastorHoursEditor({ value, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i, patch) => onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const add    = () => onChange([...rows, { ...DEFAULT_HOUR }]);
  const remove = i => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ background: '#fff', border: `1px solid ${C.navy}14`, borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Day</label>
              <select value={row.dayKey} onChange={e => update(i, { dayKey: e.target.value })} style={{ ...inp }}>
                {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Time (English)</label>
              <input type="text" value={row.timeEn} onChange={e => update(i, { timeEn: e.target.value })} placeholder="9:00 AM – 12:00 PM" style={inp}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Muda (Kiswahili)</label>
              <input type="text" value={row.timeSw} onChange={e => update(i, { timeSw: e.target.value })} placeholder="9:00 – 12:00 Asubuhi" style={inp}/>
            </div>
          </div>
          <button onClick={() => remove(i)} style={{ border: 'none', background: 'none', color: C.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Remove</button>
        </div>
      ))}
      <button onClick={add} style={{ alignSelf: 'flex-start', padding: '8px 18px', borderRadius: 8, border: `1.5px dashed ${C.navy}33`, background: 'transparent', color: C.navy, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add hours</button>
    </div>
  );
}

// ─── Gallery slide editor ─────────────────────────────────────────────────────
const DEFAULT_SLIDE = { url: '', captionEn: '', captionSw: '' };

function GalleryEditor({ value, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i, patch) => onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const add    = () => onChange([...rows, { ...DEFAULT_SLIDE }]);
  const remove = i => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ background: '#fff', border: `1px solid ${C.navy}14`, borderRadius: 10, padding: '12px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Image URL (e.g. /sunday.jpeg)</label>
            <input type="text" value={row.url} onChange={e => update(i, { url: e.target.value })} style={inp}/>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Caption (English)</label>
            <input type="text" value={row.captionEn} onChange={e => update(i, { captionEn: e.target.value })} style={inp}/>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Maelezo (Kiswahili)</label>
            <input type="text" value={row.captionSw} onChange={e => update(i, { captionSw: e.target.value })} style={inp}/>
          </div>
          {row.url && <div style={{ gridColumn: '1 / -1' }}><img src={row.url} alt="" style={{ height: 60, borderRadius: 6, objectFit: 'cover', border: `1px solid ${C.navy}18` }}/></div>}
          <button onClick={() => remove(i)} style={{ border: 'none', background: 'none', color: C.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0, gridColumn: '1 / -1', textAlign: 'left' }}>Remove</button>
        </div>
      ))}
      <button onClick={add} style={{ alignSelf: 'flex-start', padding: '8px 18px', borderRadius: 8, border: `1.5px dashed ${C.navy}33`, background: 'transparent', color: C.navy, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add slide</button>
    </div>
  );
}

// ─── Staff editor ─────────────────────────────────────────────────────────────
const DEFAULT_STAFF = { photo: '', name: '', roleEn: '', roleSw: '', badgeEn: '', badgeSw: '', bio: '', featured: false };

function StaffEditor({ value, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i, patch) => onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const add    = () => onChange([...rows, { ...DEFAULT_STAFF }]);
  const remove = i => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ background: '#fff', border: `1px solid ${C.navy}14`, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center' }}>
              {row.photo && <img src={row.photo} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: `1px solid ${C.navy}18`, flexShrink: 0 }}/>}
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Photo URL</label>
                <input type="text" value={row.photo} onChange={e => update(i, { photo: e.target.value })} placeholder="/pastor.jpeg" style={inp}/>
              </div>
            </div>
            {[
              { id: 'name', label: 'Full Name' },
              { id: 'roleEn', label: 'Role (English)' },
              { id: 'roleSw', label: 'Wadhifa (Kiswahili)' },
              { id: 'badgeEn', label: 'Badge (English)' },
              { id: 'badgeSw', label: 'Beji (Kiswahili)' },
            ].map(f => (
              <div key={f.id}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>{f.label}</label>
                <input type="text" value={row[f.id] ?? ''} onChange={e => update(i, { [f.id]: e.target.value })} style={inp}/>
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Bio</label>
              <textarea rows={2} value={row.bio ?? ''} onChange={e => update(i, { bio: e.target.value })} style={{ ...inp, resize: 'vertical' }}/>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.ink, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!row.featured} onChange={e => update(i, { featured: e.target.checked })}/>
              Featured (dark card)
            </label>
            <button onClick={() => remove(i)} style={{ border: 'none', background: 'none', color: C.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Remove</button>
          </div>
        </div>
      ))}
      <button onClick={add} style={{ alignSelf: 'flex-start', padding: '8px 18px', borderRadius: 8, border: `1.5px dashed ${C.navy}33`, background: 'transparent', color: C.navy, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add staff member</button>
    </div>
  );
}

// ─── Hero slide editor ────────────────────────────────────────────────────────
const DEFAULT_HERO = { id: '', bg: '', tag: '', titleLines: ['', ''], sub: '', cta: { label: '', href: '', external: false }, ctaAlt: { label: '', href: '', external: false } };

function HeroEditor({ value, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i, patch) => onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const add    = () => onChange([...rows, { ...DEFAULT_HERO, id: `slide_${Date.now()}` }]);
  const remove = i => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((row, i) => (
        <div key={i} style={{ background: '#fff', border: `1px solid ${C.navy}14`, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Background Image URL</label>
              <input type="text" value={row.bg} onChange={e => update(i, { bg: e.target.value })} placeholder="/worship1.jpeg" style={inp}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Tag (top eyebrow text)</label>
              <input type="text" value={row.tag} onChange={e => update(i, { tag: e.target.value })} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Subtitle</label>
              <input type="text" value={row.sub} onChange={e => update(i, { sub: e.target.value })} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Title Line 1</label>
              <input type="text" value={row.titleLines?.[0] ?? ''} onChange={e => update(i, { titleLines: [e.target.value, row.titleLines?.[1] ?? ''] })} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Title Line 2</label>
              <input type="text" value={row.titleLines?.[1] ?? ''} onChange={e => update(i, { titleLines: [row.titleLines?.[0] ?? '', e.target.value] })} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>CTA Button Label</label>
              <input type="text" value={row.cta?.label ?? ''} onChange={e => update(i, { cta: { ...row.cta, label: e.target.value } })} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>CTA Button URL</label>
              <input type="text" value={row.cta?.href ?? ''} onChange={e => update(i, { cta: { ...row.cta, href: e.target.value } })} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Alt Button Label</label>
              <input type="text" value={row.ctaAlt?.label ?? ''} onChange={e => update(i, { ctaAlt: { ...row.ctaAlt, label: e.target.value } })} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>Alt Button URL</label>
              <input type="text" value={row.ctaAlt?.href ?? ''} onChange={e => update(i, { ctaAlt: { ...row.ctaAlt, href: e.target.value } })} style={inp}/>
            </div>
          </div>
          <button onClick={() => remove(i)} style={{ border: 'none', background: 'none', color: C.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>Remove slide</button>
        </div>
      ))}
      <button onClick={add} style={{ alignSelf: 'flex-start', padding: '8px 18px', borderRadius: 8, border: `1.5px dashed ${C.navy}33`, background: 'transparent', color: C.navy, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add hero slide</button>
    </div>
  );
}

// ─── Block panel ──────────────────────────────────────────────────────────────
function BlockPanel({ block, initialValue }) {
  const [value,   setValue]   = useState(initialValue ?? null);
  const [status,  setStatus]  = useState(null); // 'saving' | 'saved' | 'error'
  const [errMsg,  setErrMsg]  = useState('');
  const dirty = JSON.stringify(value) !== JSON.stringify(initialValue);

  const handleSave = async () => {
    setStatus('saving');
    try {
      await saveBlock(block.key, value);
      setStatus('saved');
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      setStatus('error');
      setErrMsg(e.message);
    }
  };

  const renderEditor = () => {
    switch (block.type) {
      case 'schedule':     return <ScheduleEditor     value={value} onChange={setValue}/>;
      case 'pastor_hours': return <PastorHoursEditor  value={value} onChange={setValue}/>;
      case 'gallery':      return <GalleryEditor      value={value} onChange={setValue}/>;
      case 'staff':        return <StaffEditor        value={value} onChange={setValue}/>;
      case 'hero':         return <HeroEditor         value={value} onChange={setValue}/>;
      default:             return <FlatEditor         fields={block.fields} value={value} onChange={setValue}/>;
    }
  };

  return (
    <div style={{ background: C.cream, border: `1px solid ${C.navy}10`, borderRadius: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: C.navyD, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, margin: 0 }}>{block.label}</h3>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>{block.hint}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {status === 'saved' && <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>✓ Saved</span>}
          {status === 'error' && <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700 }}>Error: {errMsg}</span>}
          <button
            onClick={handleSave}
            disabled={status === 'saving' || !dirty}
            style={{
              padding: '7px 18px', borderRadius: 99, border: 'none', cursor: dirty && status !== 'saving' ? 'pointer' : 'default',
              background: dirty ? C.gold : 'rgba(255,255,255,0.15)',
              color: dirty ? C.navyD : 'rgba(255,255,255,0.4)',
              fontSize: 12, fontWeight: 800, letterSpacing: '0.02em',
              transition: 'all 0.15s',
            }}
          >
            {status === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '20px 20px 24px' }}>
        {renderEditor()}
      </div>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────
export default function SiteContentEditor() {
  const [allContent, setAllContent] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [activeKey,  setActiveKey]  = useState(BLOCKS[0].key);

  useEffect(() => {
    setLoading(true);
    fetchAllSiteContent()
      .then(data => setAllContent(data))
      .catch(e  => setError(e.message))
      .finally(()=> setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
      Loading content blocks…
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', color: C.danger }}>
      Failed to load content: {error}
    </div>
  );

  const activeBlock = BLOCKS.find(b => b.key === activeKey);

  return (
    <div style={{ fontFamily: "'Lato', sans-serif", minHeight: '100vh', background: C.stone }}>
      {/* Page header */}
      <div style={{ background: C.navyD, borderBottom: `3px solid ${C.gold}`, padding: '20px 28px' }}>
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>Site Content Editor</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 4 }}>
          Changes save to the database immediately. The landing page reflects updates on next load.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 72px)' }}>
        {/* Sidebar nav */}
        <nav style={{ background: C.cream, borderRight: `1px solid ${C.navy}12`, padding: '16px 12px' }}>
          {BLOCKS.map(b => (
            <button
              key={b.key}
              onClick={() => setActiveKey(b.key)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', borderRadius: 8, marginBottom: 4, border: 'none', cursor: 'pointer',
                background: activeKey === b.key ? C.navy : 'transparent',
                color:      activeKey === b.key ? '#fff'  : C.ink,
                fontSize: 12, fontWeight: activeKey === b.key ? 700 : 500,
                transition: 'all 0.12s',
              }}
            >
              {b.label}
            </button>
          ))}
        </nav>

        {/* Editor area */}
        <div style={{ padding: '28px 28px 48px', maxWidth: 860 }}>
          {activeBlock && (
            <BlockPanel
              key={activeKey}
              block={activeBlock}
              initialValue={allContent?.[activeKey] ?? null}
            />
          )}
        </div>
      </div>
    </div>
  );
}