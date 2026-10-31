'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { isAuthenticated } from '../lib/auth';
import api, { siteContentApi } from '../lib/api';

// ── Translations (hardcoded defaults — DB values overlay these) ───────────────
const T = {
  en: {
    nav_services: 'Services', nav_schedule: 'Schedule', nav_location: 'Find Us',
    login: 'Sign In', go_portal: 'Portal',
    hero_tag: 'Kanisa La Kiinjili La Kilutheri',
    hero_title: 'KKKT DMP\nYOMBO',
    hero_sub: 'A community of faith, love, and worship in Dar es Salaam.',
    hero_cta: 'Join Our Community', hero_cta2: 'Sign In',
    carousel_title: 'Life at Yombo',
    carousel_sub: 'Sundays, ministries, and the moments that make us one.',
    schedule_title: 'Weekly Timetable',
    schedule_sub: 'Our regular services and ministry programmes.',
    schedule_note: 'Times may vary on special occasions.',
    map_title: 'Find Us',
    map_sub: 'We are located in Yombo, Dar es Salaam — Tanzania.',
    map_address: 'Kanisa La Kiinjili La Kilutheri, Ushirika Wa Yombo, Dar es Salaam, Tanzania',
    portal_title: 'Get Personalised Updates',
    portal_sub: 'Register through our portal to access the full service schedule, group announcements, and exclusive church resources — tailored for you.',
    portal_cta: 'Register Now',
    portal_login: 'Already a member? Sign In',
    portal_features: ['Announcements & alerts', 'Group schedules', 'Event reminders', 'Digital resources'],
    footer_rights: 'All rights reserved.',
    pastor_title: 'Meet Our Pastor',
    pastor_name: 'Mchungaji Joshua Delem',
    pastor_role: 'Senior Pastor, KKKT DMP Yombo',
    pastor_bio: 'Leading our congregation with faith, wisdom, and love. Pastor Delem shepherds the Yombo community with a heart for God and the people of Dar es Salaam.',
    pastor_meet: 'Meet with Pastor Delem',
    pastor_hours_title: 'Pastoral Office Hours',
    pastor_hours_note: 'Walk-ins welcome. For urgent matters, contact the church office.',
    youtube_title: 'Watch & Worship',
    youtube_sub: 'Sermons, praise, and worship — anytime, anywhere.',
    youtube_cta: 'Subscribe on YouTube',
    youtube_empty: 'New videos coming soon. Subscribe to get notified!',
    days: { sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' },
  },
  sw: {
    nav_services: 'Huduma', nav_schedule: 'Ratiba', nav_location: 'Eneo Letu',
    login: 'Ingia', go_portal: 'Portal',
    hero_tag: 'Kanisa La Kiinjili La Kilutheri',
    hero_title: 'KKKT DMP\nYOMBO',
    hero_sub: 'Jumuia ya imani, upendo, na ibada huko Dar es Salaam.',
    hero_cta: 'Jiunge Nasi', hero_cta2: 'Ingia',
    carousel_title: 'KARIBU Yombo',
    carousel_sub: 'Ibada za Jumapili, huduma, na nyakati zinazotufanya tuwe moja.',
    schedule_title: 'Ratiba ya Wiki',
    schedule_sub: 'Huduma zetu za kawaida na mipango ya wizara.',
    schedule_note: 'Nyakati zinaweza kubadilika kwa matukio maalum.',
    map_title: 'Tukuta',
    map_sub: 'Tuko Yombo, Dar es Salaam — Tanzania.',
    map_address: 'Kanisa La Kiinjili La Kilutheri, Ushirika Wa Yombo, Dar es Salaam, Tanzania',
    portal_title: 'Pata Taarifa Maalum Kwako',
    portal_sub: 'Jiandikishe kupitia mfumo wetu ili upate ratiba kamili, matangazo ya vikundi, na rasilimali za kanisa — maalum kwako.',
    portal_cta: 'Jiandikishe Sasa',
    portal_login: 'Tayari mshirika? Ingia',
    portal_features: ['Matangazo & arifa', 'Ratiba za vikundi', 'Ukumbusho wa matukio', 'Rasilimali za kidijitali'],
    footer_rights: 'Haki zote zimehifadhiwa.',
    pastor_title: 'Kukutana na Mchungaji Wetu',
    pastor_name: 'Mchungaji Delemi',
    pastor_role: 'Mchungaji Mkuu, KKKT DMP Yombo',
    pastor_bio: 'Anaongoza mkutano wetu kwa imani, hekima, na upendo. Mchungaji Delemi anachunga jumuia ya Yombo kwa moyo wa Mungu na watu wa Dar es Salaam.',
    pastor_meet: 'Kukutana na Mchungaji Delemi',
    pastor_hours_title: 'Masaa ya Ofisi ya Uchungaji',
    pastor_hours_note: 'Karibu bila miadi. Kwa mambo ya haraka, wasiliana na ofisi ya kanisa.',
    youtube_title: 'Tazama & Abudu',
    youtube_sub: 'Mahubiri, sifa, na ibada — wakati wowote, mahali popote.',
    youtube_cta: 'Jiunge YouTube',
    youtube_empty: 'Video mpya zinakuja hivi karibuni. Jiunge ili upate arifa!',
    days: { sunday: 'Jumapili', monday: 'Jumatatu', tuesday: 'Jumanne', wednesday: 'Jumatano', thursday: 'Alhamisi', friday: 'Ijumaa', saturday: 'Jumamosi' },
  },
};

// ── Hardcoded defaults ────────────────────────────────────────────────────────
const DEFAULT_SCHEDULE = [
  { dayKey: 'sunday',    time: '7:00 AM',  serviceEn: 'Early Morning Service',     serviceSw: 'Ibada ya Asubuhi',         highlight: true  },
  { dayKey: 'sunday',    time: '10:00 AM', serviceEn: 'Main Sunday Worship',        serviceSw: 'Ibada Kuu ya Jumapili',    highlight: true  },
  { dayKey: 'sunday',    time: '3:00 PM',  serviceEn: 'Youth & Children Service',   serviceSw: 'Ibada ya Vijana & Watoto', highlight: false },
  { dayKey: 'wednesday', time: '5:30 PM',  serviceEn: 'Midweek Bible Study',        serviceSw: 'Mafunzo ya Biblia',        highlight: false },
  { dayKey: 'friday',    time: '6:00 PM',  serviceEn: 'Friday Prayer Night',        serviceSw: 'Usiku wa Sala',            highlight: true  },
  { dayKey: 'saturday',  time: '9:00 AM',  serviceEn: 'Choir & Ministry Rehearsal', serviceSw: 'Mazoezi ya Kwaya',         highlight: false },
];

const DEFAULT_PASTOR_HOURS = [
  { dayKey: 'monday',    timeEn: '9:00 AM – 12:00 PM',  timeSw: '9:00 – 12:00 Asubuhi'  },
  { dayKey: 'tuesday',   timeEn: '2:00 PM – 5:00 PM',   timeSw: '2:00 – 5:00 Mchana'    },
  { dayKey: 'wednesday', timeEn: '9:00 AM – 11:00 AM',  timeSw: '9:00 – 11:00 Asubuhi'  },
  { dayKey: 'thursday',  timeEn: '2:00 PM – 5:00 PM',   timeSw: '2:00 – 5:00 Mchana'    },
  { dayKey: 'friday',    timeEn: '10:00 AM – 12:00 PM', timeSw: '10:00 – 12:00 Asubuhi' },
];

const DEFAULT_GALLERY_SLIDES = [
  { url: '/sunday.jpeg',    captionEn: 'Sunday Worship',         captionSw: 'Ibada ya Jumapili' },
  { url: '/community.jpeg', captionEn: 'Community & Fellowship', captionSw: 'Ushirika & Umoja' },
  { url: '/kwaya.jpeg',     captionEn: 'Choir Ministration',     captionSw: 'Huduma ya Kwaya' },
  { url: '/worship2.jpeg',  captionEn: 'Prayer & Intercession',  captionSw: 'Sala na Uombezi' },
  { url: '/vijana.jpeg',    captionEn: 'Youth Ministry',         captionSw: 'Huduma ya Vijana' },
  { url: '/special.jpeg',   captionEn: 'Special Events',         captionSw: 'Matukio Maalum' },
];

const DEFAULT_STAFF = [
  {
    photo: '/pastor.jpeg', altEn: 'Pastor', altSw: 'Mchungaji',
    name: null,
    roleEn: 'Senior Pastor', roleSw: 'Mchungaji Mkuu',
    badgeEn: 'Our Shepherd', badgeSw: 'Kiongozi Wetu',
    featured: true,
  },
  {
    photo: '/evangelist.jpeg', altEn: 'Evangelist', altSw: 'Mwinjilisti',
    nameEn: 'Evangelist Amos Mntwambwe', nameSw: 'Mwinjilisti Amos Mntwambwe',
    roleEn: 'Evangelist', roleSw: 'Mwinjilisti',
    badgeEn: 'The Word', badgeSw: 'Neno',
    featured: false,
  },
  {
    photo: '/parish.jpeg', altEn: 'Parish Worker', altSw: 'Parish Worker',
    nameEn: 'P/W Hilda Chuma', nameSw: 'P/W Hilda Chuma',
    roleEn: 'Parish Worker', roleSw: 'Parish Worker',
    badgeEn: 'Community', badgeSw: 'Jamii',
    featured: false,
  },
];

// ── Hero slides builder ────────────────────────────────────────────────────────
const buildHeroSlides = (lang, countdown, dbSlides) => {
  if (dbSlides && Array.isArray(dbSlides) && dbSlides.length > 0) {
    return dbSlides.map(s => ({
      ...s,
      ...(s.isEaster ? { countdown } : {}),
    }));
  }
  return [
    {
      id: 'welcome',
      bg: '/worship1.jpeg',
      tag: 'Kanisa La Kiinjili La Kilutheri',
      titleLines: ['KKKT DMP', 'YOMBO'],
      sub: lang === 'sw'
        ? 'Jumuia ya imani, upendo, na ibada huko Dar es Salaam.'
        : 'A community of faith, love, and worship in Dar es Salaam.',
      cta:    { label: lang === 'sw' ? 'Jiunge Nasi' : 'Join Our Community', href: '/auth/register' },
      ctaAlt: { label: lang === 'sw' ? 'Ingia'       : 'Sign In',            href: '/auth/login' },
    },
    {
      id: 'easter',
      bg: '/pasaka.jpeg',
      tag: lang === 'sw' ? 'Matukio Maalum' : 'Special Event',
      titleLines: ['MAVUNO', '2026'],
      sub: lang === 'sw'
        ? 'Maadimisho ya Sikukuu ya MAVUNO 2026. Karibuni umtolee BWANA kwa moyo wa shukrani.'
        : 'Celebrating the MAVUNO Festival. Join us for our special MAVUNO services.',
      countdown,
      cta: { label: lang === 'sw' ? 'Angalia Ratiba' : 'View Schedule', href: '#schedule' },
      isEaster: true,
    },
    {
      id: 'youtube',
      bg: '/youtube.jpeg',
      tag: lang === 'sw' ? 'Mpya! Chaneli ya YouTube' : 'New! YouTube Channel',
      titleLines: lang === 'sw' ? ['TAZAMA', 'MTANDAONI'] : ['WATCH US', 'ONLINE'],
      sub: lang === 'sw'
        ? 'Tumefungua chaneli yetu ya YouTube! Tazama mahubiri na ibada zetu wakati wowote.'
        : "We've launched our YouTube channel! Watch our sermons and worship sessions anytime, anywhere.",
      cta:    { label: lang === 'sw' ? 'Jiunge YouTube'  : 'Subscribe on YouTube', href: 'https://www.youtube.com/@KKKTDMPYOMBO', external: true },
      ctaAlt: { label: lang === 'sw' ? 'Fuata Instagram' : 'Follow on Instagram',  href: 'https://www.instagram.com/kkktyombo/',  external: true },
      isDigital: true,
    },
    {
      id: 'community',
      bg: '/community.jpeg',
      tag: lang === 'sw' ? 'Ushirika' : 'Community',
      titleLines: lang === 'sw' ? ['JIUNGE', 'NASI'] : ['BE PART', 'OF US'],
      sub: lang === 'sw'
        ? 'Jiandikishe kwenye mfumo wetu wa kidijitali na upate matangazo, ratiba, na rasilimali maalum.'
        : 'Register on our digital portal to access announcements, schedules, and exclusive resources.',
      cta:    { label: lang === 'sw' ? 'Jiandikishe Sasa' : 'Register Now', href: '/auth/register' },
      ctaAlt: { label: lang === 'sw' ? 'Jifunze Zaidi'    : 'Learn More',   href: '#carousel' },
    },
  ];
};

// ── SVG atoms (using CSS vars) ────────────────────────────────────────────────
const LutherRose = ({ size = 80 }) => (
  <img src="/luther.webp" alt="Luther Rose" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }}/>
);

const YTIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
  </svg>
);

const IGIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const ArrowRight = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const MapPin = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
    <circle cx="12" cy="9" r="2.5"/>
  </svg>
);

const ClockIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v6l4 2"/>
  </svg>
);

// ── Custom hooks ──────────────────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const ob = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); ob.disconnect(); } },
      { threshold }
    );
    if (ref.current) ob.observe(ref.current);
    return () => ob.disconnect();
  }, []);
  return [ref, vis];
}

function useIsMobile(bp = 768) {
  const [mob, setMob] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    setMob(mq.matches);
    const h = (e) => setMob(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [bp]);
  return mob;
}

function useEasterCountdown() {
  const easterDate = new Date('2025-04-20T06:00:00');
  const [cd, setCd] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = easterDate.getTime() - Date.now();
      if (diff <= 0) { setCd({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setCd({
        days:    Math.floor(diff / 86400000),
        hours:   Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return cd;
}

function useYouTubeVideos() {
  const [videos,  setVideos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  useEffect(() => {
    api.get('/youtube/dashboard')
      .then(res => setVideos((res?.data?.data?.latestVideos ?? []).slice(0, 6)))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return { videos, loading, error };
}

function useSiteContent() {
  const [db, setDb] = useState({});
  useEffect(() => {
    siteContentApi.getAll()
      .then(res => { if (res.data?.success) setDb(res.data.data ?? {}); })
      .catch(() => {});
  }, []);
  return db;
}

// ── YouTube helpers ───────────────────────────────────────────────────────────
function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
function parseDuration(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = +(m[1]||0), mn = +(m[2]||0), s = +(m[3]||0);
  return h ? `${h}:${String(mn).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${mn}:${String(s).padStart(2,'0')}`;
}
function timeAgo(dateStr) {
  const d = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (d < 3600)    return `${Math.floor(d / 60)}m ago`;
  if (d < 86400)   return `${Math.floor(d / 3600)}h ago`;
  if (d < 2592000) return `${Math.floor(d / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Mobile Drawer ─────────────────────────────────────────────────────────────
function MobileDrawer({ open, onClose, lang, switchLang, authed, t }) {
  const navLinks = [
    { href: '#carousel', label: t.nav_services },
    { href: '#pastor',   label: t.pastor_title },
    { href: '#schedule', label: t.nav_schedule },
    { href: '#youtube',  label: 'YouTube' },
    { href: '#location', label: t.nav_location },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{
          background: 'var(--surface-overlay)',
          backdropFilter: 'blur(4px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity var(--dur-slow) var(--ease-default)',
        }}
      />
      {/* Drawer panel */}
      <div
        className="drawer drawer-left"
        style={{
          maxWidth: 300,
          background: 'var(--navy-dark)',
          borderRight: '1px solid rgba(255,255,255,.08)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform var(--dur-slow) var(--ease-default)',
          animation: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', borderBottom: '1px solid var(--border-nav)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: '1.5px solid var(--gold)' }}>
              <LutherRose size={32}/>
            </div>
            <div>
              <p className="topbar-brand" style={{ fontSize: 12 }}>KKKT DMP</p>
              <span style={{ display: 'block', fontSize: 9, color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Yombo</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost-inverse btn-icon btn-sm"
            style={{ borderRadius: 8, fontSize: 18 }}
          >×</button>
        </div>

        {/* Nav links */}
        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {navLinks.map(({ href, label }) => (
            <a
              key={href} href={href} onClick={onClose}
              className="nav-item"
              style={{ borderRadius: 10, margin: '2px 0', color: 'var(--text-nav)' }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)', flexShrink: 0, display: 'block' }}/>
              {label}
            </a>
          ))}

          {/* Social links */}
          <div style={{ padding: '10px 16px', marginTop: 8 }}>
            <p className="nav-section-label">Social Media</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {[
                { href: 'https://www.youtube.com/@KKKTDMPYOMBO', icon: <YTIcon size={15}/>, label: 'YouTube', color: '#FF0000' },
                { href: 'https://www.instagram.com/kkktyombo/', icon: <IGIcon size={15}/>, label: 'Instagram', color: '#E1306C' },
              ].map(({ href, icon, label, color }) => (
                <a
                  key={label} href={href} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 8,
                    background: `${color}18`, border: `1px solid ${color}33`,
                    color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none',
                  }}
                >
                  <span style={{ color }}>{icon}</span>{label}
                </a>
              ))}
            </div>
          </div>
        </nav>

        {/* Footer: lang toggle + CTA */}
        <div style={{ padding: '16px 16px 32px', borderTop: '1px solid var(--border-nav)' }}>
          {/* Language toggle — pill variant */}
          <div className="tabs-pill" style={{ marginBottom: 12 }}>
            {['en', 'sw'].map(l => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                className={`tab-pill${lang === l ? ' active' : ''}`}
                style={{ flex: 1, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 12 }}
              >
                {l === 'en' ? 'English' : 'Kiswahili'}
              </button>
            ))}
          </div>

          <Link
            href={authed ? '/dashboard' : '/auth/login'}
            onClick={onClose}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', borderRadius: 10 }}
          >
            {authed ? t.go_portal : t.login}
          </Link>
        </div>
      </div>
    </>
  );
}

// ── Hero Carousel ─────────────────────────────────────────────────────────────
function HeroCarousel({ lang, isMob, dbSlides }) {
  const countdown = useEasterCountdown();
  const slides = buildHeroSlides(lang, countdown, dbSlides);
  const [active,  setActive]  = useState(0);
  const [drag,    setDrag]    = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const autoRef = useRef(null);
  const [heroY, setHeroY] = useState(0);

  useEffect(() => {
    if (isMob) return;
    const fn = () => setHeroY(window.scrollY * 0.28);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [isMob]);

  const resetAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      setActive(a => (a + 1) % slides.length);
      setAnimKey(k => k + 1);
    }, 7000);
  }, [slides.length]);

  useEffect(() => { resetAuto(); return () => { if (autoRef.current) clearInterval(autoRef.current); }; }, [resetAuto]);

  const goTo = (i) => {
    setActive(((i % slides.length) + slides.length) % slides.length);
    setAnimKey(k => k + 1);
    resetAuto();
  };

  const onDown = (e) => setDrag(e.clientX ?? e.touches?.[0]?.clientX ?? null);
  const onUp   = (e) => {
    if (drag === null) return;
    const x = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    if (Math.abs(x - drag) > 40) goTo(active + (x < drag ? 1 : -1));
    setDrag(null);
  };

  const s = slides[active];

  return (
    <section
      id="home"
      className="hero bg-grid-inv"
      style={{
        minHeight: '100svh',
        padding: isMob ? '100px 24px 120px' : '0 56px',
        alignItems: 'center',
        cursor: 'grab',
      }}
      onMouseDown={onDown} onMouseUp={onUp}
      onTouchStart={onDown} onTouchEnd={onUp}
    >

      <div style={{
  position: 'absolute', inset: 0,
  background: 'var(--navy-dark)',
  pointerEvents: 'none',
}}/>

{/* Dark base — prevents white flash between slides */}
      {/* Background images */}
      {slides.map((sl, i) => (
        <div
          key={sl.id}
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url('${sl.bg}')`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            transform: isMob ? 'none' : `translateY(${heroY}px)`,
            opacity: i === active ? 0.38 : 0,
            transition: 'opacity 1s ease',
            pointerEvents: 'none',
          }}
        />
      ))}


      <div style={{
  position: 'absolute', inset: 0,
  background: 'linear-gradient(to right, rgba(6,13,26,0.82) 0%, rgba(6,13,26,0.55) 55%, rgba(6,13,26,0.25) 100%)',
  pointerEvents: 'none',
}}/>

      {/* Gold left accent */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        background: 'linear-gradient(to bottom, var(--gold), var(--gold-dark))',
      }}/>

      {/* Content */}
      <div
        key={animKey}
        className="hero-content"
        style={{ animation: 'slide-up 0.6s ease both', paddingTop: isMob ? 0 : 128, paddingBottom: isMob ? 0 : 100 }}
      >
        {/* Eyebrow */}
        <div className="hero-tag">
          <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', border: '1.5px solid var(--gold)' }}>
            <LutherRose size={20}/>
          </div>
          {s.tag}
        </div>

        {/* Title */}
        <h1 className="hero-title" style={{ fontSize: isMob ? 'clamp(3rem,14vw,4.5rem)' : 'clamp(4rem,8vw,7rem)', maxWidth: 'none' }}>
          {s.titleLines.map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
        </h1>

        {/* Subtitle */}
        <p className="hero-body" style={{ fontSize: isMob ? 14 : undefined }}>{s.sub}</p>

        {/* Countdown (MAVUNO / Easter slide) */}
        {s.isEaster && s.countdown && (
          <div style={{ display: 'flex', gap: isMob ? 8 : 14, margin: '24px 0', flexWrap: 'wrap' }}>
            {[
              { v: s.countdown.days,    l: lang === 'sw' ? 'Siku'  : 'Days'  },
              { v: s.countdown.hours,   l: lang === 'sw' ? 'Saa'   : 'Hours' },
              { v: s.countdown.minutes, l: lang === 'sw' ? 'Dak'   : 'Mins'  },
              { v: s.countdown.seconds, l: lang === 'sw' ? 'Sek'   : 'Secs'  },
            ].map(({ v, l }) => (
              <div
                key={l}
                style={{
                  background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
                  border: '1px solid var(--border-nav)', borderRadius: 10,
                  padding: isMob ? '8px 12px' : '10px 18px',
                  textAlign: 'center', minWidth: isMob ? 54 : 72,
                }}
              >
                <p className="font-mono" style={{ fontSize: isMob ? '1.4rem' : '2rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>
                  {String(v).padStart(2, '0')}
                </p>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{l}</p>
              </div>
            ))}
          </div>
        )}

        {/* Social pills (YouTube slide) */}
        {s.isDigital && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { icon: <YTIcon size={14}/>, label: '@KKKTDMPYOMBO', color: '#FF0000' },
              { icon: <IGIcon size={14}/>, label: '@kkktyombo',     color: '#E1306C' },
            ].map(({ icon, label, color }) => (
              <div
                key={label}
                className="badge"
                style={{
                  background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)',
                  border: `1px solid ${color}44`, borderRadius: 99,
                  padding: '6px 14px', color: '#fff', fontSize: 11, fontWeight: 700,
                }}
              >
                <span style={{ color }}>{icon}</span>{label}
              </div>
            ))}
          </div>
        )}

        {/* CTAs */}
        <div className="hero-actions" style={{ flexDirection: isMob ? 'column' : 'row' }}>
          {s.cta && (s.cta.external
            ? <a href={s.cta.href} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg" style={{ borderRadius: 99, gap: 8 }}>
                {s.cta.label}<ArrowRight size={13}/>
              </a>
            : <Link href={s.cta.href} className="btn btn-primary btn-lg" style={{ borderRadius: 99, gap: 8 }}>
                {s.cta.label}<ArrowRight size={13}/>
              </Link>
          )}
          {s.ctaAlt && (s.ctaAlt.external
            ? <a href={s.ctaAlt.href} target="_blank" rel="noopener noreferrer" className="btn btn-ghost-inverse btn-lg" style={{ borderRadius: 99 }}>
                {s.ctaAlt.label}
              </a>
            : <Link href={s.ctaAlt.href} className="btn btn-ghost-inverse btn-lg" style={{ borderRadius: 99 }}>
                {s.ctaAlt.label}
              </Link>
          )}
        </div>
      </div>

      {/* Slide dots */}
      <div style={{
        position: 'absolute', bottom: 28,
        left: isMob ? '50%' : 56,
        transform: isMob ? 'translateX(-50%)' : 'none',
        display: 'flex', gap: 6, zIndex: 5,
      }}>
        {slides.map((_, i) => (
          <button
            key={i} onClick={() => goTo(i)}
            style={{
              width: i === active ? 24 : 6, height: 6, borderRadius: 99,
              padding: 0, border: 'none', cursor: 'pointer',
              background: i === active ? 'var(--gold)' : 'rgba(255,255,255,0.3)',
              transition: 'all var(--dur-slow) var(--ease-default)',
            }}
          />
        ))}
      </div>

      {/* Prev / Next arrows (desktop) */}
      {!isMob && (
        <div style={{ position: 'absolute', bottom: 24, right: 40, display: 'flex', gap: 8, zIndex: 5 }}>
          {['prev', 'next'].map(dir => (
            <button
              key={dir}
              onClick={() => goTo(active + (dir === 'next' ? 1 : -1))}
              className="btn btn-ghost-inverse btn-icon"
              style={{ borderRadius: '50%', fontSize: 18, fontWeight: 700 }}
            >
              {dir === 'prev' ? '‹' : '›'}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Gallery Carousel ──────────────────────────────────────────────────────────
function GalleryCarousel({ lang, slides }) {
  const [active, setActive] = useState(0);
  const [drag,   setDrag]   = useState(null);
  const autoRef = useRef(null);
  const isMob   = useIsMobile();

  const resetAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => setActive(a => (a + 1) % slides.length), 5000);
  }, [slides.length]);

  useEffect(() => { resetAuto(); return () => { if (autoRef.current) clearInterval(autoRef.current); }; }, [resetAuto]);

  const goTo = (i) => {
    setActive(((i % slides.length) + slides.length) % slides.length);
    resetAuto();
  };

  const onDown = (e) => setDrag(e.clientX ?? e.touches?.[0]?.clientX ?? null);
  const onUp   = (e) => {
    if (drag === null) return;
    const x = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    if (Math.abs(x - drag) > 40) goTo(active + (x < drag ? 1 : -1));
    setDrag(null);
  };

  return (
    <div
      style={{
        position: 'relative', borderRadius: isMob ? 14 : 20, overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(15,31,61,0.2)',
        userSelect: 'none', touchAction: 'pan-y',
      }}
      onMouseDown={onDown} onMouseUp={onUp}
      onTouchStart={onDown} onTouchEnd={onUp}
    >
      <div style={{ position: 'relative', aspectRatio: isMob ? '4/3' : '16/7', minHeight: isMob ? 220 : 300, cursor: 'grab' }}>
        {slides.map((s, i) => (
          <div key={i} style={{ position: 'absolute', inset: 0, opacity: i === active ? 1 : 0, transition: 'opacity 0.7s ease' }}>
            <img src={s.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--navy-dark) 0%, rgba(15,35,71,0.2) 60%, transparent 100%)' }}/>
          </div>
        ))}

        {/* Caption */}
        <div style={{
          position: 'absolute', bottom: isMob ? 40 : 52,
          left: isMob ? 16 : 28, right: isMob ? 16 : 80, zIndex: 2,
        }}>
          <p style={{ color: 'var(--gold)', fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
            {active + 1} / {slides.length}
          </p>
          <p className="font-display" style={{ color: '#fff', fontSize: isMob ? '1rem' : 'clamp(1.1rem,3vw,1.5rem)', fontWeight: 800, lineHeight: 1.25, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
            {lang === 'sw' ? slides[active].captionSw : slides[active].captionEn}
          </p>
        </div>

        {/* Desktop arrows */}
        {!isMob && ['prev', 'next'].map(dir => (
          <button
            key={dir}
            onClick={() => goTo(active + (dir === 'next' ? 1 : -1))}
            className="btn btn-ghost-inverse btn-icon"
            style={{
              position: 'absolute', top: '50%',
              [dir === 'prev' ? 'left' : 'right']: 14,
              transform: 'translateY(-50%)', zIndex: 3,
              borderRadius: '50%', fontSize: 18, fontWeight: 700,
            }}
          >
            {dir === 'prev' ? '‹' : '›'}
          </button>
        ))}

        {/* Dots */}
        <div style={{ position: 'absolute', bottom: 14, left: isMob ? 16 : 28, display: 'flex', gap: 5, zIndex: 3 }}>
          {slides.map((_, i) => (
            <button
              key={i} onClick={() => goTo(i)}
              style={{
                width: i === active ? 16 : 5, height: 5, borderRadius: 99,
                padding: 0, border: 'none',
                background: i === active ? 'var(--gold)' : 'rgba(255,255,255,0.35)',
                cursor: 'pointer', transition: 'all var(--dur-slow) var(--ease-default)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Video Card ────────────────────────────────────────────────────────────────
function VideoCard({ video, isMob }) {
  return (
    <a
      href={video.url} target="_blank" rel="noopener noreferrer"
      className="card"
      style={{ display: 'block', textDecoration: 'none', color: 'inherit', transition: 'transform var(--dur-base), box-shadow var(--dur-base)' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(15,31,61,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = ''; }}
    >
      <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--navy-dark)', overflow: 'hidden', borderRadius: '6px 6px 0 0' }}>
        {video.thumbnail
          ? <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}><YTIcon size={36}/></div>
        }
        {/* Play overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0)', transition: 'background var(--dur-fast)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}
        >
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--navy)"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        {video.duration && (
          <span className="font-mono badge" style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'rgba(0,0,0,0.8)', color: '#fff',
            fontSize: 10, borderRadius: 4, padding: '2px 6px', border: 'none',
          }}>
            {parseDuration(video.duration)}
          </span>
        )}
      </div>

      <div className="card-body" style={{ padding: '12px 14px 14px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 'none' }}>
          {video.title}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {video.viewCount != null && (
            <span className="badge badge-neutral" style={{ border: 'none' }}>{fmt(video.viewCount)} views</span>
          )}
          {video.publishedAt && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{timeAgo(video.publishedAt)}</span>
          )}
        </div>
      </div>
    </a>
  );
}

function VideoSkeleton() {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="skeleton" style={{ aspectRatio: '16/9' }}/>
      <div style={{ padding: '12px 14px 14px' }}>
        <div className="skeleton" style={{ height: 13, borderRadius: 6, marginBottom: 6 }}/>
        <div className="skeleton" style={{ height: 11, borderRadius: 6, width: '60%' }}/>
      </div>
    </div>
  );
}

// ── Section header helper ─────────────────────────────────────────────────────
function SectionHeader({ eyebrow, title, body, center = false }) {
  return (
    <div style={{ marginBottom: 40, textAlign: center ? 'center' : 'left' }}>
      {eyebrow && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: center ? 'center' : 'flex-start', marginBottom: 12 }}>
          <div style={{ height: 1, width: 28, background: 'var(--gold)' }}/>
          <svg width="12" height="12" viewBox="0 0 28 28" fill="none">
            <rect x="11.5" y="2" width="5" height="24" rx="2.5" fill="var(--gold)"/>
            <rect x="2" y="10.5" width="24" height="5" rx="2.5" fill="var(--gold)"/>
          </svg>
          <div style={{ height: 1, width: 28, background: 'var(--gold)' }}/>
        </div>
      )}
      {!eyebrow && !center && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div className="gold-bar-v" style={{ height: 18 }}/>
        </div>
      )}
      <h2 className="page-header-title" style={{ background: 'none', color: 'inherit', fontSize: 'clamp(1.8rem,4vw,2.8rem)', padding: 0, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
        {title}
      </h2>
      {body && <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: center ? '48ch' : '40ch', margin: center ? '10px auto 0' : '10px 0 0' }}>{body}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [lang,       setLang]       = useState('sw');
  const [authed,     setAuthed]     = useState(false);
  const [navSolid,   setNavSolid]   = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMob = useIsMobile();
  const { videos, loading: ytLoading, error: ytError } = useYouTubeVideos();
  const db = useSiteContent();

  // Merge translations
  const tBase = T[lang];
  const tDB   = db[lang === 'en' ? 'translations_en' : 'translations_sw'] ?? {};
  const t     = { ...tBase, ...tDB };

  // Live data arrays
  const schedule      = (db.schedule       && db.schedule.length)       ? db.schedule      : DEFAULT_SCHEDULE;
  const pastorHours   = (db.pastor_hours   && db.pastor_hours.length)   ? db.pastor_hours  : DEFAULT_PASTOR_HOURS;
  const gallerySlides = (db.gallery_slides && db.gallery_slides.length) ? db.gallery_slides : DEFAULT_GALLERY_SLIDES;
  const dbHeroSlides  = db.hero_slides ?? null;

  const staffCards = (() => {
    if (db.staff && db.staff.length) return db.staff;
    return DEFAULT_STAFF.map((m, i) => {
      if (i === 0) return { ...m, name: t.pastor_name };
      return { ...m, name: lang === 'sw' ? m.nameSw : m.nameEn };
    });
  })();

  useEffect(() => {
    setAuthed(isAuthenticated());
    const saved = localStorage.getItem('church_lang');
    if (saved === 'en' || saved === 'sw') setLang(saved);
    const onScroll = () => setNavSolid(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const switchLang = (l) => { setLang(l); localStorage.setItem('church_lang', l); };

  // Reveal hooks
  const [carRef,  carVis]  = useReveal();
  const [pastRef, pastVis] = useReveal();
  const [schRef,  schVis]  = useReveal();
  const [ytRef,   ytVis]   = useReveal();
  const [mapRef,  mapVis]  = useReveal();
  const [porRef,  porVis]  = useReveal();

  const sectionPad = isMob ? '60px 0' : '88px 0';
  const pagePad    = isMob ? '0 20px' : '0 28px';

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: 'var(--surface-page)', color: 'var(--text-primary)', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        *  { box-sizing: border-box; margin: 0; padding: 0; }
        section { scroll-margin-top: 64px; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 99px; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }
      `}</style>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} lang={lang} switchLang={switchLang} authed={authed} t={t}/>

      {/* ══ NAV BAR ══════════════════════════════════════════════════════════ */}
      <nav
        className="topbar"
        style={{
          background: navSolid ? 'rgba(15,31,61,0.97)' : 'transparent',
          borderBottom: navSolid ? '1px solid var(--border-nav)' : 'none',
          backdropFilter: navSolid ? 'blur(14px)' : 'none',
          boxShadow: 'none',
          transition: 'background var(--dur-slow), border var(--dur-slow)',
          padding: `0 ${isMob ? '16px' : '32px'}`,
          gap: 16,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--gold)', flexShrink: 0 }}>
            <LutherRose size={34}/>
          </div>
          <div className="topbar-brand" style={{ color: navSolid ? '#fff' : '#fff' }}>
            KKKT DMP
            <span>Yombo</span>
          </div>
        </div>

        {/* Desktop nav links */}
        {!isMob && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {[
              ['#carousel', t.nav_services],
              ['#pastor',   t.pastor_title.split(' ').slice(-2).join(' ')],
              ['#schedule', t.nav_schedule],
              ['#youtube',  'YouTube'],
              ['#location', t.nav_location],
            ].map(([href, label]) => (
              <a
                key={href} href={href}
                className="nav-item"
                style={{ color: 'var(--text-nav)', padding: '0 2px', borderRadius: 0, background: 'transparent', width: 'auto', fontSize: 12, fontWeight: 600 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--gold)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-nav)'}
              >{label}</a>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Social icons (desktop) */}
          {!isMob && (
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { href: 'https://www.youtube.com/@KKKTDMPYOMBO', icon: <YTIcon size={14}/>, color: '#FF0000' },
                { href: 'https://www.instagram.com/kkktyombo/',  icon: <IGIcon size={14}/>, color: '#E1306C' },
              ].map(({ href, icon, color }) => (
                <a
                  key={href} href={href} target="_blank" rel="noopener noreferrer"
                  className="btn btn-ghost-inverse btn-icon btn-sm"
                  style={{ borderRadius: 8, color }}
                >
                  {icon}
                </a>
              ))}
            </div>
          )}

          {/* Language toggle */}
          <div className="tabs-pill" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', padding: 2 }}>
            {['en', 'sw'].map(l => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                className={`tab-pill${lang === l ? ' active' : ''}`}
                style={{
                  padding: isMob ? '3px 8px' : '3px 11px',
                  fontSize: isMob ? 10 : 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: lang === l ? 'var(--gold)' : 'transparent',
                  color: lang === l ? 'var(--navy-dark)' : 'rgba(255,255,255,0.6)',
                }}
              >{l}</button>
            ))}
          </div>

          {/* Auth CTA (desktop) */}
          {!isMob && (
            <Link href={authed ? '/dashboard' : '/auth/login'} className="btn btn-primary" style={{ borderRadius: 99, fontWeight: 700 }}>
              {authed ? t.go_portal : t.login}
            </Link>
          )}

          {/* Hamburger (mobile) */}
          {isMob && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="btn btn-ghost-inverse btn-icon btn-sm"
              style={{ borderRadius: 9, flexDirection: 'column', gap: 4, height: 36, width: 36 }}
            >
              {[0,1,2].map(i => <span key={i} style={{ width: 16, height: 1.5, borderRadius: 99, background: '#fff', display: 'block' }}/>)}
            </button>
          )}
        </div>
      </nav>

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <HeroCarousel lang={lang} isMob={isMob} dbSlides={dbHeroSlides}/>

      {/* ══ GALLERY ══════════════════════════════════════════════════════════ */}
      <section id="carousel" style={{ background: 'var(--surface-page)', padding: sectionPad }}>
        <div
          ref={carRef}
          style={{
            maxWidth: 1100, margin: '0 auto', padding: pagePad,
            opacity: carVis ? 1 : 0, transform: carVis ? 'none' : 'translateY(28px)',
            transition: 'opacity 0.7s, transform 0.7s',
          }}
        >
          <SectionHeader
            title={t.carousel_title}
            body={t.carousel_sub}
          />
          <GalleryCarousel lang={lang} slides={gallerySlides}/>
        </div>
      </section>

      {/* ══ STAFF / LEADERSHIP ═══════════════════════════════════════════════ */}
      <section id="pastor" style={{ background: 'var(--surface-card)', padding: sectionPad }}>
        <div
          ref={pastRef}
          style={{
            maxWidth: 1100, margin: '0 auto', padding: pagePad,
            opacity: pastVis ? 1 : 0, transform: pastVis ? 'none' : 'translateY(28px)',
            transition: 'opacity 0.7s, transform 0.7s',
          }}
        >
          <SectionHeader title={t.pastor_title} body={lang === 'sw' ? 'Viongozi wetu wa kiroho walioteuliwa kutumika.' : 'Our dedicated spiritual leaders called to serve.'} center/>

          {/* Staff cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : 'repeat(3,1fr)', gap: isMob ? 24 : 28, marginBottom: isMob ? 32 : 52 }}>
            {staffCards.map((member, idx) => (
              <div
                key={idx}
                className={member.featured ? 'card card-navy' : 'card'}
                style={{
                  overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  border: member.featured ? '1px solid var(--gold-dark)' : undefined,
                  boxShadow: member.featured ? '0 20px 60px rgba(15,31,61,0.2)' : undefined,
                  opacity: pastVis ? 1 : 0,
                  transform: pastVis ? 'none' : 'translateY(20px)',
                  transition: `opacity 0.7s ease ${idx * 120}ms, transform 0.7s ease ${idx * 120}ms`,
                }}
              >
                {/* Photo */}
                <div style={{ position: 'relative', aspectRatio: '3/4', background: 'linear-gradient(160deg, var(--navy) 0%, var(--navy-dark) 100%)', overflow: 'hidden' }}>
                  <img
                    src={member.photo}
                    alt={lang === 'sw' ? (member.altSw ?? member.roleSw ?? '') : (member.altEn ?? member.roleEn ?? '')}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
                    onError={e => {
                      e.currentTarget.style.display = 'none';
                      const sib = e.currentTarget.nextElementSibling;
                      if (sib) sib.style.display = 'flex';
                    }}
                  />
                  <div style={{ display: 'none', position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none"><circle cx="32" cy="24" r="14" fill="rgba(196,154,42,0.25)"/><ellipse cx="32" cy="58" rx="22" ry="14" fill="rgba(196,154,42,0.12)"/></svg>
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: member.featured ? 'linear-gradient(to top, var(--navy-dark), transparent)' : 'linear-gradient(to top, rgba(15,31,61,0.85), transparent)' }}/>
                </div>

                {/* Card body */}
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <span className={`badge ${member.featured ? 'badge-gold' : 'badge-navy'}`} style={{ alignSelf: 'flex-start', marginBottom: 4 }}>
                    {lang === 'sw' ? (member.badgeSw ?? '') : (member.badgeEn ?? '')}
                  </span>
                  <h3 className="card-title" style={{ color: member.featured ? '#fff' : undefined, fontSize: isMob ? '1.25rem' : '1.4rem', letterSpacing: '-0.01em' }}>
                    {member.name ?? (lang === 'sw' ? member.nameSw : member.nameEn)}
                  </h3>
                  <p className="card-subtitle" style={{ color: member.featured ? 'rgba(255,255,255,0.45)' : undefined, marginBottom: 8 }}>
                    {lang === 'sw' ? (member.roleSw ?? '') : (member.roleEn ?? '')}
                  </p>
                  {member.bio && (
                    <p style={{ fontSize: 12, color: member.featured ? 'rgba(255,255,255,0.55)' : 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 'none' }}>
                      {member.bio}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bio + Office Hours */}
          <div
            className="card"
            style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : '1fr 1fr', gap: isMob ? 28 : 48, alignItems: 'start', padding: isMob ? '24px 20px' : '40px 44px' }}
          >
            {/* Bio column */}
            <div>
              <p className="page-header-eyebrow" style={{ color: 'var(--gold)', background: 'none', marginBottom: 10 }}>
                {lang === 'sw' ? 'Kuhusu Mchungaji' : 'About the Pastor'}
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 20, maxWidth: '36ch' }}>
                {t.pastor_bio}
              </p>
              <Link href="/auth/register" className="btn btn-primary" style={{ borderRadius: 99, gap: 8 }}>
                {t.pastor_meet}<ArrowRight size={12}/>
              </Link>
            </div>

            {/* Office hours card */}
            <div>
              <div className="card" style={{ overflow: 'hidden', boxShadow: 'none', border: '1px solid var(--border-default)' }}>
                <div className="card-header" style={{ background: 'var(--navy)', padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ClockIcon size={16}/>
                    <h4 className="card-title" style={{ color: '#fff', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {t.pastor_hours_title}
                    </h4>
                  </div>
                </div>
                <div style={{ padding: '8px 4px' }}>
                  {pastorHours.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 16px', borderRadius: 10, margin: '2px 4px',
                        background: i % 2 === 0 ? 'var(--surface-page)' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="status-dot active"/>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{t.days[h.dayKey]}</span>
                      </div>
                      <span className="font-mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {lang === 'sw' ? h.timeSw : h.timeEn}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="card-footer">
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', lineHeight: 1.5, maxWidth: 'none' }}>
                    * {t.pastor_hours_note}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Social links */}
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            {[
              { href: 'https://www.youtube.com/@KKKTDMPYOMBO', icon: <YTIcon size={15}/>, label: 'YouTube', color: '#FF0000' },
              { href: 'https://www.instagram.com/kkktyombo/',  icon: <IGIcon size={15}/>, label: 'Instagram', color: '#E1306C' },
            ].map(({ href, icon, label, color }) => (
              <a
                key={label} href={href} target="_blank" rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ borderRadius: 10, gap: 6, fontWeight: 700 }}
                onMouseEnter={e => { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.borderColor = `${color}44`; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = ''; }}
              >
                <span style={{ color }}>{icon}</span>{label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SCHEDULE ═════════════════════════════════════════════════════════ */}
      <section id="schedule" style={{ background: 'var(--surface-page)', padding: sectionPad }}>
        <div
          ref={schRef}
          style={{
            maxWidth: 860, margin: '0 auto', padding: pagePad,
            opacity: schVis ? 1 : 0, transform: schVis ? 'none' : 'translateY(28px)',
            transition: 'opacity 0.7s, transform 0.7s',
          }}
        >
          <SectionHeader title={t.schedule_title} body={t.schedule_sub} center/>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {schedule.map((s, i) => (
              <div
                key={i}
                className={s.highlight ? 'card card-navy' : 'card'}
                style={{
                  display: 'flex', alignItems: 'stretch',
                  borderLeft: `4px solid ${s.highlight ? 'var(--gold)' : 'var(--border-strong)'}`,
                  borderRadius: 12, overflow: 'hidden', padding: 0,
                  boxShadow: s.highlight ? '0 4px 18px rgba(15,31,61,0.15)' : undefined,
                  opacity: schVis ? 1 : 0,
                  transform: schVis ? 'none' : 'translateX(-16px)',
                  transition: `opacity 0.5s ease ${i * 65}ms, transform 0.5s ease ${i * 65}ms`,
                }}
              >
                {/* Time column */}
                <div style={{
                  flexShrink: 0, width: isMob ? 86 : 108,
                  padding: isMob ? '14px 10px' : '18px 16px',
                  borderRight: `1px solid ${s.highlight ? 'rgba(255,255,255,0.1)' : 'var(--border-subtle)'}`,
                }}>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: s.highlight ? 'var(--gold)' : 'var(--navy)', marginBottom: 2 }}>
                    {t.days[s.dayKey]}
                  </p>
                  <p className="font-mono" style={{ fontSize: isMob ? 11 : 12, fontWeight: 600, color: s.highlight ? 'rgba(255,255,255,0.55)' : 'var(--text-secondary)' }}>
                    {s.time}
                  </p>
                </div>

                {/* Service name */}
                <div style={{ flex: 1, padding: isMob ? '14px 12px' : '18px 20px', display: 'flex', alignItems: 'center' }}>
                  <p style={{ fontSize: isMob ? 13 : 14, fontWeight: s.highlight ? 700 : 600, color: s.highlight ? '#fff' : 'var(--text-primary)', lineHeight: 1.35, maxWidth: 'none' }}>
                    {lang === 'sw' ? s.serviceSw : s.serviceEn}
                  </p>
                </div>

                {/* Badge (desktop highlight rows) */}
                {s.highlight && !isMob && (
                  <div style={{ padding: '0 18px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <span className="badge badge-gold">{lang === 'sw' ? 'Muhimu' : 'Main'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 20, fontStyle: 'italic' }}>
            * {t.schedule_note}
          </p>
        </div>
      </section>

      {/* ══ YOUTUBE ══════════════════════════════════════════════════════════ */}
      <section id="youtube" style={{ background: 'var(--surface-card)', padding: sectionPad }}>
        <div
          ref={ytRef}
          style={{
            maxWidth: 1100, margin: '0 auto', padding: pagePad,
            opacity: ytVis ? 1 : 0, transform: ytVis ? 'none' : 'translateY(28px)',
            transition: 'opacity 0.7s, transform 0.7s',
          }}
        >
          {/* Section header + CTA row */}
          <div style={{ display: 'flex', alignItems: isMob ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMob ? 'column' : 'row', gap: 16, marginBottom: isMob ? 24 : 40 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div className="gold-bar-v" style={{ height: 18, background: '#FF0000' }}/>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                  {lang === 'sw' ? 'Chaneli Mpya' : 'New Channel'}
                </span>
              </div>
              <h2 className="font-display" style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 700, color: 'var(--navy)', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 8 }}>
                {t.youtube_title}
              </h2>
              <p style={{ fontSize: isMob ? 13 : 14, color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 420 }}>{t.youtube_sub}</p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
              <a href="https://www.youtube.com/@KKKTDMPYOMBO" target="_blank" rel="noopener noreferrer" className="btn btn-danger btn-lg" style={{ background: '#FF0000', borderColor: '#FF0000', borderRadius: 99, gap: 7, boxShadow: '0 4px 16px rgba(255,0,0,0.3)' }}>
                <YTIcon size={16}/>{t.youtube_cta}
              </a>
              <a href="https://www.instagram.com/kkktyombo/" target="_blank" rel="noopener noreferrer" className="btn btn-lg" style={{ background: 'linear-gradient(135deg,#405DE6,#5851DB,#833AB4,#C13584,#E1306C,#FD1D1D)', color: '#fff', border: 'none', borderRadius: 99, gap: 7, boxShadow: '0 4px 16px rgba(225,48,108,0.3)' }}>
                <IGIcon size={16}/>Instagram
              </a>
            </div>
          </div>

          {/* Video grid */}
          {ytLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : 'repeat(3,1fr)', gap: 16 }}>
              {[1,2,3,4,5,6].map(i => <VideoSkeleton key={i}/>)}
            </div>
          ) : ytError || videos.length === 0 ? (
            <div className="empty-state card" style={{ padding: isMob ? '32px 20px' : '48px 40px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <YTIcon size={28}/>
              </div>
              <p className="empty-state-title">{t.youtube_empty}</p>
              <div className="empty-state-actions">
                <a href="https://www.youtube.com/@KKKTDMPYOMBO" target="_blank" rel="noopener noreferrer" className="btn btn-danger" style={{ background: '#FF0000', borderColor: '#FF0000', borderRadius: 99, gap: 6 }}>
                  <YTIcon size={14}/>@KKKTDMPYOMBO
                </a>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
              {videos.map((v) => <VideoCard key={v.id} video={v} isMob={isMob}/>)}
            </div>
          )}

          {videos.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <a href="https://www.youtube.com/@KKKTDMPYOMBO" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-lg" style={{ borderRadius: 99 }}>
                {lang === 'sw' ? 'Tazama video zote →' : 'View all videos →'}
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ══ MAP / LOCATION ════════════════════════════════════════════════════ */}
      <section id="location" style={{ background: 'var(--navy-dark)', padding: sectionPad }}>
        <div
          ref={mapRef}
          style={{
            maxWidth: 1100, margin: '0 auto', padding: pagePad,
            opacity: mapVis ? 1 : 0, transform: mapVis ? 'none' : 'translateY(28px)',
            transition: 'opacity 0.7s, transform 0.7s',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : '1fr 1fr', gap: isMob ? 28 : 48, alignItems: 'center' }}>
            {/* Text column */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div className="gold-bar-v" style={{ height: 18 }}/>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--gold)' }}>{t.nav_location}</span>
              </div>
              <h2 className="font-display" style={{ fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 14 }}>
                {t.map_title}
              </h2>
              <p style={{ fontSize: isMob ? 13 : 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 22, maxWidth: '36ch' }}>
                {t.map_sub}
              </p>

              {/* Address banner */}
              <div className="banner banner-navy" style={{ borderColor: 'var(--gold-dark)', borderRadius: 12 }}>
                <MapPin size={16}/>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, maxWidth: 'none' }}>
                  {t.map_address}
                </p>
              </div>
            </div>

            {/* Map embed */}
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '2px solid var(--gold-dark)', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d70476.635097538!2d39.2377202!3d-6.864696!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x185c4a001f086fdb%3A0x8bf3060642c53afa!2sKanisa%20La%20Kiinjili%20La%20Kilutheri%20Ushirika%20Wa%20Yombo!5e1!3m2!1sen!2stz!4v1775278389841!5m2!1sen!2stz"
                width="100%" height={isMob ? 280 : 380}
                style={{ border: 0, display: 'block' }}
                allowFullScreen loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="KKKT DMP Yombo"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══ PORTAL CTA ═══════════════════════════════════════════════════════ */}
      <section style={{ background: 'var(--surface-page)', padding: sectionPad, position: 'relative', overflow: 'hidden' }}>
        {/* Subtle pattern */}
        <div className="bg-grid" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5 }}/>

        <div
          ref={porRef}
          style={{
            maxWidth: 740, margin: '0 auto', padding: pagePad,
            textAlign: 'center', position: 'relative', zIndex: 1,
            opacity: porVis ? 1 : 0, transform: porVis ? 'none' : 'translateY(28px)',
            transition: 'opacity 0.7s, transform 0.7s',
          }}
        >
          {/* Luther rose badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--gold)', boxShadow: '0 0 0 6px rgba(196,154,42,0.12)' }}>
              <LutherRose size={64}/>
            </div>
          </div>

          {/* Divider label */}
          <div className="divider-label" style={{ justifyContent: 'center', marginBottom: 20 }}>
            <div className="divider-gold" style={{ width: 32 }}/>
            <svg width="12" height="12" viewBox="0 0 28 28" fill="none">
              <rect x="11.5" y="2" width="5" height="24" rx="2.5" fill="var(--gold)"/>
              <rect x="2" y="10.5" width="24" height="5" rx="2.5" fill="var(--gold)"/>
            </svg>
            <div className="divider-gold" style={{ width: 32 }}/>
          </div>

          <h2 className="font-display" style={{ fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 700, color: 'var(--navy)', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 14 }}>
            {t.portal_title}
          </h2>
          <p style={{ fontSize: isMob ? 13 : 15, color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 500, margin: '0 auto 28px' }}>
            {t.portal_sub}
          </p>

          {/* Feature badges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
            {t.portal_features.map((f, i) => (
              <span key={i} className="badge badge-navy" style={{ fontSize: isMob ? 11 : 12 }}>
                <span className="status-dot active" style={{ width: 6, height: 6 }}/>
                {f}
              </span>
            ))}
          </div>

          {/* CTA buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', flexDirection: isMob ? 'column' : 'row', alignItems: 'center' }}>
            <Link href="/auth/register" className="btn btn-primary btn-xl" style={{ borderRadius: 99, gap: 8, ...(isMob ? { width: '100%' } : {}) }}>
              {t.portal_cta}<ArrowRight size={13}/>
            </Link>
            <Link href="/auth/login" className="btn btn-secondary btn-xl" style={{ borderRadius: 99, ...(isMob ? { width: '100%' } : {}) }}>
              {t.portal_login}
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════ */}
      <footer style={{ background: 'var(--navy-dark)', borderTop: '1px solid var(--gold-dark)', padding: isMob ? '28px 20px' : '36px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', border: '1.5px solid var(--gold)', flexShrink: 0 }}>
                <LutherRose size={36}/>
              </div>
              <div className="topbar-brand" style={{ color: '#fff' }}>
                KKKT DMP YOMBO
                <span>Kanisa La Kiinjili La Kilutheri</span>
              </div>
            </div>

            {/* Social */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { href: 'https://www.youtube.com/@KKKTDMPYOMBO', icon: <YTIcon size={16}/>, label: 'YouTube', color: '#FF0000' },
                { href: 'https://www.instagram.com/kkktyombo/',  icon: <IGIcon size={16}/>, label: 'Instagram', color: '#E1306C' },
              ].map(({ href, icon, label, color }) => (
                <a
                  key={label} href={href} target="_blank" rel="noopener noreferrer"
                  className="btn btn-ghost-inverse"
                  style={{ borderRadius: 99, gap: 6, fontSize: 11 }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.borderColor = `${color}44`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = ''; }}
                >
                  <span style={{ color }}>{icon}</span>{label}
                </a>
              ))}
            </div>
          </div>

          <div className="divider" style={{ borderColor: 'var(--gold-dark)', marginBottom: 16 }}/>

          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontWeight: 500, textAlign: 'center', maxWidth: 'none' }}>
            © {new Date().getFullYear()} KKKT DMP Yombo. {t.footer_rights}
          </p>
        </div>
      </footer>
    </div>
  );
}