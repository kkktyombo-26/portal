'use client';
const ROLE_DOTS = {
  pastor:       'bg-ink',
  elder:        'bg-ink-muted',
  group_leader: 'bg-ink-muted',
  member:       'bg-ink-faint',
};
const ROLE_LABELS = {
  pastor:       { en: 'Pastor',       sw: 'Mchungaji' },
  elder:        { en: 'Elder',        sw: 'Mzee' },
  group_leader: { en: 'Group Leader', sw: 'Kiongozi' },
  member:       { en: 'Member',       sw: 'Msharika' },
};

export default function RoleBadge({ role, lang = 'en' }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`status-dot ${ROLE_DOTS[role] || 'bg-ink-faint'}`} />
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {ROLE_LABELS[role]?.[lang] || role}
      </span>
    </span>
  );
}
