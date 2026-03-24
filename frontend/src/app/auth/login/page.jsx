'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';

export default function LoginPage() {
  const { login, lang } = useAuth();
  const { t } = useTranslation(lang);
  const router = useRouter();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await login(form.email, form.password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-slide-up">

        {/* Church name */}
        <div className="text-center mb-10">
          <h1 className="font-display text-2xl font-bold text-ink">
            {lang === 'sw' ? 'Mfumo wa Kanisa' : 'Church Portal'}
          </h1>
          <p className="text-sm text-ink-muted mt-2">{t('sign_in_to')}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3.5 rounded-lg border border-danger-border bg-danger-bg text-danger text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="field-label">{t('email')}</label>
            <input type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@church.com" className="field-input" required />
          </div>

          <div>
            <label className="field-label">{t('password')}</label>
            <input type="password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••••" className="field-input" required />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {lang === 'sw' ? 'Inaingia...' : 'Signing in...'}
              </span>
            ) : t('login')}
          </button>
        </form>

        <div className="hairline my-6" />

        <p className="text-center text-sm text-ink-muted">
          {t('no_account')}{' '}
          <Link href="/auth/register" className="font-semibold text-ink underline underline-offset-2">
            {t('register')}
          </Link>
        </p>

        {/* Demo credentials hint */}
        <div className="mt-6 p-4 bg-parchment rounded-lg border border-hairline">
          <p className="text-xs text-ink-muted font-semibold uppercase tracking-wider mb-2">
            {lang === 'sw' ? 'Akaunti za Majaribio' : 'Demo Accounts'}
          </p>
          <div className="space-y-1 text-xs text-ink-muted font-mono">
            <p>pastor@church.com / pastor123</p>
            <p>elder@church.com / elder123</p>
            <p>choir@church.com / choir123</p>
            <p>mary@church.com / member123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
