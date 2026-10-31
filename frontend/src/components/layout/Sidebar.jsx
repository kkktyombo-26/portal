'use client';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import { canManageMembers, canManageGroups, canBroadcast, canManageContent, canManageSocialMedia } from '../../lib/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ROLE_LABELS = {
  pastor:       { en: 'Pastor',       sw: 'Mchungaji' },
  elder:        { en: 'Elder',        sw: 'Mzee' },
  group_leader: { en: 'Group Leader', sw: 'Kiongozi' },
  member:       { en: 'Member',       sw: 'Mshirika' },
};

const ICONS = {
  dashboard: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  members: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  groups: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/>
      <path d="M12 8v4M9.5 17.5l-2-3M14.5 17.5l2-3"/>
    </svg>
  ),
  announcements: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  schedule: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
    </svg>
  ),
  it: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
      <path d="M9 8l2 2-2 2M13 12h3"/>
    </svg>
  ),
  upload: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  forms: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  ),
  youtube: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
    </svg>
  ),
  pending: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
    </svg>
  ),
  profile: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  logout: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

function TinyCross({ light = false }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      className={light ? 'opacity-35' : 'opacity-20'}
      style={{ flexShrink: 0 }}
    >
      <rect x="4" y="1" width="2" height="8" rx="1" fill="currentColor"/>
      <rect x="1" y="4" width="8" height="2" rx="1" fill="currentColor"/>
    </svg>
  );
}

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { user, logout, lang, switchLang } = useAuth();
  const { t } = useTranslation(lang);
  const pathname = usePathname();

  if (!user) return null;

  const navSections = [
    {
      labelEn: 'Overview', labelSw: 'Jumla',
      items: [
        { href: '/dashboard',         labelEn: 'Dashboard', labelSw: 'Dashibodi', icon: ICONS.dashboard },
        { href: '/dashboard/youtube', labelEn: 'YouTube',   labelSw: 'YouTube',   icon: ICONS.youtube },
      ],
    },
    {
      labelEn: 'People', labelSw: 'Watu',
      items: [
        canManageMembers(user.role) && { href: '/dashboard/members',         labelEn: 'Members',          labelSw: 'Washarika',   icon: ICONS.members },
        canManageMembers(user.role) && { href: '/dashboard/pending-members', labelEn: 'Pending Approval', labelSw: 'Wanaosubiri', icon: ICONS.pending },
        canManageGroups(user.role)  && { href: '/dashboard/groups',          labelEn: 'Groups',           labelSw: 'Vikundi',     icon: ICONS.groups },
      ].filter(Boolean),
    },
    {
      labelEn: 'Communication', labelSw: 'Mawasiliano',
      items: [
        { href: '/dashboard/announcements', labelEn: 'Announcements', labelSw: 'Matangazo', icon: ICONS.announcements },
        { href: '/dashboard/events',        labelEn: 'Schedule',      labelSw: 'Ratiba',    icon: ICONS.schedule },
      ],
    },
    {
      labelEn: 'IT Desk', labelSw: 'Dawati la IT',
      items: [
        canBroadcast(user.role)         && { href: '/dashboard/it',             labelEn: 'IT Dashboard',       labelSw: 'Dashibodi ya IT',           icon: ICONS.it },
        canManageContent(user.role)     && { href: '/dashboard/content-editor', labelEn: 'Content Editor',     labelSw: 'Hariri Maudhui ya Web',     icon: ICONS.it },
        canManageSocialMedia(user.role) && { href: '/dashboard/youtube/trim',   labelEn: 'Cut YouTube Video',  labelSw: 'Kata Kipande Video YouTube', icon: ICONS.upload },
      ].filter(Boolean),
    },
    {
      labelEn: 'Resources', labelSw: 'Rasilimali',
      items: [
        { href: '/dashboard/forms', labelEn: 'Forms', labelSw: 'Fomu', icon: ICONS.forms },
      ],
    },
  ].filter(s => s && s.items.length > 0);

  const isActive      = href => pathname === href;
  const profileActive = isActive('/dashboard/profile');
  const avatarHue     = ((user.full_name?.charCodeAt(0) || 65) * 7) % 360;

  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden animate-fade-in"
         
          onClick={onMobileClose}
        />
      )}

      {/* ── Sidebar shell ───────────────────────────────────────── */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40
          flex flex-col
          w-60
          border-r border-neutral-100
          transition-transform duration-200
          md:translate-x-0 md:static md:h-screen
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
     
      >

        {/* ── Wordmark ──────────────────────────────────────────── */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-pill border border-gold-600 overflow-hidden flex-shrink-0">
              <img src="/luther.webp" alt="" width={28} height={28} className="object-contain block" />
            </div>
            <div>
              <p className="font-display text-xs font-bold text-navy-900 tracking-tight leading-tight">
                KKKT DMP
              </p>
              <span className="block text-2xs font-bold tracking-widest uppercase text-gold-700 leading-none">
                Yombo
              </span>
            </div>
          </div>
          <button
            onClick={onMobileClose}
            className="md:hidden w-7 h-7 flex items-center justify-center rounded-md text-neutral-500 bg-neutral-50 border border-neutral-100 text-base leading-none cursor-pointer"
          >×</button>
        </div>

        {/* ── User / profile card ───────────────────────────────── */}
        <Link href="/dashboard/profile" onClick={onMobileClose} className="no-underline">
          <div
            className={`
              px-3 py-2.5 border-b border-neutral-100 cursor-pointer
              transition-colors duration-150
              ${profileActive
                ? 'bg-navy-900'
                : 'hover:bg-neutral-50'
              }
            `}
          >
            <div className="flex items-center gap-2.5">

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {user.profile_photo_url ? (
                  <img
                    src={user.profile_photo_url}
                    alt={user.full_name}
                    className="w-9 h-9 rounded-pill object-cover"
                    style={{ boxShadow: '0 0 0 2px var(--gold-dark)' }}
                  />
                ) : (
                  <div
                    className="w-9 h-9 rounded-pill flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, hsl(${avatarHue},45%,38%), hsl(${avatarHue+30},50%,28%))`,
                      boxShadow: '0 0 0 2px var(--gold-dark)',
                    }}
                  >
                    <span className="text-xs font-bold text-white leading-none">
                      {user.full_name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                {/* Online dot */}
                <span
                  className="absolute bottom-0 right-0 w-2 h-2 rounded-pill bg-success"
                  style={{ border: '1.5px solid white' }}
                />
              </div>

              {/* Name + role */}
              <div className="min-w-0 flex-1">
                <p className={`
                  text-sm font-semibold leading-snug truncate
                  ${profileActive ? 'text-white' : 'text-navy-900'}
                `}>
                  {user.full_name}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <TinyCross light />
                  <span className={`text-2xs font-medium ${profileActive ? 'text-navy-100' : 'text-neutral-500'}`}>
                    {ROLE_LABELS[user.role]?.[lang] || user.role}
                  </span>
                </div>
              </div>

              {/* Pip / icon */}
              {profileActive ? (
                <span
                  className="w-1.5 h-1.5 rounded-pill bg-gold-500 flex-shrink-0"
                  style={{ boxShadow: '0 0 6px rgba(196,154,42,0.6)' }}
                />
              ) : (
                <span className="text-neutral-400 flex-shrink-0 flex opacity-60">
                  {ICONS.profile}
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* ── Navigation ────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
          {navSections.map((section, si) => {
            const sectionLabel = lang === 'sw' ? section.labelSw : section.labelEn;
            return (
              <div key={sectionLabel}>

                {/* Section divider */}
                {si > 0 && (
                  <div className="flex items-center gap-2 px-4 pt-2 pb-1 mt-1 text-neutral-300">
                    <div className="flex-1 h-px bg-neutral-100" />
                    <TinyCross />
                    <div className="flex-1 h-px bg-neutral-100" />
                  </div>
                )}

                {/* Section label */}
                <p className="px-5 pb-1.5 pt-0.5 text-2xs font-black tracking-widest uppercase text-neutral-400">
                  {sectionLabel}
                </p>

                {/* Items */}
                {section.items.map(item => {
                  const active = isActive(item.href);
                  const label  = lang === 'sw' ? item.labelSw : item.labelEn;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onMobileClose}
                      className="block no-underline mx-2 my-px rounded-lg"
                    >
                      <div
                        className={`
                          flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg
                          transition-colors duration-150
                          ${active
                            ? 'text-white'
                            : 'text-neutral-600 hover:bg-neutral-50 hover:text-navy-900'
                          }
                        `}
                        style={active ? { background: 'linear-gradient(135deg, var(--navy-dark) 0%, var(--navy) 100%)' } : {}}
                      >
                        {/* Icon box */}
                        <span
                          className={`
                            w-7 h-7 rounded-lg flex-shrink-0
                            flex items-center justify-center
                            border transition-all duration-150
                            ${active
                              ? 'border-white/10 text-gold-400'
                              : 'bg-neutral-50 border-neutral-100 text-neutral-500'
                            }
                          `}
                          style={active ? { background: 'rgba(255,255,255,0.12)' } : {}}
                        >
                          {item.icon}
                        </span>

                        {/* Label */}
                        <span className={`flex-1 text-sm ${active ? 'font-semibold tracking-wide' : 'font-medium'}`}>
                          {label}
                        </span>

                        {/* Active pip */}
                        {active && (
                          <span
                            className="w-1.5 h-1.5 rounded-pill bg-gold-500 flex-shrink-0"
                            style={{ boxShadow: '0 0 6px rgba(196,154,42,0.55)' }}
                          />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* ── Bottom bar ────────────────────────────────────────── */}
        <div className="border-t border-neutral-100 px-3 pt-3 pb-4 flex-shrink-0">

          {/* Language toggle */}
          <div className="flex gap-1 bg-neutral-50 border border-neutral-100 rounded-lg p-0.5 mb-2">
            {['en', 'sw'].map(l => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                className={`
                  flex-1 py-1.5 text-2xs font-bold rounded-md border-none cursor-pointer
                  uppercase tracking-wider transition-all duration-150
                  ${lang === l
                    ? 'text-navy-950'
                    : 'bg-transparent text-neutral-500 hover:text-navy-900'
                  }
                `}
                style={lang === l ? { background: 'var(--gold)' } : {}}
              >
                {l === 'en' ? 'English' : 'Kiswahili'}
              </button>
            ))}
          </div>

          {/* Sign out */}
          <button
            onClick={logout}
            className="
              w-full flex items-center gap-2.5 px-2.5 py-1.5
              rounded-lg border-none bg-transparent cursor-pointer
              text-sm font-medium text-neutral-500
              transition-colors duration-150
              hover:bg-danger-bg hover:text-danger
            "
            style={{ '--danger-bg': 'var(--danger-bg)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = ''; }}
          >
            <span className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center bg-neutral-50 border border-neutral-100">
              {ICONS.logout}
            </span>
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}