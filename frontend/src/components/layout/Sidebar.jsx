'use client';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import {
  canManageMembers, canManageGroups, canBroadcast,
  canManageContent, canManageSocialMedia,
} from '../../lib/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ─── Role labels ──────────────────────────────────────────────────────────────
const ROLE_LABELS = {
  pastor:       { en: 'Pastor',       sw: 'Mchungaji' },
  elder:        { en: 'Elder',        sw: 'Mzee'      },
  group_leader: { en: 'Group Leader', sw: 'Kiongozi'  },
  member:       { en: 'Member',       sw: 'Mshirika'  },
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const ICONS = {
  dashboard: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  members: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  groups: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/>
      <path d="M12 8v4M9.5 17.5l-2-3M14.5 17.5l2-3"/>
    </svg>
  ),
  announcements: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  schedule: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
    </svg>
  ),
  it: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
      <path d="M9 8l2 2-2 2M13 12h3"/>
    </svg>
  ),
  upload: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  forms: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  ),
  youtube: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
    </svg>
  ),
  pending: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
    </svg>
  ),
  logout: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

// ─── Nav item — light-surface override ───────────────────────────────────────
// Renders a nav-item span with inline styles that override the CSS class's
// dark-surface defaults (rgba-white colors) without touching globals.css.
function NavItem({ active, icon, label }) {
  return (
    <span
      className={`nav-item ${active ? 'active' : ''}`}
      style={{
        color: active ? 'var(--navy)' : 'var(--text-secondary)',
        background: active ? 'rgba(196,154,42,.15)' : undefined,
      }}
    >
      <span
        className="nav-item-icon"
        style={{ opacity: active ? 1 : 0.55 }}
      >
        {icon}
      </span>
      <span className="font-sans text-sm">{label}</span>
    </span>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { user, logout, lang, switchLang } = useAuth();
  const { t } = useTranslation(lang);
  const pathname = usePathname();

  if (!user) return null;

  const isActive = (href) => pathname === href;

  const navSections = [
    {
      labelEn: 'Overview', labelSw: 'Jumla',
      items: [
        { href: '/dashboard',         labelEn: 'Dashboard', labelSw: 'Dashibodi', icon: ICONS.dashboard },
        { href: '/dashboard/youtube', labelEn: 'YouTube',   labelSw: 'YouTube',   icon: ICONS.youtube  },
      ],
    },
    {
      labelEn: 'People', labelSw: 'Watu',
      items: [
        canManageMembers(user.role) && { href: '/dashboard/members',         labelEn: 'Members',          labelSw: 'Washarika',   icon: ICONS.members },
        canManageMembers(user.role) && { href: '/dashboard/pending-members', labelEn: 'Pending Approval', labelSw: 'Wanaosubiri', icon: ICONS.pending },
        canManageGroups(user.role)  && { href: '/dashboard/groups',          labelEn: 'Groups',           labelSw: 'Vikundi',     icon: ICONS.groups  },
      ].filter(Boolean),
    },
    {
      labelEn: 'Communication', labelSw: 'Mawasiliano',
      items: [
        { href: '/dashboard/announcements', labelEn: 'Announcements', labelSw: 'Matangazo', icon: ICONS.announcements },
        { href: '/dashboard/events',        labelEn: 'Schedule',      labelSw: 'Ratiba',    icon: ICONS.schedule     },
      ],
    },
    {
      labelEn: 'IT Desk', labelSw: 'Dawati la IT',
      items: [
        canBroadcast(user.role)         && { href: '/dashboard/it',             labelEn: 'IT Dashboard',  labelSw: 'Dashibodi ya IT',    icon: ICONS.it     },
        canManageContent(user.role)     && { href: '/dashboard/content-editor', labelEn: 'Content Editor',labelSw: 'Hariri Maudhui',     icon: ICONS.it     },
        canManageSocialMedia(user.role) && { href: '/dashboard/youtube/trim',   labelEn: 'Trim Video',    labelSw: 'Kata Video YouTube', icon: ICONS.upload },
      ].filter(Boolean),
    },
    {
      labelEn: 'Resources', labelSw: 'Rasilimali',
      items: [
        { href: '/dashboard/forms', labelEn: 'Forms', labelSw: 'Fomu', icon: ICONS.forms },
      ],
    },
  ].filter(s => s.items.length > 0);

  const initials = user.full_name
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-[rgba(9,9,15,0.50)] md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={[
          'sidebar-dashboard',
          'transition-transform duration-200',
          'md:translate-x-0 md:static md:h-screen',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >

        {/* ── Wordmark ──────────────────────────────────────────── */}
        <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="gold-bar-h" />

          <div className="flex items-center justify-between px-5" style={{ height: 'calc(var(--topbar-h) - 3px)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0"
                style={{ border: '1.5px solid var(--gold-dark)' }}
              >
                <img src="/luther.webp" alt="" width={28} height={28} className="object-contain block" />
              </div>
              <div>
                <p className="font-display font-bold leading-tight"
                  style={{ fontSize: '0.8125rem', color: 'var(--navy)', letterSpacing: '-0.02em' }}>
                  KKKT DMP
                </p>
                <span className="block font-sans font-semibold leading-none"
                  style={{ fontSize: '0.5625rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold-dark)' }}>
                  Yombo
                </span>
              </div>
            </div>

            {/* Mobile close */}
            <button
              onClick={onMobileClose}
              className="md:hidden btn btn-ghost btn-icon btn-sm"
              aria-label="Close menu"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Identity strip ─────────────────────────────────────── */}
        <Link
          href="/dashboard/profile"
          onClick={onMobileClose}
          className="flex-shrink-0 block no-underline group"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div className="avatar avatar-md avatar-gold flex-shrink-0" aria-hidden="true">
              {user.profile_photo_url
                ? <img src={user.profile_photo_url} alt={user.full_name} className="w-full h-full object-cover" />
                : <span className="text-xs font-bold">{initials}</span>
              }
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-sans font-semibold truncate leading-snug"
                style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                {user.full_name}
              </p>
              <p className="font-sans font-medium truncate"
                style={{ fontSize: '0.6875rem', color: 'var(--gold-dark)', marginTop: '1px' }}>
                {ROLE_LABELS[user.role]?.[lang] ?? user.role}
              </p>
            </div>

            {/* Chevron */}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              className="flex-shrink-0 opacity-30 group-hover:opacity-60 transition-opacity duration-150">
              <path d="M4.5 2.5l4 3.5-4 3.5" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </Link>

        {/* ── Navigation ────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
          {navSections.map((section, si) => {
            const sectionLabel = lang === 'sw' ? section.labelSw : section.labelEn;
            return (
              <div key={sectionLabel} className={si > 0 ? 'mt-3' : ''}>
                {/* Section label — inline color overrides the rgba-white from globals.css */}
                <p
                  className="nav-section-label"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {sectionLabel}
                </p>

                {section.items.map(item => {
                  const active = isActive(item.href);
                  const label  = lang === 'sw' ? item.labelSw : item.labelEn;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onMobileClose}
                      className="block no-underline"
                    >
                      <NavItem active={active} icon={item.icon} label={label} />
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* ── Bottom bar ────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 px-4 py-4 flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          {/* Language toggle */}
          <div
            className="flex gap-0.5 rounded p-0.5"
            style={{ background: 'var(--border-subtle)', border: '1px solid var(--border-default)' }}
          >
            {['en', 'sw'].map(l => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                className="flex-1 py-1.5 text-center rounded transition-all duration-150 border-none cursor-pointer"
                style={lang === l
                  ? { background: 'var(--gold)', color: 'var(--navy-dark)', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em' }
                  : { background: 'transparent', color: 'var(--text-tertiary)', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em' }
                }
              >
                {l === 'en' ? 'EN' : 'SW'}
              </button>
            ))}
          </div>

          {/* Sign out */}
          <button
            onClick={logout}
            className="nav-item"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--danger)';
              e.currentTarget.style.background = 'var(--danger-bg)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-tertiary)';
              e.currentTarget.style.background = '';
            }}
          >
            <span className="nav-item-icon" style={{ opacity: 0.55 }}>{ICONS.logout}</span>
            <span className="font-sans text-sm">{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}