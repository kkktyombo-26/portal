'use client';
export default function PageHeader({ breadcrumb, title, subtitle, action }) {
  return (
    <div
      className="flex-shrink-0 px-8 py-7"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      {breadcrumb && (
        <p
          className="font-sans font-semibold"
          style={{
            fontSize: '0.6875rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            marginBottom: '0.5rem',
          }}
        >
          {breadcrumb}
        </p>
      )}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1
            className="font-display font-bold leading-none"
            style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className="font-sans"
              style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}