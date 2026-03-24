'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import { userApi, announcementApi } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import RoleBadge from '../../components/ui/RoleBadge';

const ROLE_GREETINGS = {
  en: { pastor: 'Good day, Pastor', elder: 'Good day, Elder', group_leader: 'Good day', member: 'Welcome' },
  sw: { pastor: 'Habari, Mchungaji', elder: 'Habari, Mzee', group_leader: 'Habari', member: 'Karibu' },
};

export default function DashboardPage() {
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);
  const [stats, setStats]               = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [annRes] = await Promise.all([announcementApi.getAll()]);
        setAnnouncements(annRes.data.data.slice(0, 5));
        if (user.role === 'pastor') {
          const statsRes = await userApi.getStats();
          setStats(statsRes.data.data);
        }
      } catch (_) {}
      finally { setLoading(false); }
    };
    fetch();
  }, [user]);

  const greeting = ROLE_GREETINGS[lang]?.[user.role] || 'Welcome';
  const firstName = user.full_name?.split(' ')[0] || '';

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Dashibodi' : 'Dashboard'}
        title={`${greeting}, ${firstName}`}
        subtitle={lang === 'sw' ? 'Hii ndiyo muhtasari wako wa leo' : "Here's your overview for today"}
      />

      <div className="px-8 py-8 max-w-content">

        {/* Stats — pastor only */}
        {user.role === 'pastor' && stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
            <StatCard label={t('total_members')}        value={stats.totalMembers}        index={0} />
            <StatCard label={t('active_members')}       value={stats.activeMembers}       index={1} />
            <StatCard label={t('total_groups')}         value={stats.totalGroups}         index={2} />
            <StatCard label={t('recent_announcements')} value={stats.recentAnnouncements} index={3} />
          </div>
        )}

        {/* Role info for non-pastors */}
        {user.role !== 'pastor' && (
          <div className="mb-10 flex items-center gap-4">
            <RoleBadge role={user.role} lang={lang} />
            {user.group_name && (
              <>
                <span className="text-ink-faint text-xs">·</span>
                <span className="text-xs text-ink-muted">{user.group_name}</span>
              </>
            )}
          </div>
        )}

        {/* Announcements */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">{t('announcements')}</p>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-12 text-center text-ink-muted text-sm">{t('no_data')}</div>
          ) : (
            <div className="space-y-0">
              {announcements.map((a, i) => (
                <div key={a.id} className={`animate-slide-up stagger-${Math.min(i+1,6)}`}>
                  <div className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink text-sm leading-snug">
                          {lang === 'sw' ? a.title_sw : a.title_en}
                        </p>
                        <p className="text-sm text-ink-muted mt-1 leading-relaxed line-clamp-2">
                          {lang === 'sw' ? a.body_sw : a.body_en}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-ink-faint">
                            {t('posted_by')} {a.author_name}
                          </span>
                          {a.scope === 'group' && a.group_name && (
                            <>
                              <span className="text-ink-faint text-xs">·</span>
                              <span className="text-xs text-ink-faint">{a.group_name}</span>
                            </>
                          )}
                          <span className="text-ink-faint text-xs">·</span>
                          <span className="text-xs text-ink-faint font-mono">
                            {new Date(a.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <span className={`status-dot flex-shrink-0 mt-1.5 ${a.scope === 'church' ? 'bg-ink-muted' : 'bg-ink-faint'}`} />
                    </div>
                  </div>
                  {i < announcements.length - 1 && <div className="hairline" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
