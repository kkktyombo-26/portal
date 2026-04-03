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

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { user, logout, lang, switchLang } = useAuth();
  const { t } = useTranslation(lang);
  const pathname = usePathname();

  if (!user) return null;

  const navSections = [
    {
      label: lang === 'sw' ? 'Jumla' : 'Overview',
      items: [
        { href: '/dashboard', label: t('dashboard'), icon: '◈' },
      ],
    },
    {
      label: lang === 'sw' ? 'Watu' : 'People',
      items: [
        canManageMembers(user.role) && { href: '/dashboard/members', label: t('members'), icon: '○' },
        canManageGroups(user.role)  && { href: '/dashboard/groups',  label: t('groups'),  icon: '◫' },
      ].filter(Boolean),
    }

  



    ,
  {
  label: lang === 'sw' ? 'Mawasiliano' : 'Communication',
  items: [
    { href: '/dashboard/announcements', label: t('announcements'), icon: '◎' },
    { href: '/dashboard/events', label: lang === 'sw' ? 'Ratiba' : 'Schedule', icon: '◷' },

  ].filter(Boolean),
},
{
  label: lang === 'sw' ? 'Dawati la IT' : 'IT Desk',
items: [
  canBroadcast(user.role) && {
    href: '/dashboard/it',
    label: lang === 'sw' ? 'Dashibodi ya IT' : 'IT Dashboard',
    icon: '◉',
  },
 
          canManageSocialMedia(user.role) && {
            href: '/dashboard/youtube/upload',
            label: lang === 'sw' ? 'Pakia Video YouTube' : 'Upload to YouTube',
            icon: '⬆',
          },
       
],
},
  {
      label: lang === 'sw' ? 'Rasilimali' : 'Resources',
      items: [
        { href: '/dashboard/forms', label: lang === 'sw' ? 'Fomu' : 'Forms', icon: '◻' },
      ],
    },
    ,
  
  ].filter(s => s.items.length > 0);

  const isActive = (href) => pathname === href;

  return (
    <>
      {/* Mobile scrim */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-30 md:hidden animate-fade-in"
          onClick={onMobileClose} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-[240px] bg-canvas border-r border-hairline z-40
        flex flex-col transition-transform duration-200
        md:translate-x-0 md:static md:h-screen
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>

        {/* Wordmark */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-hairline flex-shrink-0">
          <div>
            <p className="font-display text-base font-bold text-ink tracking-tight leading-tight">
              {lang === 'sw' ? 'Mfumo wa Kanisa' : 'Church Portal'}
            </p>
          </div>
          <button onClick={onMobileClose} className="md:hidden btn-ghost w-7 h-7 text-base">×</button>
        </div>

        {/* User identity */}
        <div className="px-5 py-4 border-b border-hairline flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-parchment border border-hairline flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-ink-muted">
                {user.full_name?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{user.full_name}</p>
              <p className="text-xs text-ink-faint">
                {ROLE_LABELS[user.role]?.[lang] || user.role}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3">
          {navSections.map((section, si) => (
            <div key={section.label}>
              {si > 0 && <div className="hairline my-2" />}
              <p className="section-label px-5 pt-2 pb-1.5">{section.label}</p>
              {section.items.map(item => {
                const active = isActive(item.href);
                return (
                  <Link key={item.href} href={item.href}
                    onClick={onMobileClose}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2.5 relative
                      transition-colors duration-100
                      ${active ? 'text-ink' : 'text-ink-muted hover:text-ink hover:bg-surface'}
                    `}
                  >
                    {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-ink rounded-r-full" />}
                    <span className={`text-sm w-4 text-center flex-shrink-0 leading-none ${active ? 'text-ink' : 'text-ink-faint'}`}>
                      {item.icon}
                    </span>
                    <span className={`flex-1 text-sm ${active ? 'font-semibold' : 'font-medium'}`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Language toggle + sign out */}
        <div className="border-t border-hairline px-4 py-4 flex-shrink-0 space-y-1">
          <div className="flex items-center gap-1 bg-surface border border-hairline rounded-md p-0.5 mb-3">
            {['en', 'sw'].map(l => (
              <button key={l} onClick={() => switchLang(l)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded transition-colors duration-100
                  ${lang === l ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'}`}>
                {l === 'en' ? 'English' : 'Kiswahili'}
              </button>
            ))}
          </div>
          <button onClick={logout} className="flat-row rounded-md w-full text-ink-muted hover:text-ink text-sm font-medium">
            <span className="text-sm w-4 text-center">↩</span>
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  );
}