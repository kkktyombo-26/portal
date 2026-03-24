'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '../lib/auth';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(isAuthenticated() ? '/dashboard' : '/auth/login');
  }, [router]);
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <span className="w-6 h-6 border-2 border-border border-t-ink-muted rounded-full animate-spin" />
    </div>
  );
}
