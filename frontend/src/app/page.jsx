'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { isAuthenticated } from '../lib/auth';
import api from '../lib/api';

// ── Palette ───────────────────────────────────────────────────────
const C = {
  navy:  '#1B3A6B', navyD: '#0f2347', navyL: '#EEF2F8',
  gold:  '#C8A84B', goldL: '#FDF5E0',
  cream: '#FAFAF7', stone: '#F3F1EC',
  ink:   '#0f172a', muted: '#64748b', faint: '#94a3b8',
};

// ── Translations ──────────────────────────────────────────────────
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
    pastor_bio: 'Leading our congregation with faith, wisdom, and love. Pastor Delemi shepherds the Yombo community with a heart for God and the people of Dar es Salaam.',
    pastor_meet: 'Meet with Pastor Delemi',
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
    carousel_title: 'Maisha Yombo',
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
    portal_login: 'Tayari mwanachama? Ingia',
    portal_features: ['Matangazo & arifa', 'Ratiba za vikundi', 'Ukumbusho wa matukio', 'Rasilimali za kidijitali'],
    footer_rights: 'Haki zote zimehifadhiwa.',
    pastor_title: 'Mkutane na Mchungaji Wetu',
    pastor_name: 'Mchungaji Delemi',
    pastor_role: 'Mchungaji Mkuu, KKKT DMP Yombo',
    pastor_bio: 'Anaongoza mkutano wetu kwa imani, hekima, na upendo. Mchungaji Delemi anachunga jumuia ya Yombo kwa moyo wa Mungu na watu wa Dar es Salaam.',
    pastor_meet: 'Mkutane na Mchungaji Delemi',
    pastor_hours_title: 'Masaa ya Ofisi ya Uchungaji',
    pastor_hours_note: 'Karibu bila miadi. Kwa mambo ya haraka, wasiliana na ofisi ya kanisa.',
    youtube_title: 'Tazama & Abudu',
    youtube_sub: 'Mahubiri, sifa, na ibada — wakati wowote, mahali popote.',
    youtube_cta: 'Jiunge YouTube',
    youtube_empty: 'Video mpya zinakuja hivi karibuni. Jiunge ili upate arifa!',
    days: { sunday: 'Jumapili', monday: 'Jumatatu', tuesday: 'Jumanne', wednesday: 'Jumatano', thursday: 'Alhamisi', friday: 'Ijumaa', saturday: 'Jumamosi' },
  },
};

const SCHEDULE = [
  { dayKey: 'sunday',    time: '7:00 AM',  serviceEn: 'Early Morning Service',     serviceSw: 'Ibada ya Asubuhi',         highlight: true  },
  { dayKey: 'sunday',    time: '10:00 AM', serviceEn: 'Main Sunday Worship',        serviceSw: 'Ibada Kuu ya Jumapili',    highlight: true  },
  { dayKey: 'sunday',    time: '3:00 PM',  serviceEn: 'Youth & Children Service',   serviceSw: 'Ibada ya Vijana & Watoto', highlight: false },
  { dayKey: 'wednesday', time: '5:30 PM',  serviceEn: 'Midweek Bible Study',        serviceSw: 'Mafunzo ya Biblia',        highlight: false },
  { dayKey: 'friday',    time: '6:00 PM',  serviceEn: 'Friday Prayer Night',        serviceSw: 'Usiku wa Sala',            highlight: true  },
  { dayKey: 'saturday',  time: '9:00 AM',  serviceEn: 'Choir & Ministry Rehearsal', serviceSw: 'Mazoezi ya Kwaya',         highlight: false },
];

const PASTOR_HOURS = [
  { dayKey: 'monday',    timeEn: '9:00 AM – 12:00 PM',  timeSw: '9:00 – 12:00 Asubuhi'  },
  { dayKey: 'tuesday',   timeEn: '2:00 PM – 5:00 PM',   timeSw: '2:00 – 5:00 Mchana'    },
  { dayKey: 'wednesday', timeEn: '9:00 AM – 11:00 AM',  timeSw: '9:00 – 11:00 Asubuhi'  },
  { dayKey: 'thursday',  timeEn: '2:00 PM – 5:00 PM',   timeSw: '2:00 – 5:00 Mchana'    },
  { dayKey: 'friday',    timeEn: '10:00 AM – 12:00 PM', timeSw: '10:00 – 12:00 Asubuhi' },
];

// ── Hero Slides ───────────────────────────────────────────────────
// Each slide has: type, bgImage, accent color override, content fn
const getHeroSlides = (lang, countdown) => [
  {
    id: 'welcome',
    bg: '/worship1.jpg',
    tag: lang === 'sw' ? 'Kanisa La Kiinjili La Kilutheri' : 'Kanisa La Kiinjili La Kilutheri',
    titleLines: ['KKKT DMP', 'YOMBO'],
    sub: lang === 'sw'
      ? 'Jumuia ya imani, upendo, na ibada huko Dar es Salaam.'
      : 'A community of faith, love, and worship in Dar es Salaam.',
    cta: { label: lang === 'sw' ? 'Jiunge Nasi' : 'Join Our Community', href: '/auth/register' },
    ctaAlt: { label: lang === 'sw' ? 'Ingia' : 'Sign In', href: '/auth/login' },
  },
  {
    id: 'easter',
    bg: '/pasaka.jpeg',
    tag: lang === 'sw' ? 'Matukio Maalum' : 'Special Event',
    titleLines: lang === 'sw' ? ['PASAKA', '2026'] : ['EASTER', '2026'],
    sub: lang === 'sw'
      ? 'Tunaadhimisha ufufuo wa Bwana wetu Yesu Kristo. Karibuni kwenye ibada zetu za Pasaka.'
      : 'Celebrating the resurrection of our Lord Jesus Christ. Join us for our special Easter services.',
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
      : 'We\'ve launched our YouTube channel! Watch our sermons and worship sessions anytime, anywhere.',
    cta: { label: lang === 'sw' ? 'Jiunge YouTube' : 'Subscribe on YouTube', href: 'https://www.youtube.com/@KKKTDMPYOMBO', external: true },
    ctaAlt: { label: lang === 'sw' ? 'Fuata Instagram' : 'Follow on Instagram', href: 'https://www.instagram.com/kkktyombo/', external: true },
    isDigital: true,
  },
  {
    id: 'community',
    bg: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1800&q=70',
    tag: lang === 'sw' ? 'Ushirika' : 'Community',
    titleLines: lang === 'sw' ? ['JIUNGE', 'NASI'] : ['BE PART', 'OF US'],
    sub: lang === 'sw'
      ? 'Jiandikishe kwenye mfumo wetu wa kidijitali na upate matangazo, ratiba, na rasilimali maalum.'
      : 'Register on our digital portal to access announcements, schedules, and exclusive resources.',
    cta: { label: lang === 'sw' ? 'Jiandikishe Sasa' : 'Register Now', href: '/auth/register' },
    ctaAlt: { label: lang === 'sw' ? 'Jifunze Zaidi' : 'Learn More', href: '#carousel' },
  },
];

const GALLERY_SLIDES = [
  { url: 'https://images.unsplash.com/photo-1438032005730-c779502df39b?w=1200&q=80', captionEn: 'Sunday Worship',         captionSw: 'Ibada ya Jumapili' },
  { url: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1200&q=80', captionEn: 'Community & Fellowship', captionSw: 'Ushirika & Umoja' },
  { url: '/kwaya.jpg', captionEn: 'Choir Ministration',     captionSw: 'Huduma ya Kwaya' },
  { url: '/worship2.jpg', captionEn: 'Prayer & Intercession',  captionSw: 'Sala na Uombezi' },
  { url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80', captionEn: 'Youth Ministry',         captionSw: 'Huduma ya Vijana' },
  { url: 'https://images.unsplash.com/photo-1519834785169-98be25ec3f84?w=1200&q=80', captionEn: 'Special Events',         captionSw: 'Matukio Maalum' },
];

// ── SVG atoms ─────────────────────────────────────────────────────
const Rings = ({ size = 120, opacity = 0.06, color = C.gold }) => (
  <svg width={size} height={size} viewBox="0 0 120 120" fill="none" style={{ opacity, pointerEvents: 'none' }}>
    <circle cx="60" cy="60" r="54" stroke={color} strokeWidth="1.5"/>
    <circle cx="60" cy="60" r="38" stroke={color} strokeWidth="1"/>
    <circle cx="60" cy="60" r="21" stroke={color} strokeWidth="0.6"/>
  </svg>
);
const CrossSVG = ({ size = 28, color = C.gold, opacity = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" style={{ opacity }}>
    <rect x="11.5" y="2" width="5" height="24" rx="2.5" fill={color}/>
    <rect x="2" y="10.5" width="24" height="5" rx="2.5" fill={color}/>
  </svg>
);
const DotGrid = ({ cols = 5, rows = 3, gap = 12, color = C.gold, opacity = 0.15 }) => (
  <svg width={cols * gap} height={rows * gap} style={{ opacity, pointerEvents: 'none' }}>
    {Array.from({ length: rows }).flatMap((_, r) =>
      Array.from({ length: cols }).map((_, c) => (
        <circle key={`${r}-${c}`} cx={c * gap + gap / 2} cy={r * gap + gap / 2} r="1.5" fill={color}/>
      ))
    )}
  </svg>
);
const LutherRose = ({ size = 80 }) => (
  <img src="/luther.webp" alt="Luther Rose" width={size} height={size} style={{ objectFit: 'contain', display: 'block' }}/>
);

// YouTube icon
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

// ── Reveal hook ───────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); ob.disconnect(); } }, { threshold });
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
    const h = e => setMob(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [bp]);
  return mob;
}

// ── Easter Countdown ──────────────────────────────────────────────
function useEasterCountdown() {
  // Easter Sunday 2025 = April 20
  const easterDate = new Date('2025-04-20T06:00:00');
  const [cd, setCd] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const tick = () => {
      const diff = easterDate - Date.now();
      if (diff <= 0) { setCd({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      const days    = Math.floor(diff / 86400000);
      const hours   = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCd({ days, hours, minutes, seconds });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return cd;
}

// ── YouTube data hook ─────────────────────────────────────────────
function useYouTubeVideos() {
  const [videos,  setVideos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/youtube/dashboard');
        const vids = res?.data?.data?.latestVideos ?? [];
        setVideos(vids.slice(0, 6));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { videos, loading, error };
}

// ── Hero Carousel ─────────────────────────────────────────────────
function HeroCarousel({ lang, isMob }) {
  const countdown = useEasterCountdown();
  const slides = getHeroSlides(lang, countdown);

  const [active,   setActive]   = useState(0);
  const [drag,     setDrag]     = useState(null);
  const [animKey,  setAnimKey]  = useState(0);
  const autoRef = useRef(null);

  const [heroY, setHeroY] = useState(0);
  useEffect(() => {
    if (isMob) return;
    const fn = () => setHeroY(window.scrollY * 0.28);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [isMob]);

  const resetAuto = useCallback(() => {
    clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      setActive(a => (a + 1) % slides.length);
      setAnimKey(k => k + 1);
    }, 7000);
  }, [slides.length]);

  useEffect(() => { resetAuto(); return () => clearInterval(autoRef.current); }, [resetAuto]);

  const goTo = i => {
    setActive((i + slides.length) % slides.length);
    setAnimKey(k => k + 1);
    resetAuto();
  };

  const onDown = e => setDrag(e.clientX ?? e.touches?.[0]?.clientX ?? null);
  const onUp   = e => {
    if (drag === null) return;
    const x = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    if (Math.abs(x - drag) > 40) goTo(active + (x < drag ? 1 : -1));
    setDrag(null);
  };

  const s = slides[active];

  return (
    <section id="home" style={{ position: 'relative', minHeight: '100svh', display: 'flex', alignItems: 'center', overflow: 'hidden', background: C.navyD }}
      onMouseDown={onDown} onMouseUp={onUp}
      onTouchStart={onDown} onTouchEnd={onUp}
    >
      {/* Backgrounds — crossfade */}
      {slides.map((sl, i) => (
        <div key={sl.id} style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url('${sl.bg}')`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          transform: isMob ? 'none' : `translateY(${heroY}px)`,
          opacity: i === active ? 0.2 : 0,
          transition: 'opacity 1s ease',
        }}/>
      ))}

      {/* Decorative */}
      {!isMob && (
        <>
          <div style={{ position: 'absolute', top: '8%', right: '4%', pointerEvents: 'none' }}><Rings size={260} opacity={0.07}/></div>
          <div style={{ position: 'absolute', bottom: '10%', left: '3%', pointerEvents: 'none' }}><DotGrid cols={7} rows={4} gap={14} color={C.gold} opacity={0.11}/></div>
        </>
      )}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: `linear-gradient(to bottom, ${C.gold}, ${C.gold}22)` }}/>

      {/* Content — animated on slide change */}
      <div key={animKey} style={{
        position: 'relative', zIndex: 2,
        padding: isMob ? '100px 24px 120px' : '128px 56px 100px',
        maxWidth: isMob ? '100%' : 920,
        animation: 'heroIn 0.6s ease both',
      }}>
        {/* Tag */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: isMob ? 20 : 28 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', border: `1.5px solid ${C.gold}` }}>
            <LutherRose size={24}/>
          </div>
          <span className="im" style={{ fontSize: isMob ? 11 : 13, letterSpacing: '0.06em', color: C.gold }}>
            {s.tag}
          </span>
        </div>

        {/* Title */}
        <h1 className="cg" style={{
          fontSize: isMob ? 'clamp(3rem,14vw,5rem)' : 'clamp(4rem,8vw,7rem)',
          fontWeight: 700, color: '#fff', lineHeight: 1.0,
          letterSpacing: '-0.02em', marginBottom: isMob ? 16 : 24,
          textShadow: '0 4px 32px rgba(0,0,0,0.5)',
        }}>
          {s.titleLines.map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
        </h1>

        <p style={{
          fontSize: isMob ? 14 : 'clamp(1rem,2vw,1.15rem)',
          fontWeight: 400, color: 'rgba(255,255,255,0.68)',
          lineHeight: 1.7, maxWidth: 480, marginBottom: isMob ? 20 : 28,
        }}>
          {s.sub}
        </p>

        {/* Easter countdown */}
        {s.isEaster && s.countdown && (
          <div style={{ display: 'flex', gap: isMob ? 8 : 14, marginBottom: isMob ? 24 : 32, flexWrap: 'wrap' }}>
            {[
              { v: s.countdown.days,    l: lang === 'sw' ? 'Siku' : 'Days'    },
              { v: s.countdown.hours,   l: lang === 'sw' ? 'Saa'  : 'Hours'   },
              { v: s.countdown.minutes, l: lang === 'sw' ? 'Dak'  : 'Mins'    },
              { v: s.countdown.seconds, l: lang === 'sw' ? 'Sek'  : 'Secs'    },
            ].map(({ v, l }) => (
              <div key={l} style={{
                background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
                border: `1px solid ${C.gold}44`, borderRadius: 10,
                padding: isMob ? '8px 12px' : '10px 18px', textAlign: 'center', minWidth: isMob ? 54 : 72,
              }}>
                <p className="mono" style={{ fontSize: isMob ? '1.4rem' : '2rem', fontWeight: 800, color: C.gold, lineHeight: 1 }}>
                  {String(v).padStart(2, '0')}
                </p>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>{l}</p>
              </div>
            ))}
          </div>
        )}

        {/* Digital launch badges */}
        {s.isDigital && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { icon: <YTIcon size={14}/>, label: '@KKKTDMPYOMBO', color: '#FF0000' },
              { icon: <IGIcon size={14}/>, label: '@kkktyombo', color: '#E1306C' },
            ].map(({ icon, label, color }) => (
              <div key={label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)',
                border: `1px solid ${color}44`, borderRadius: 99,
                padding: '5px 12px', color: '#fff', fontSize: 11, fontWeight: 700,
              }}>
                <span style={{ color }}>{icon}</span>
                {label}
              </div>
            ))}
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flexDirection: isMob ? 'column' : 'row' }}>
          {s.cta && (
            s.cta.external
              ? <a href={s.cta.href} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: isMob ? '13px 24px' : '14px 30px', borderRadius: 99,
                  background: C.gold, color: C.navy,
                  fontSize: 14, fontWeight: 800, letterSpacing: '0.02em',
                  boxShadow: `0 4px 20px ${C.gold}55`, textDecoration: 'none',
                }}>
                  {s.cta.label}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>
              : <Link href={s.cta.href} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: isMob ? '13px 24px' : '14px 30px', borderRadius: 99,
                  background: C.gold, color: C.navy,
                  fontSize: 14, fontWeight: 800, letterSpacing: '0.02em',
                  boxShadow: `0 4px 20px ${C.gold}55`,
                }}>
                  {s.cta.label}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
          )}
          {s.ctaAlt && (
            s.ctaAlt.external
              ? <a href={s.ctaAlt.href} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: isMob ? '12px 24px' : '14px 28px', borderRadius: 99,
                  background: 'rgba(255,255,255,0.1)', color: '#fff',
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  backdropFilter: 'blur(6px)',
                }}>
                  {s.ctaAlt.label}
                </a>
              : <Link href={s.ctaAlt.href} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: isMob ? '12px 24px' : '14px 28px', borderRadius: 99,
                  background: 'rgba(255,255,255,0.1)', color: '#fff',
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  fontSize: 14, fontWeight: 700,
                  backdropFilter: 'blur(6px)',
                }}>
                  {s.ctaAlt.label}
                </Link>
          )}
        </div>
      </div>

      {/* Slide indicators */}
      <div style={{ position: 'absolute', bottom: 28, left: isMob ? '50%' : 56, transform: isMob ? 'translateX(-50%)' : 'none', display: 'flex', gap: 6, zIndex: 5 }}>
        {slides.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} style={{
            width: i === active ? 24 : 6, height: 6, borderRadius: 99,
            padding: 0, border: 'none', cursor: 'pointer',
            background: i === active ? C.gold : 'rgba(255,255,255,0.3)',
            transition: 'all 0.3s ease',
          }}/>
        ))}
      </div>

      {/* Arrow nav — desktop */}
      {!isMob && (
        <div style={{ position: 'absolute', bottom: 24, right: 40, display: 'flex', gap: 8, zIndex: 5 }}>
          {['prev', 'next'].map(dir => (
            <button key={dir} onClick={() => goTo(active + (dir === 'next' ? 1 : -1))} style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)',
              border: '1.5px solid rgba(255,255,255,0.22)',
              color: '#fff', fontSize: 18, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = C.gold + 'bb'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            >
              {dir === 'prev' ? '‹' : '›'}
            </button>
          ))}
        </div>
      )}

      {/* Scroll cue */}
      <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: isMob ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 1, height: 28, background: `linear-gradient(to bottom, ${C.gold}66, transparent)` }}/>
      </div>
    </section>
  );
}

// ── Gallery Carousel ──────────────────────────────────────────────
function GalleryCarousel({ lang }) {
  const [active, setActive] = useState(0);
  const [drag,   setDrag]   = useState(null);
  const autoRef = useRef(null);
  const isMob   = useIsMobile();

  const resetAuto = useCallback(() => {
    clearInterval(autoRef.current);
    autoRef.current = setInterval(() => setActive(a => (a + 1) % GALLERY_SLIDES.length), 5000);
  }, []);
  useEffect(() => { resetAuto(); return () => clearInterval(autoRef.current); }, [resetAuto]);
  const goTo = i => { setActive((i + GALLERY_SLIDES.length) % GALLERY_SLIDES.length); resetAuto(); };
  const onDown = e => setDrag(e.clientX ?? e.touches?.[0]?.clientX ?? null);
  const onUp   = e => {
    if (drag === null) return;
    const x = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    if (Math.abs(x - drag) > 40) goTo(active + (x < drag ? 1 : -1));
    setDrag(null);
  };

  return (
    <div style={{ position: 'relative', borderRadius: isMob ? 14 : 20, overflow: 'hidden', boxShadow: `0 16px 48px ${C.navy}33`, userSelect: 'none', touchAction: 'pan-y' }}
      onMouseDown={onDown} onMouseUp={onUp} onTouchStart={onDown} onTouchEnd={onUp}
    >
      <div style={{ position: 'relative', aspectRatio: isMob ? '4/3' : '16/7', minHeight: isMob ? 220 : 300, cursor: 'grab' }}>
        {GALLERY_SLIDES.map((s, i) => (
          <div key={i} style={{ position: 'absolute', inset: 0, opacity: i === active ? 1 : 0, transition: 'opacity 0.7s ease' }}>
            <img src={s.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,35,71,0.88) 0%, rgba(15,35,71,0.2) 60%, transparent 100%)' }}/>
          </div>
        ))}
        <div style={{ position: 'absolute', bottom: isMob ? 40 : 52, left: isMob ? 16 : 28, right: isMob ? 16 : 80, zIndex: 2 }}>
          <p style={{ color: C.gold, fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
            {active + 1} / {GALLERY_SLIDES.length}
          </p>
          <p style={{ color: '#fff', fontSize: isMob ? '1rem' : 'clamp(1.1rem,3vw,1.5rem)', fontWeight: 800, lineHeight: 1.25, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
            {lang === 'sw' ? GALLERY_SLIDES[active].captionSw : GALLERY_SLIDES[active].captionEn}
          </p>
        </div>
        {!isMob && ['prev','next'].map(dir => (
          <button key={dir} onClick={() => goTo(active + (dir === 'next' ? 1 : -1))} style={{
            position: 'absolute', top: '50%', [dir === 'prev' ? 'left' : 'right']: 14,
            transform: 'translateY(-50%)', zIndex: 3,
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)',
            border: '1.5px solid rgba(255,255,255,0.25)',
            color: '#fff', fontSize: 18, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = C.gold + 'cc'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
          >{dir === 'prev' ? '‹' : '›'}</button>
        ))}
        <div style={{ position: 'absolute', bottom: 14, left: isMob ? 16 : 28, display: 'flex', gap: 5, zIndex: 3 }}>
          {GALLERY_SLIDES.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} style={{
              width: i === active ? 16 : 5, height: 5, borderRadius: 99, padding: 0, border: 'none',
              background: i === active ? C.gold : 'rgba(255,255,255,0.35)',
              cursor: 'pointer', transition: 'all 0.3s ease',
            }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── YouTube video helpers ─────────────────────────────────────────
function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
function duration(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = +(m[1]||0), mn = +(m[2]||0), s = +(m[3]||0);
  return h ? `${h}:${String(mn).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${mn}:${String(s).padStart(2,'0')}`;
}
function ago(dateStr) {
  const d = (Date.now() - new Date(dateStr)) / 1000;
  if (d < 3600)    return `${Math.floor(d / 60)}m ago`;
  if (d < 86400)   return `${Math.floor(d / 3600)}h ago`;
  if (d < 2592000) return `${Math.floor(d / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── YouTube Video Card ────────────────────────────────────────────
function VideoCard({ video, isMob }) {
  return (
    <a href={video.url} target="_blank" rel="noopener noreferrer" style={{
      display: 'block', background: '#fff', borderRadius: 14,
      border: `1px solid ${C.navy}10`, overflow: 'hidden', textDecoration: 'none', color: 'inherit',
      boxShadow: `0 2px 12px ${C.navy}0a`, transition: 'transform 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 28px ${C.navy}18`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 2px 12px ${C.navy}0a`; }}
    >
      <div style={{ position: 'relative', aspectRatio: '16/9', background: C.navyD, overflow: 'hidden' }}>
        {video.thumbnail
          ? <img src={video.thumbnail} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.3s' }}/>
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <YTIcon size={36}/>
            </div>
        }
        {/* Play overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0)', transition: 'background 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0)'}
        >
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={C.navy} style={{ marginLeft: 2 }}><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        {video.duration && (
          <span style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace' }}>
            {duration(video.duration)}
          </span>
        )}
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.ink, lineHeight: 1.4, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {video.title}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {video.viewCount != null && <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>{fmt(video.viewCount)} views</span>}
          {video.publishedAt && <span style={{ fontSize: 10, color: C.faint }}>{ago(video.publishedAt)}</span>}
        </div>
      </div>
    </a>
  );
}

// ── Video skeleton ────────────────────────────────────────────────
function VideoSkeleton() {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${C.navy}10`, overflow: 'hidden' }}>
      <div style={{ aspectRatio: '16/9', background: '#e8ecf0', animation: 'pulse 1.5s ease-in-out infinite' }}/>
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ height: 13, background: '#e8ecf0', borderRadius: 6, marginBottom: 6, animation: 'pulse 1.5s ease-in-out infinite' }}/>
        <div style={{ height: 11, background: '#e8ecf0', borderRadius: 6, width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }}/>
      </div>
    </div>
  );
}

// ── Mobile drawer ─────────────────────────────────────────────────
function MobileDrawer({ open, onClose, lang, switchLang, authed, t }) {
  const navLinks = [
    { href: '#carousel',  label: t.nav_services  },
    { href: '#pastor',    label: t.pastor_title   },
    { href: '#schedule',  label: t.nav_schedule   },
    { href: '#youtube',   label: lang === 'sw' ? 'YouTube' : 'YouTube' },
    { href: '#location',  label: t.nav_location   },
  ];
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,35,71,0.6)', backdropFilter: 'blur(4px)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.25s ease' }}/>
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201, width: 'min(80vw, 300px)', background: C.navyD, borderLeft: `1px solid ${C.gold}22`, transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: `1px solid ${C.gold}18` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', border: `1.5px solid ${C.gold}44` }}><LutherRose size={32}/></div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>KKKT DMP</p>
              <p style={{ fontSize: 9, color: C.gold, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Yombo</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, width: 34, height: 34, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <nav style={{ padding: '12px 8px', flex: 1 }}>
          {navLinks.map(({ href, label }) => (
            <a key={href} href={href} onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 10, margin: '2px 0', fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)', textDecoration: 'none', transition: 'background 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: C.gold, flexShrink: 0 }}/>
              {label}
            </a>
          ))}
          {/* Social links */}
          <div style={{ padding: '10px 16px', marginTop: 8 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.gold, marginBottom: 10 }}>Social Media</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { href: 'https://www.youtube.com/@KKKTDMPYOMBO', icon: <YTIcon size={16}/>, label: 'YouTube', color: '#FF0000' },
                { href: 'https://www.instagram.com/kkktyombo/', icon: <IGIcon size={16}/>, label: 'Instagram', color: '#E1306C' },
              ].map(({ href, icon, label, color }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: `${color}18`, border: `1px solid ${color}33`, color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                  <span style={{ color }}>{icon}</span> {label}
                </a>
              ))}
            </div>
          </div>
        </nav>
        <div style={{ padding: '16px 16px 32px', borderTop: `1px solid ${C.gold}18` }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, gap: 3, marginBottom: 12 }}>
            {['en', 'sw'].map(l => (
              <button key={l} onClick={() => switchLang(l)} style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderRadius: 8, border: 'none', cursor: 'pointer', background: lang === l ? C.gold : 'transparent', color: lang === l ? C.navy : 'rgba(255,255,255,0.55)', transition: 'all 0.15s' }}>
                {l === 'en' ? 'English' : 'Kiswahili'}
              </button>
            ))}
          </div>
          <Link href={authed ? '/dashboard' : '/auth/login'} onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '13px', borderRadius: 10, background: C.gold, color: C.navy, fontSize: 14, fontWeight: 800, letterSpacing: '0.02em', textDecoration: 'none' }}>
            {authed ? t.go_portal : t.login}
          </Link>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function LandingPage() {
  const [lang,       setLang]       = useState('sw');
  const [authed,     setAuthed]     = useState(false);
  const [navSolid,   setNavSolid]   = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMob = useIsMobile();
  const t     = T[lang];

  const { videos, loading: ytLoading, error: ytError } = useYouTubeVideos();

  useEffect(() => {
    setAuthed(isAuthenticated());
    const saved = localStorage.getItem('church_lang');
    if (saved) setLang(saved);
    const onScroll = () => setNavSolid(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const switchLang = l => { setLang(l); localStorage.setItem('church_lang', l); };

  const [carRef, carVis] = useReveal();
  const [pastRef, pastVis] = useReveal();
  const [schRef, schVis] = useReveal();
  const [ytRef,  ytVis]  = useReveal();
  const [mapRef, mapVis] = useReveal();
  const [porRef, porVis] = useReveal();

  const sp = isMob ? '60px 0' : '88px 0';
  const px = isMob ? '20px' : '28px';

  return (
    <div style={{ fontFamily: "'Lato', sans-serif", background: C.cream, color: C.ink, minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        /* Fonts loaded via layout.jsx:
           Playfair Display → display headings  (.pd)
           Lato             → body / UI text    (root)
           IM Fell English  → liturgical accents (.im)
           JetBrains Mono   → times / schedules  (.mono)
        */
        *{box-sizing:border-box;margin:0;padding:0;}

        /* Base body font */
        body { font-family: 'Lato', sans-serif; }
        button { font-family: 'Lato', sans-serif; }

        /* Utility classes */
        .pd  { font-family: 'Playfair Display', Georgia, serif; }
        .cg  { font-family: 'Playfair Display', Georgia, serif; }  /* alias kept for existing usage */
        .im  { font-family: 'IM Fell English', Georgia, serif; font-style: italic; }
        .mono{ font-family: 'JetBrains Mono', monospace; }

        @keyframes heroIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        .fu{animation:fadeUp 0.7s ease both;}
        .fi{animation:fadeIn 0.5s ease both;}
        a{text-decoration:none;color:inherit;}
        section{scroll-margin-top:64px;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-thumb{background:${C.navy}44;border-radius:99px;}
      `}</style>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} lang={lang} switchLang={switchLang} authed={authed} t={t}/>

      {/* ── Nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 64,
        background: navSolid ? 'rgba(15,35,71,0.96)' : 'transparent',
        backdropFilter: navSolid ? 'blur(14px)' : 'none',
        borderBottom: navSolid ? `1px solid ${C.gold}22` : 'none',
        transition: 'background 0.3s, border 0.3s',
        display: 'flex', alignItems: 'center',
        padding: `0 ${isMob ? '16px' : '32px'}`,
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${C.gold}44`, flexShrink: 0 }}>
            <LutherRose size={34}/>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.04em', lineHeight: 1.1, whiteSpace: 'nowrap' }}>KKKT DMP</p>
            <p style={{ fontSize: 9, fontWeight: 700, color: C.gold, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Yombo</p>
          </div>
        </div>

        {!isMob && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {[['#carousel', t.nav_services], ['#pastor', t.pastor_title.split(' ').slice(-2).join(' ')], ['#schedule', t.nav_schedule], ['#youtube', 'YouTube'], ['#location', t.nav_location]].map(([href, label]) => (
              <a key={href} href={href} style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.03em', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = C.gold}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.72)'}
              >{label}</a>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Social — desktop */}
          {!isMob && (
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { href: 'https://www.youtube.com/@KKKTDMPYOMBO', icon: <YTIcon size={14}/>, color: '#FF0000' },
                { href: 'https://www.instagram.com/kkktyombo/', icon: <IGIcon size={14}/>, color: '#E1306C' },
              ].map(({ href, icon, color }) => (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.08)', color, border: '1px solid rgba(255,255,255,0.1)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = `${color}22`}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                >{icon}</a>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 99, padding: 2, gap: 2 }}>
            {['en', 'sw'].map(l => (
              <button key={l} onClick={() => switchLang(l)} style={{ padding: isMob ? '3px 8px' : '3px 11px', borderRadius: 99, border: 'none', cursor: 'pointer', fontSize: isMob ? 10 : 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: lang === l ? C.gold : 'transparent', color: lang === l ? C.navy : 'rgba(255,255,255,0.6)', transition: 'all 0.15s' }}>
                {l}
              </button>
            ))}
          </div>

          {!isMob && (
            <Link href={authed ? '/dashboard' : '/auth/login'} style={{ padding: '7px 18px', borderRadius: 99, background: C.gold, color: C.navy, fontSize: 12, fontWeight: 800, letterSpacing: '0.03em' }}>
              {authed ? t.go_portal : t.login}
            </Link>
          )}

          {isMob && (
            <button onClick={() => setDrawerOpen(true)} style={{ width: 36, height: 36, borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 16, height: 1.5, borderRadius: 99, background: '#fff', display: 'block' }}/>)}
            </button>
          )}
        </div>
      </nav>

      {/* ── Hero Carousel ── */}
      <HeroCarousel lang={lang} isMob={isMob}/>

      {/* ── Gallery / Life at Yombo ── */}
      <section id="carousel" style={{ background: C.stone, padding: sp }}>
        <div ref={carRef} style={{ maxWidth: 1100, margin: '0 auto', padding: `0 ${px}`, opacity: carVis ? 1 : 0, transform: carVis ? 'none' : 'translateY(28px)', transition: 'opacity 0.7s, transform 0.7s' }}>
          <div style={{ marginBottom: isMob ? 24 : 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 3, height: 18, borderRadius: 99, background: C.gold }}/>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted }}>
                {lang === 'sw' ? 'Picha & Video' : 'Gallery'}
              </span>
            </div>
            <h2 className="cg" style={{ fontSize: isMob ? 'clamp(1.8rem,8vw,2.4rem)' : 'clamp(2rem,4vw,3rem)', fontWeight: 700, color: C.navy, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 8 }}>
              {t.carousel_title}
            </h2>
            <p style={{ fontSize: isMob ? 13 : 14, color: C.muted, lineHeight: 1.65, maxWidth: 400 }}>{t.carousel_sub}</p>
          </div>
          <GalleryCarousel lang={lang}/>
        </div>
      </section>

      {/* ── Pastor Section ── */}
      <section id="pastor" style={{ background: C.cream, padding: sp }}>
        <div ref={pastRef} style={{ maxWidth: 1100, margin: '0 auto', padding: `0 ${px}`, opacity: pastVis ? 1 : 0, transform: pastVis ? 'none' : 'translateY(28px)', transition: 'opacity 0.7s, transform 0.7s' }}>

          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: isMob ? 32 : 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ height: 1, width: 32, background: C.gold }}/><CrossSVG size={16} color={C.gold}/><div style={{ height: 1, width: 32, background: C.gold }}/>
            </div>
            <h2 className="cg" style={{ fontSize: isMob ? 'clamp(1.8rem,8vw,2.4rem)' : 'clamp(2rem,4vw,2.8rem)', fontWeight: 700, color: C.navy, marginBottom: 10, letterSpacing: '-0.02em' }}>
              {t.pastor_title}
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : '1fr 1.4fr', gap: isMob ? 32 : 56, alignItems: 'start' }}>

            {/* Pastor card */}
            <div>
              <div style={{ background: C.navyD, borderRadius: 20, overflow: 'hidden', border: `1px solid ${C.gold}22`, boxShadow: `0 20px 60px ${C.navy}22`, position: 'relative' }}>
                {/* Photo area — placeholder with elegant pastor silhouette */}
                <div style={{ position: 'relative', aspectRatio: '3/4', background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navyD} 100%)`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
                  {/* Decorative rings */}
                  <div style={{ position: 'absolute', top: -30, right: -30, pointerEvents: 'none' }}>
                    <Rings size={200} opacity={0.08} color={C.gold}/>
                  </div>
                  <div style={{ position: 'absolute', bottom: -20, left: -20, pointerEvents: 'none' }}>
                    <Rings size={140} opacity={0.05} color={C.gold}/>
                  </div>

                  {/* Pastor silhouette / photo placeholder */}
                  <div style={{ position: 'relative', zIndex: 2, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 0 }}>
                    {/*
                      ╔═══════════════════════════════════════════════════════╗
                      ║  PASTOR PHOTO — Replace the <img> below with the      ║
                      ║  actual pastor's photo:                                ║
                      ║                                                         ║
                      ║  <img                                                   ║
                      ║    src="/images/pastor-delemi.jpg"                     ║
                      ║    alt="Mchungaji Delemi"                              ║
                      ║    style={{ width:'100%', height:'100%',              ║
                      ║      objectFit:'cover', display:'block' }}             ║
                      ║  />                                                     ║
                      ╚═══════════════════════════════════════════════════════╝
                    */}
                    {/* Elegant placeholder — remove when photo is available */}
                    <svg width="100%" viewBox="0 0 300 360" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                      {/* Background gradient fill */}
                      <defs>
                        <radialGradient id="bgGrad" cx="50%" cy="40%" r="60%">
                          <stop offset="0%" stopColor="#1B3A6B" stopOpacity="0.3"/>
                          <stop offset="100%" stopColor="#0f2347" stopOpacity="0"/>
                        </radialGradient>
                        <linearGradient id="robeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1B3A6B"/>
                          <stop offset="100%" stopColor="#0f2347"/>
                        </linearGradient>
                        <linearGradient id="fadeBottom" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="60%" stopColor="#0f2347" stopOpacity="0"/>
                          <stop offset="100%" stopColor="#0f2347" stopOpacity="1"/>
                        </linearGradient>
                      </defs>
                      <rect width="300" height="360" fill="url(#bgGrad)"/>
                      {/* Pastoral robe / collar */}
                      <ellipse cx="150" cy="360" rx="120" ry="60" fill="url(#robeGrad)"/>
                      <path d="M80 280 Q100 240 150 230 Q200 240 220 280 Q230 320 230 360 L70 360 Q70 320 80 280Z" fill="#1B3A6B"/>
                      {/* White collar */}
                      <path d="M130 248 L150 270 L170 248 Q160 240 150 238 Q140 240 130 248Z" fill="white" opacity="0.9"/>
                      {/* Body/torso */}
                      <ellipse cx="150" cy="220" rx="55" ry="60" fill="#1B3A6B"/>
                      {/* Neck */}
                      <rect x="136" y="175" width="28" height="30" rx="10" fill="#C8A07A"/>
                      {/* Head */}
                      <ellipse cx="150" cy="158" rx="42" ry="48" fill="#C8A07A"/>
                      {/* Hair */}
                      <ellipse cx="150" cy="115" rx="42" ry="20" fill="#2a1a0a"/>
                      <ellipse cx="110" cy="145" rx="15" ry="30" fill="#2a1a0a"/>
                      <ellipse cx="190" cy="145" rx="15" ry="30" fill="#2a1a0a"/>
                      {/* Features — subtle */}
                      <ellipse cx="135" cy="160" rx="5" ry="3" fill="#8a6040" opacity="0.6"/>
                      <ellipse cx="165" cy="160" rx="5" ry="3" fill="#8a6040" opacity="0.6"/>
                      <path d="M138 175 Q150 182 162 175" stroke="#a07850" strokeWidth="2" fill="none" opacity="0.5"/>
                      {/* Cross on robe */}
                      <rect x="146" y="250" width="8" height="28" rx="2" fill={C.gold} opacity="0.6"/>
                      <rect x="137" y="260" width="26" height="8" rx="2" fill={C.gold} opacity="0.6"/>
                      {/* Fade to bottom */}
                      <rect width="300" height="360" fill="url(#fadeBottom)"/>
                    </svg>
                  </div>
                </div>

                {/* Name banner */}
                <div style={{ padding: '20px 22px 22px', background: C.navyD, borderTop: `1px solid ${C.gold}18` }}>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.gold, marginBottom: 4 }}>
                    {lang === 'sw' ? 'Kiongozi Wetu' : 'Our Shepherd'}
                  </p>
                  <h3 className="cg" style={{ fontSize: isMob ? '1.5rem' : '1.75rem', fontWeight: 700, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.01em', marginBottom: 4 }}>
                    {t.pastor_name}
                  </h3>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.04em' }}>{t.pastor_role}</p>
                </div>
              </div>

              {/* Social link to church */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {[
                  { href: 'https://www.youtube.com/@KKKTDMPYOMBO', icon: <YTIcon size={15}/>, label: 'YouTube', color: '#FF0000' },
                  { href: 'https://www.instagram.com/kkktyombo/', icon: <IGIcon size={15}/>, label: 'Instagram', color: '#E1306C' },
                ].map(({ href, icon, label, color }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 10, background: '#fff', border: `1px solid ${C.navy}12`, color: C.ink, fontSize: 12, fontWeight: 700, textDecoration: 'none', boxShadow: `0 2px 8px ${C.navy}08`, transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${color}10`; e.currentTarget.style.borderColor = `${color}44`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = `${C.navy}12`; }}
                  >
                    <span style={{ color }}>{icon}</span> {label}
                  </a>
                ))}
              </div>
            </div>

            {/* Bio + Office Hours */}
            <div>
              {/* Bio */}
              <div style={{ marginBottom: isMob ? 28 : 36 }}>
                <p style={{ fontSize: isMob ? 13 : 15, color: C.muted, lineHeight: 1.8, marginBottom: 20 }}>
                  {t.pastor_bio}
                </p>
                <Link href="/auth/register" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 99, background: C.navy, color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.02em', boxShadow: `0 4px 18px ${C.navy}33` }}>
                  {t.pastor_meet}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              </div>

              {/* Office hours */}
              <div style={{ background: C.stone, borderRadius: 16, border: `1px solid ${C.navy}0e`, overflow: 'hidden' }}>
                <div style={{ background: C.navy, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t.pastor_hours_title}</h4>
                </div>

                <div style={{ padding: '8px 4px' }}>
                  {PASTOR_HOURS.map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderRadius: 10, margin: '2px 4px', background: i % 2 === 0 ? '#fff' : 'transparent', transition: 'background 0.1s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.gold, flexShrink: 0 }}/>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
                          {t.days[h.dayKey]}
                        </span>
                      </div>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>
                        {lang === 'sw' ? h.timeSw : h.timeEn}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '10px 20px 16px' }}>
                  <p style={{ fontSize: 11, color: C.faint, fontStyle: 'italic', lineHeight: 1.5 }}>
                    * {t.pastor_hours_note}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Schedule ── */}
      <section id="schedule" style={{ background: C.stone, padding: sp }}>
        <div ref={schRef} style={{ maxWidth: 860, margin: '0 auto', padding: `0 ${px}`, opacity: schVis ? 1 : 0, transform: schVis ? 'none' : 'translateY(28px)', transition: 'opacity 0.7s, transform 0.7s' }}>
          <div style={{ textAlign: 'center', marginBottom: isMob ? 32 : 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ height: 1, width: 32, background: C.gold }}/><CrossSVG size={16} color={C.gold}/><div style={{ height: 1, width: 32, background: C.gold }}/>
            </div>
            <h2 className="cg" style={{ fontSize: isMob ? 'clamp(1.8rem,8vw,2.4rem)' : 'clamp(2rem,4vw,2.8rem)', fontWeight: 700, color: C.navy, marginBottom: 10, letterSpacing: '-0.02em' }}>
              {t.schedule_title}
            </h2>
            <p style={{ fontSize: isMob ? 13 : 15, color: C.muted, lineHeight: 1.65 }}>{t.schedule_sub}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SCHEDULE.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: 0, background: s.highlight ? C.navy : '#fff', border: `1px solid ${s.highlight ? C.gold + '33' : C.navy + '10'}`, borderLeft: `4px solid ${s.highlight ? C.gold : C.navy + '28'}`, borderRadius: 12, overflow: 'hidden', boxShadow: s.highlight ? `0 4px 18px ${C.navy}22` : 'none', opacity: schVis ? 1 : 0, transform: schVis ? 'none' : 'translateX(-16px)', transition: `opacity 0.5s ease ${i * 65}ms, transform 0.5s ease ${i * 65}ms` }}>
                <div style={{ flexShrink: 0, width: isMob ? 86 : 108, padding: isMob ? '14px 10px' : '18px 16px', borderRight: `1px solid ${s.highlight ? 'rgba(255,255,255,0.1)' : C.navy + '10'}` }}>
                  <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: s.highlight ? C.gold : C.navy, marginBottom: 2 }}>{t.days[s.dayKey]}</p>
                  <p className="mono" style={{ fontSize: isMob ? 11 : 12, fontWeight: 600, color: s.highlight ? 'rgba(255,255,255,0.6)' : C.muted }}>{s.time}</p>
                </div>
                <div style={{ flex: 1, padding: isMob ? '14px 12px' : '18px 20px', display: 'flex', alignItems: 'center' }}>
                  <p style={{ fontSize: isMob ? 13 : 14, fontWeight: s.highlight ? 700 : 600, color: s.highlight ? '#fff' : C.ink, lineHeight: 1.35 }}>
                    {lang === 'sw' ? s.serviceSw : s.serviceEn}
                  </p>
                </div>
                {s.highlight && !isMob && (
                  <div style={{ padding: '0 18px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.navy, background: C.gold, borderRadius: 99, padding: '3px 10px' }}>
                      {lang === 'sw' ? 'Muhimu' : 'Main'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 11, color: C.faint, marginTop: 20, fontStyle: 'italic' }}>
            * {t.schedule_note}
          </p>
        </div>
      </section>

      {/* ── YouTube Section ── */}
      <section id="youtube" style={{ background: C.cream, padding: sp }}>
        <div ref={ytRef} style={{ maxWidth: 1100, margin: '0 auto', padding: `0 ${px}`, opacity: ytVis ? 1 : 0, transform: ytVis ? 'none' : 'translateY(28px)', transition: 'opacity 0.7s, transform 0.7s' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: isMob ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMob ? 'column' : 'row', gap: 16, marginBottom: isMob ? 24 : 40 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 3, height: 18, borderRadius: 99, background: '#FF0000' }}/>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.muted }}>
                  {lang === 'sw' ? 'Chaneli Mpya' : 'New Channel'}
                </span>
              </div>
              <h2 className="cg" style={{ fontSize: isMob ? 'clamp(1.8rem,8vw,2.4rem)' : 'clamp(2rem,4vw,3rem)', fontWeight: 700, color: C.navy, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 8 }}>
                {t.youtube_title}
              </h2>
              <p style={{ fontSize: isMob ? 13 : 14, color: C.muted, lineHeight: 1.65, maxWidth: 420 }}>{t.youtube_sub}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
              <a href="https://www.youtube.com/@KKKTDMPYOMBO" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 99, background: '#FF0000', color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.02em', textDecoration: 'none', boxShadow: '0 4px 16px rgba(255,0,0,0.3)' }}>
                <YTIcon size={16}/> {t.youtube_cta}
              </a>
              <a href="https://www.instagram.com/kkktyombo/" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 99, background: 'linear-gradient(135deg, #405DE6, #5851DB, #833AB4, #C13584, #E1306C, #FD1D1D)', color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '0.02em', textDecoration: 'none', boxShadow: '0 4px 16px rgba(225,48,108,0.3)' }}>
                <IGIcon size={16}/> Instagram
              </a>
            </div>
          </div>

          {/* Video grid */}
          {ytLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
              {[1,2,3,4,5,6].map(i => <VideoSkeleton key={i}/>)}
            </div>
          ) : ytError || videos.length === 0 ? (
            /* Empty / error state — still show the channel card */
            <div style={{ textAlign: 'center', padding: isMob ? '32px 20px' : '48px 40px', background: '#fff', borderRadius: 20, border: `1px solid ${C.navy}0a` }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FF000015', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <YTIcon size={28}/>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.navy, marginBottom: 8 }}>{t.youtube_empty}</p>
              <a href="https://www.youtube.com/@KKKTDMPYOMBO" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 99, background: '#FF0000', color: '#fff', fontSize: 13, fontWeight: 800, textDecoration: 'none', marginTop: 8 }}>
                <YTIcon size={14}/> @KKKTDMPYOMBO
              </a>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {videos.map(v => <VideoCard key={v.id} video={v} isMob={isMob}/>)}
            </div>
          )}

          {/* View all link */}
          {videos.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <a href="https://www.youtube.com/@KKKTDMPYOMBO" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '11px 26px', borderRadius: 99, border: `2px solid ${C.navy}22`, color: C.navy, fontSize: 13, fontWeight: 700, textDecoration: 'none', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.navy; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.navy; }}
              >
                {lang === 'sw' ? 'Tazama video zote →' : 'View all videos →'}
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ── Map ── */}
      <section id="location" style={{ background: C.navyD, padding: sp }}>
        <div ref={mapRef} style={{ maxWidth: 1100, margin: '0 auto', padding: `0 ${px}`, opacity: mapVis ? 1 : 0, transform: mapVis ? 'none' : 'translateY(28px)', transition: 'opacity 0.7s, transform 0.7s' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : '1fr 1fr', gap: isMob ? 28 : 48, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 3, height: 18, borderRadius: 99, background: C.gold }}/>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.gold }}>{t.nav_location}</span>
              </div>
              <h2 className="cg" style={{ fontSize: isMob ? 'clamp(1.8rem,8vw,2.4rem)' : 'clamp(2rem,3.5vw,2.8rem)', fontWeight: 700, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 14 }}>{t.map_title}</h2>
              <p style={{ fontSize: isMob ? 13 : 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 22 }}>{t.map_sub}</p>
              <div style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.gold}22`, borderRadius: 12, padding: '15px 18px', marginBottom: isMob ? 0 : 20 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" style={{ marginTop: 2, flexShrink: 0 }}>
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
                  </svg>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>{t.map_address}</p>
                </div>
              </div>
            </div>
            <div style={{ borderRadius: 16, overflow: 'hidden', border: `2px solid ${C.gold}22`, boxShadow: `0 16px 48px rgba(0,0,0,0.4)` }}>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d70476.635097538!2d39.2377202!3d-6.864696!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x185c4a001f086fdb%3A0x8bf3060642c53afa!2sKanisa%20La%20Kiinjili%20La%20Kilutheri%20Ushirika%20Wa%20Yombo!5e1!3m2!1sen!2stz!4v1775278389841!5m2!1sen!2stz"
                width="100%" height={isMob ? 280 : 380}
                style={{ border: 0, display: 'block' }}
                allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="KKKT DMP Yombo"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Portal CTA ── */}
      <section style={{ background: C.stone, padding: sp, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, pointerEvents: 'none' }}><Rings size={260} opacity={0.05}/></div>
        <div style={{ position: 'absolute', bottom: 16, left: isMob ? 12 : 32, pointerEvents: 'none' }}><DotGrid cols={6} rows={3} gap={13} color={C.navy} opacity={0.07}/></div>
        <div ref={porRef} style={{ maxWidth: 740, margin: '0 auto', padding: `0 ${px}`, textAlign: 'center', opacity: porVis ? 1 : 0, transform: porVis ? 'none' : 'translateY(28px)', transition: 'opacity 0.7s, transform 0.7s', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${C.gold}44`, boxShadow: `0 0 0 6px ${C.gold}11` }}>
              <LutherRose size={64}/>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ height: 1, width: 28, background: C.gold }}/><CrossSVG size={12} color={C.gold}/><div style={{ height: 1, width: 28, background: C.gold }}/>
          </div>
          <h2 className="cg" style={{ fontSize: isMob ? 'clamp(1.8rem,8vw,2.4rem)' : 'clamp(2rem,4vw,3rem)', fontWeight: 700, color: C.navy, lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 14 }}>{t.portal_title}</h2>
          <p style={{ fontSize: isMob ? 13 : 15, color: C.muted, lineHeight: 1.75, maxWidth: 500, margin: '0 auto 28px' }}>{t.portal_sub}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
            {t.portal_features.map((f, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: isMob ? 11 : 12, fontWeight: 600, color: C.navy, background: C.navyL, border: `1px solid ${C.navy}18`, borderRadius: 99, padding: '5px 12px' }}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill={C.gold}><circle cx="4" cy="4" r="4"/></svg>
                {f}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', flexDirection: isMob ? 'column' : 'row', alignItems: 'center' }}>
            <Link href="/auth/register" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: isMob ? '14px 28px' : '15px 36px', borderRadius: 99, background: C.navy, color: '#fff', fontSize: 14, fontWeight: 800, letterSpacing: '0.03em', boxShadow: `0 4px 20px ${C.navy}33`, width: isMob ? '100%' : 'auto' }}>
              {t.portal_cta}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <Link href="/auth/login" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: isMob ? '13px 28px' : '15px 28px', borderRadius: 99, background: 'transparent', color: C.navy, border: `2px solid ${C.navy}33`, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', width: isMob ? '100%' : 'auto' }}>
              {t.portal_login}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: C.navyD, borderTop: `1px solid ${C.gold}22`, padding: isMob ? '28px 20px' : '36px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', border: `1.5px solid ${C.gold}44`, flexShrink: 0 }}>
                <LutherRose size={36}/>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>KKKT DMP YOMBO</p>
                <p style={{ fontSize: 9, color: C.gold, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Kanisa La Kiinjili La Kilutheri</p>
              </div>
            </div>
            {/* Social row */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { href: 'https://www.youtube.com/@KKKTDMPYOMBO', icon: <YTIcon size={16}/>, label: 'YouTube', color: '#FF0000' },
                { href: 'https://www.instagram.com/kkktyombo/', icon: <IGIcon size={16}/>, label: 'Instagram', color: '#E1306C' },
              ].map(({ href, icon, label, color }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 99, background: 'rgba(255,255,255,0.08)', border: `1px solid rgba(255,255,255,0.1)`, color: '#fff', fontSize: 11, fontWeight: 700, textDecoration: 'none', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.borderColor = `${color}44`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                >
                  <span style={{ color }}>{icon}</span> {label}
                </a>
              ))}
            </div>
          </div>
          <div style={{ height: 1, background: `${C.gold}18`, marginBottom: 16 }}/>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', fontWeight: 500, textAlign: 'center' }}>
            © {new Date().getFullYear()} KKKT DMP Yombo. {t.footer_rights}
          </p>
        </div>
      </footer>
    </div>
  );
}