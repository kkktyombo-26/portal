'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../lib/i18n';
import { userApi, announcementApi } from '../../lib/api';
import api from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import RoleBadge from '../../components/ui/RoleBadge';

// ─── Role greeting labels ─────────────────────────────────────────────────────
const ROLE_GREETINGS = {
  en: { pastor: 'Pastor', elder: 'Elder', group_leader: 'Leader', katibu: 'Secretary', mweka_hazina: 'Treasurer', member: 'Welcome' },
  sw: { pastor: 'Mchungaji', elder: 'Mzee', group_leader: 'Kiongozi', katibu: 'Katibu', mweka_hazina: 'Mweka Hazina', member: 'Karibu' },
};

// ─── Permission helpers ───────────────────────────────────────────────────────
const isAdmin   = r => ['pastor', 'katibu'].includes(r);
const isFinance = r => ['pastor', 'katibu', 'mweka_hazina'].includes(r);
const isLeader  = r => ['pastor', 'katibu', 'elder', 'group_leader'].includes(r);

// ─── Announcement card ────────────────────────────────────────────────────────
// Data shape (from announcementApi.getAll):
//   title_sw, title_en, body_sw, body_en,
//   created_at, author_name, scope ('church'|'group'), group_name, image_url
function AnnouncementCard({ a, lang, t, index }) {
  const title    = lang === 'sw' ? a.title_sw : a.title_en;
  const body     = lang === 'sw' ? a.body_sw  : a.body_en;
  const isChurch = a.scope === 'church';

  return (
    <div
      className={`animate-slide-up stagger-${Math.min(index + 1, 6)}`}
      style={{ position: 'relative', background: '#1B2F50', borderRadius: 10, overflow: 'hidden' }}
    >
      {/* Background image — very low opacity (same as RightPanel banner) */}
      {a.image_url && (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${a.image_url})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.25, pointerEvents: 'none',
        }} />
      )}

      {/* Left accent line — gold for church-wide, blue for group */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, width: 2,
        background: isChurch ? '#C8A84B' : '#5B8AD4',
      }} />

      <div style={{ padding: '14px 16px 14px 20px', position: 'relative' }}>
        {/* Row 1: scope label + date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: isChurch ? '#C8A84B' : '#5B8AD4',
          }}>
            {isChurch
              ? (lang === 'sw' ? 'Kanisa Lote' : 'Church-wide')
              : (a.group_name || (lang === 'sw' ? 'Kikundi' : 'Group'))}
          </span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>
            {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
          </span>
        </div>

        {/* Row 2: title */}
        <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.35, marginBottom: 4 }}>
          {title}
        </p>

        {/* Row 3: body — 2-line clamp */}
        <p style={{
          fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginBottom: 8,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {body}
        </p>

        {/* Row 4: author */}
        {a.author_name && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
            {t('posted_by')} {a.author_name}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, lang } = useAuth();
  const { t } = useTranslation(lang);

  const [stats,         setStats]         = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [projects,      setProjects]      = useState([]);
  const [resolutions,   setResolutions]   = useState([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    const none = Promise.resolve(null); // placeholder for skipped calls
    const load = async () => {
      // All requests fire in parallel; failures are caught per-slot
      const all = await Promise.allSettled([
        announcementApi.getAll(),                                              // [0] always
        isFinance(user.role) ? userApi.getStats()                : none,      // [1]
        isLeader(user.role)  ? api.get('/projects?status=active&limit=4')     : none, // [2]
        isLeader(user.role)  ? api.get('/resolutions?status=pending&limit=5') : none, // [3]
      ]);

      const get = i =>
        all[i].status === 'fulfilled' && all[i].value != null ? all[i].value : null;

      const ann  = get(0); if (ann)  setAnnouncements((ann.data.data  || []).slice(0, 6));
      const st   = get(1); if (st)   setStats(st.data.data);
      const proj = get(2); if (proj) setProjects(proj.data.data  || []);
      const res  = get(3); if (res)  setResolutions(res.data.data || []);

      setLoading(false);
    };
    load();
  }, [user]);

  const greeting  = ROLE_GREETINGS[lang]?.[user.role] ?? (lang === 'sw' ? 'Karibu' : 'Welcome');
  const firstName = user.full_name?.split(' ')[0] ?? '';

  return (
    <div>
      <PageHeader
        breadcrumb={lang === 'sw' ? 'Dashibodi' : 'Dashboard'}
        title={`${greeting}, ${firstName}`}
        subtitle={lang === 'sw' ? 'Hii ndiyo muhtasari wako wa leo' : "Here's your overview for today"}
      />

      <div className="px-8 py-8 max-w-content space-y-10">

        {/* ── MEMBER BREAKDOWN (pastor, katibu) ────────────────────────────── */}
        {/* PDF spec: Jumla | Watoto | Vijana | Wanawake | Wanaume | Wazee     */}
        {isAdmin(user.role) && stats && (
          <section>
            <p className="section-label mb-3">{lang === 'sw' ? 'Washarika' : 'Members'}</p>
            <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label={lang === 'sw' ? 'Jumla'    : 'Total'}    value={stats.totalMembers ?? '—'} index={0} />
              <StatCard label={lang === 'sw' ? 'Watoto'   : 'Children'} value={stats.children    ?? '—'} index={1} />
              <StatCard label={lang === 'sw' ? 'Vijana'   : 'Youth'}    value={stats.youth       ?? '—'} index={2} />
              <StatCard label={lang === 'sw' ? 'Wanawake' : 'Women'}    value={stats.women       ?? '—'} index={3} />
              <StatCard label={lang === 'sw' ? 'Wanaume'  : 'Men'}      value={stats.men         ?? '—'} index={4} />
              <StatCard label={lang === 'sw' ? 'Wazee'    : 'Elders'}   value={stats.elders      ?? '—'} index={5} />
            </div>
          </section>
        )}

        {/* ── OPERATIONS (pastor, katibu) ───────────────────────────────────── */}
        {/* PDF spec: Miradi | Mikataba | Vikundi | Matangazo                   */}
        {isAdmin(user.role) && stats && (
          <section>
            <p className="section-label mb-3">{lang === 'sw' ? 'Shughuli' : 'Operations'}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label={lang === 'sw' ? 'Vikundi'   : 'Groups'}        value={stats.totalGroups         ?? '—'} index={0} />
              <StatCard label={lang === 'sw' ? 'Miradi'    : 'Projects'}      value={stats.activeProjects      ?? '—'} index={1} />
              <StatCard label={lang === 'sw' ? 'Mikataba'  : 'Contracts'}     value={stats.activeContracts     ?? '—'} index={2} />
              <StatCard label={lang === 'sw' ? 'Matangazo' : 'Announcements'} value={stats.recentAnnouncements ?? '—'} index={3} />
            </div>
          </section>
        )}

        {/* ── FINANCE & ASSETS (pastor, katibu, mweka_hazina) ──────────────── */}
        {/* PDF spec: Mapato | Mali | Vitega Uchumi | Uwakili                   */}
        {isFinance(user.role) && stats && (
          <section>
            <p className="section-label mb-3">{lang === 'sw' ? 'Fedha & Mali' : 'Finance & Assets'}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label={lang === 'sw' ? 'Mapato (Mwezi)' : 'Income (Month)'} value={stats.monthlyIncome ?? '—'} index={0} />
              <StatCard label={lang === 'sw' ? 'Uwakili'        : 'Contributions'}  value={stats.totalUwakili ?? '—'} index={1} />
              <StatCard label={lang === 'sw' ? 'Mali'           : 'Assets'}         value={stats.totalAssets  ?? '—'} index={2} />
              <StatCard label={lang === 'sw' ? 'Vitega Uchumi'  : 'Investments'}    value={stats.investments  ?? '—'} index={3} />
            </div>
          </section>
        )}

        {/* ── PENDING RESOLUTIONS (pastor, katibu, elder, group_leader) ─────── */}
        {/* PDF spec: Maazimio ambayo hayajakamilika                             */}
        {isLeader(user.role) && resolutions.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="section-label">{lang === 'sw' ? 'Maazimio Yanayosubiri' : 'Pending Resolutions'}</p>
              <span className="text-xs font-mono text-ink-faint">{resolutions.length}</span>
            </div>
            <div className="rounded-lg overflow-hidden border border-border">
              {resolutions.map((r, i) => (
                <div key={r.id}>
                  <div className="py-3 px-4 flex items-start gap-3">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink leading-snug">{r.title}</p>
                      <p className="text-xs text-ink-faint mt-0.5">
                        {new Date(r.meeting_date ?? r.created_at).toLocaleDateString()}
                        {r.responsible && <> · {r.responsible}</>}
                      </p>
                    </div>
                    {r.deadline && (
                      <span className="text-xs font-mono text-ink-faint flex-shrink-0">
                        {new Date(r.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  {i < resolutions.length - 1 && <div className="hairline" />}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── ACTIVE PROJECTS (pastor, katibu, elder, group_leader) ─────────── */}
        {isLeader(user.role) && projects.length > 0 && (
          <section>
            <p className="section-label mb-4">{lang === 'sw' ? 'Miradi Inayoendelea' : 'Active Projects'}</p>
            <div className="rounded-lg overflow-hidden border border-border">
              {projects.map((p, i) => (
                <div key={p.id}>
                  <div className="py-3 px-4">
                    <div className="flex items-center justify-between gap-4 mb-1.5">
                      <p className="text-sm font-medium text-ink truncate">{p.name}</p>
                      <span className="text-xs font-mono text-ink-faint flex-shrink-0">{p.progress ?? 0}%</span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${p.progress ?? 0}%`,
                          background:
                            (p.progress ?? 0) >= 75 ? '#22c55e' :
                            (p.progress ?? 0) >= 40 ? '#C8A84B' : '#1B2F50',
                        }}
                      />
                    </div>
                    {p.contractor && (
                      <p className="text-xs text-ink-faint mt-1">{p.contractor}</p>
                    )}
                  </div>
                  {i < projects.length - 1 && <div className="hairline" />}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── ROLE BADGE (non-admin roles) ──────────────────────────────────── */}
        {!isAdmin(user.role) && (
          <div className="flex items-center gap-4">
            <RoleBadge role={user.role} lang={lang} />
            {user.group_name && (
              <>
                <span className="text-ink-faint text-xs">·</span>
                <span className="text-xs text-ink-muted">{user.group_name}</span>
              </>
            )}
          </div>
        )}

        {/* ── ANNOUNCEMENTS (everyone) ──────────────────────────────────────── */}
        <section>
          <p className="section-label mb-4">{t('announcements')}</p>

          {loading ? (
            <div className="py-12 flex justify-center">
              <span className="w-5 h-5 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-12 text-center text-ink-muted text-sm">{t('no_data')}</div>
          ) : (
            <div className="space-y-3">
              {announcements.map((a, i) => (
                <AnnouncementCard key={a.id} a={a} lang={lang} t={t} index={i} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}