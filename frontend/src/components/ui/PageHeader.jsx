'use client';
export default function PageHeader({ breadcrumb, title, subtitle, action }) {
  return (
    <div className="bg-canvas border-b border-hairline px-8 py-7 flex-shrink-0">
      {breadcrumb && <p className="section-label mb-2">{breadcrumb}</p>}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink tracking-tight leading-none">{title}</h1>
          {subtitle && <p className="text-sm text-ink-muted mt-2">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
