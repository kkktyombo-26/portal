'use client';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import { canManageMembers, canManageGroups, canBroadcast, canManageSocialMedia } from '../../lib/auth';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ROLE_LABELS = {
  pastor:       { en: 'Pastor',       sw: 'Mchungaji' },
  elder:        { en: 'Elder',        sw: 'Mzee' },
  group_leader: { en: 'Group Leader', sw: 'Kiongozi' },
  member:       { en: 'Member',       sw: 'Mwanachama' },
};

// ── Nav icons — custom SVG paths, no emoji ────────────────────────
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
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 3"/>
    </svg>
  ),
  profile: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  logout: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

// ── Tiny decorative cross ─────────────────────────────────────────
function TinyCross({ opacity = 0.12 }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity, flexShrink: 0 }}>
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
        { href: '/dashboard',               labelEn: 'Dashboard',        labelSw: 'Dashibodi',          icon: ICONS.dashboard },
        { href: '/dashboard/youtube',        labelEn: 'YouTube',          labelSw: 'YouTube',            icon: ICONS.youtube },
      ],
    },
    {
      labelEn: 'People', labelSw: 'Watu',
      items: [
        canManageMembers(user.role) && { href: '/dashboard/members',         labelEn: 'Members',          labelSw: 'Washarika',    icon: ICONS.members },
        canManageMembers(user.role) && { href: '/dashboard/pending-members', labelEn: 'Pending Approval', labelSw: 'Wanaosubiri',  icon: ICONS.pending },
        canManageGroups(user.role)  && { href: '/dashboard/groups',          labelEn: 'Groups',           labelSw: 'Vikundi',      icon: ICONS.groups },
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
        canBroadcast(user.role) && {
          href: '/dashboard/it',
          labelEn: 'IT Dashboard', labelSw: 'Dashibodi ya IT',
          icon: ICONS.it,
        },
        canManageSocialMedia(user.role) && {
          href: '/dashboard/youtube/upload',
          labelEn: 'Upload to YouTube', labelSw: 'Pakia Video YouTube',
          icon: ICONS.upload,
        },
      ].filter(Boolean),
    },
    {
      labelEn: 'Resources', labelSw: 'Rasilimali',
      items: [
        { href: '/dashboard/forms', labelEn: 'Forms', labelSw: 'Fomu', icon: ICONS.forms },
      ],
    },
  ].filter(s => s && s.items.length > 0);

  const isActive = href => pathname === href;

  // Avatar initials colour — consistent per user
  const avatarHue = ((user.full_name?.charCodeAt(0) || 65) * 7) % 360;

  const profileActive = isActive('/dashboard/profile');

  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-30 md:hidden animate-fade-in"
          onClick={onMobileClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-[240px] bg-canvas border-r border-hairline z-40
        flex flex-col transition-transform duration-200
        md:translate-x-0 md:static md:h-screen
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* ── Wordmark ── */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-hairline flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div style={{
              width: 26, height: 26, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #1B3A6B 0%, #2a5298 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="5" y="1.5" width="2" height="9" rx="1" fill="#C8A84B"/>
                <rect x="1.5" y="4.5" width="9" height="2" rx="1" fill="white" opacity="0.7"/>
              </svg>
            </div>
            <p className="font-display text-sm font-bold text-ink tracking-tight leading-tight truncate">
              {lang === 'sw' ? 'Mfumo wa Kanisa' : 'Church Portal'}
            </p>
          </div>
          <button onClick={onMobileClose} className="md:hidden btn-ghost w-7 h-7 text-base leading-none">×</button>
        </div>

        {/* ── User card — clickable, links to profile ── */}
        <Link
          href="/dashboard/profile"
          onClick={onMobileClose}
          style={{ textDecoration: 'none' }}
        >
          <div style={{
            padding: '10px 12px',
            borderBottom: '1px solid var(--color-hairline)',
            margin: '0 0 2px',
            borderRadius: 0,
            background: profileActive
              ? 'linear-gradient(135deg, #1B3A6B 0%, #2a5298 100%)'
              : 'transparent',
            transition: 'background 0.15s',
            cursor: 'pointer',
          }}
            onMouseEnter={e => { if (!profileActive) e.currentTarget.style.background = 'var(--color-surface)'; }}
            onMouseLeave={e => { if (!profileActive) e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {user.profile_photo_url ? (
                  <img
                    src={user.profile_photo_url}
                    alt={user.full_name}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
                      boxShadow: profileActive
                        ? '0 0 0 2px rgba(255,255,255,0.3)'
                        : `0 0 0 2px white, 0 0 0 3px hsl(${avatarHue},40%,70%)`,
                    }}
                  />
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: profileActive
                      ? 'rgba(255,255,255,0.2)'
                      : `linear-gradient(135deg, hsl(${avatarHue},55%,45%), hsl(${avatarHue+30},60%,35%))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: profileActive
                      ? '0 0 0 2px rgba(255,255,255,0.25)'
                      : `0 0 0 2px white, 0 0 0 3px hsl(${avatarHue},40%,70%)`,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                      {user.full_name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                {/* Online dot */}
                <span style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#22c55e', border: '1.5px solid white',
                }}/>
              </div>

              {/* Name + role */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{
                  fontSize: 13, fontWeight: 600, lineHeight: 1.2,
                  color: profileActive ? '#fff' : 'var(--color-ink)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user.full_name}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <TinyCross opacity={profileActive ? 0.5 : 0.25} />
                  <p style={{
                    fontSize: 10, fontWeight: 500,
                    color: profileActive ? 'rgba(255,255,255,0.7)' : 'var(--color-ink-faint)',
                  }}>
                    {ROLE_LABELS[user.role]?.[lang] || user.role}
                  </p>
                </div>
              </div>

              {/* Profile chevron / active pip */}
              {profileActive ? (
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#C8A84B', boxShadow: '0 0 6px #C8A84B88',
                  flexShrink: 0,
                }}/>
              ) : (
                <span style={{
                  color: 'var(--color-ink-faint)', flexShrink: 0, fontSize: 11, opacity: 0.5,
                }}>
                  {ICONS.profile}
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navSections.map((section, si) => {
            const sectionLabel = lang === 'sw' ? section.labelSw : section.labelEn;
            return (
              <div key={sectionLabel}>
                {si > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px 6px', margin: '4px 0 0' }}>
                    <div style={{ flex: 1, height: '0.5px', background: 'var(--color-hairline, #e5e7eb)' }}/>
                    <TinyCross opacity={0.18} />
                    <div style={{ flex: 1, height: '0.5px', background: 'var(--color-hairline, #e5e7eb)' }}/>
                  </div>
                )}

                <p style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.13em',
                  textTransform: 'uppercase', color: 'var(--color-ink-faint, #94a3b8)',
                  padding: '2px 20px 6px',
                }}>
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
                      style={{ display: 'block', textDecoration: 'none', margin: '1px 8px', borderRadius: 8 }}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '7px 12px',
                        borderRadius: 8,
                        background: active
                          ? 'linear-gradient(135deg, #1B3A6B 0%, #2a5298 100%)'
                          : 'transparent',
                        position: 'relative',
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--color-surface, #f8fafc)'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{
                          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: active ? 'rgba(255,255,255,0.15)' : 'var(--color-surface, #f8fafc)',
                          border: active ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--color-hairline, #e5e7eb)',
                          color: active ? '#C8A84B' : 'var(--color-ink-muted, #6b7280)',
                          transition: 'all 0.15s',
                        }}>
                          {item.icon}
                        </span>

                        <span style={{
                          flex: 1, fontSize: 13, fontWeight: active ? 700 : 500,
                          color: active ? '#fff' : 'var(--color-ink-muted, #6b7280)',
                          letterSpacing: active ? '0.01em' : '0',
                          transition: 'color 0.15s',
                        }}>
                          {label}
                        </span>

                        {active && (
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: '#C8A84B', boxShadow: '0 0 6px #C8A84B88',
                            flexShrink: 0,
                          }}/>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* ── Bottom bar ── */}
        <div style={{
          borderTop: '1px solid var(--color-hairline, #e5e7eb)',
          padding: '12px 12px 14px',
          flexShrink: 0,
        }}>
          {/* Language toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'var(--color-surface, #f8fafc)',
            border: '1px solid var(--color-hairline, #e5e7eb)',
            borderRadius: 10, padding: 3, marginBottom: 8,
          }}>
            {['en', 'sw'].map(l => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                style={{
                  flex: 1, padding: '5px 0', fontSize: 11, fontWeight: 700,
                  borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: lang === l
                    ? 'linear-gradient(135deg, #1B3A6B 0%, #2a5298 100%)'
                    : 'transparent',
                  color: lang === l ? '#fff' : 'var(--color-ink-muted, #6b7280)',
                  transition: 'all 0.15s',
                  letterSpacing: '0.03em',
                }}
              >
                {l === 'en' ? 'English' : 'Kiswahili'}
              </button>
            ))}
          </div>

          {/* Sign out */}
          <button
            onClick={logout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 12px', borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer',
              color: 'var(--color-ink-muted, #6b7280)',
              transition: 'background 0.15s, color 0.15s',
              fontSize: 13, fontWeight: 500,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#b91c1c'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-ink-muted, #6b7280)'; }}
          >
            <span style={{
              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--color-surface, #f8fafc)',
              border: '1px solid var(--color-hairline, #e5e7eb)',
            }}>
              {ICONS.logout}
            </span>
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}