'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { authApi } from '../../../lib/api';
import { setAuth } from '../../../lib/auth';

const GROUP_TYPES = [
  { value: 'choir',    en: 'Choir',    sw: 'Kwaya' },
  { value: 'youth',    en: 'Youth',    sw: 'Vijana' },
  { value: 'elders',   en: 'Elders',   sw: 'Wazee' },
  { value: 'women',    en: 'Women',    sw: 'Wanawake' },
  { value: 'men',      en: 'Men',      sw: 'Wanaume' },
  { value: 'children', en: 'Children', sw: 'Watoto' },
];

export default function RegisterPage() {
  const { lang } = useAuth();
  const { t } = useTranslation(lang);
  const router = useRouter();
  const [form, setForm]       = useState({ full_name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = await authApi.register({ ...form, role: 'member' });
      setAuth(res.data.token, res.data.user);
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold text-ink">
            {lang === 'sw' ? 'Jisajili' : 'Join the Church'}
          </h1>
          <p className="text-sm text-ink-muted mt-2">
            {lang === 'sw' ? 'Unda akaunti yako' : 'Create your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3.5 rounded-lg border border-danger-border bg-danger-bg text-danger text-sm">{error}</div>
          )}
          <div>
            <label className="field-label">{t('full_name')}</label>
            <input value={form.full_name} onChange={set('full_name')} placeholder="John Mwangi" className="field-input" required />
          </div>
          <div>
            <label className="field-label">{t('email')}</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="you@church.com" className="field-input" required />
          </div>
          <div>
            <label className="field-label">{t('phone')}</label>
            <input value={form.phone} onChange={set('phone')} placeholder="+255 712 000 000" className="field-input" />
          </div>
          <div>
            <label className="field-label">{t('password')}</label>
            <input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" className="field-input" required minLength={6} />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center mt-2">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {lang === 'sw' ? 'Inasajili...' : 'Creating account...'}
              </span>
            ) : t('register')}
          </button>
        </form>

        <div className="hairline my-6" />
        <p className="text-center text-sm text-ink-muted">
          {t('have_account')}{' '}
          <Link href="/auth/login" className="font-semibold text-ink underline underline-offset-2">{t('login')}</Link>
        </p>
      </div>
    </div>
  );
}
