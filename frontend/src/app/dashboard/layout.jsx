'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import DashboardShell from '../../components/layout/DashboardShell';

export default function DashboardLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
