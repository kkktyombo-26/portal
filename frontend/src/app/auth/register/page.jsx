'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import { useTranslation } from '../../../lib/i18n';
import { authApi } from '../../../lib/api';
import { setAuth } from '../../../lib/auth';

export default function RegisterPage() {
  const { lang } = useAuth();
  const sw = lang === 'sw';
  const router = useRouter();

  const [form, setForm] = useState({
    full_name:          '',
    email:              '',
    password:           '',
    phone:              '',
    namba_ya_usharika:  '',
  });
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [registered, setRegistered] = useState(false); // success screen

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = await authApi.register({ ...form, role: 'member' });
      setAuth(res.data.token, res.data.user);
      setRegistered(true); // show pending screen instead of redirecting
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── decorative cross watermark ──────────────────────
  const CrossWatermark = () => (
    <div aria-hidden style={{
      position:'absolute', top:0, right:0,
      width:220, height:220, overflow:'hidden',
      pointerEvents:'none', opacity:0.04,
    }}>
      <div style={{ position:'absolute', top:16, right:80, width:12, height:120, background:'#1B3A6B', borderRadius:3 }} />
      <div style={{ position:'absolute', top:58, right:30, width:100, height:12,  background:'#1B3A6B', borderRadius:3 }} />
    </div>
  );

  // ─────────────────────────────────────────────────────
  // PENDING VERIFICATION screen
  // ─────────────────────────────────────────────────────
  if (registered) {
    return (
      <PageShell>
        <CrossWatermark />
        <LogoBlock sw={sw} />

        {/* Icon */}
        <div style={{textAlign:'center', marginBottom:20}}>
          <div style={{
            width:72, height:72, borderRadius:'50%',
            background:'#EAF0F8', border:'2px solid #C5D5EA',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            fontSize:32, marginBottom:14,
          }}>
            🕐
          </div>
          <h2 style={{margin:'0 0 8px', fontSize:19, fontWeight:700, color:'#1B3A6B'}}>
            {sw ? 'Akaunti Yako Inasubiri Idhini' : 'Account Pending Approval'}
          </h2>
          <p style={{margin:0, fontSize:13, color:'#6B7280', lineHeight:1.6, maxWidth:300, marginInline:'auto'}}>
            {sw
              ? 'Usajili wako umepokewa. Kiongozi wa kanisa atakagua na kukuidhinisha akaunti yako kabla ya kuingia.'
              : 'Your registration has been received. A church leader will review and approve your account before you can access the portal.'}
          </p>
        </div>

        {/* Info card */}
        <div style={{
          background:'#F5F0E8', border:'1px solid #E8DFC8',
          borderRadius:10, padding:'16px 18px', marginBottom:20,
        }}>
          <p style={{margin:'0 0 10px', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em'}}>
            {sw ? 'Hatua Zinazofuata' : 'What Happens Next'}
          </p>
          {[
            sw ? '✉️  Utapata barua pepe ya uthibitisho' : '✉️  You\'ll receive a confirmation email',
            sw ? '👤  Kiongozi ataangalia maombi yako'   : '👤  A leader will review your request',
            sw ? '✅  Utaarifu ukikubaliwa'              : '✅  You\'ll be notified once approved',
          ].map((step, i) => (
            <p key={i} style={{margin: i < 2 ? '0 0 6px' : '0', fontSize:13, color:'#374151'}}>
              {step}
            </p>
          ))}
        </div>

        {/* Registered details */}
        <div style={{
          background:'#EAF0F8', border:'1px solid #C5D5EA',
          borderRadius:10, padding:'14px 18px', marginBottom:20,
        }}>
          <p style={{margin:'0 0 8px', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em'}}>
            {sw ? 'Taarifa Ulizoweka' : 'Registered Details'}
          </p>
          {[
            [sw ? 'Jina' : 'Name', form.full_name],
            ['Email', form.email],
            ...(form.phone              ? [[sw ? 'Simu' : 'Phone', form.phone]] : []),
            ...(form.namba_ya_usharika  ? [[sw ? 'Namba ya Usharika' : 'Member No.', form.namba_ya_usharika]] : []),
          ].map(([label, value]) => (
            <div key={label} style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
              <span style={{fontSize:12, color:'#6B7280'}}>{label}</span>
              <span style={{fontSize:12, fontWeight:600, color:'#1B3A6B'}}>{value}</span>
            </div>
          ))}
        </div>

        <Link
          href="/auth/login"
          style={{
            display:'block', textAlign:'center',
            padding:'11px', borderRadius:8,
            border:'1px solid #DDD8CE', background:'#FDFCF9',
            color:'#1B3A6B', fontSize:14, fontWeight:600,
            textDecoration:'none', transition:'background 0.1s',
          }}
        >
          ← {sw ? 'Rudi Ukurasa wa Kuingia' : 'Back to Login'}
        </Link>
      </PageShell>
    );
  }

  // ─────────────────────────────────────────────────────
  // REGISTER FORM
  // ─────────────────────────────────────────────────────
  return (
    <PageShell>
      <CrossWatermark />
      <LogoBlock sw={sw} />

      <div style={{marginBottom:22}}>
        <h2 style={{margin:'0 0 3px', fontSize:19, fontWeight:700, color:'#111827'}}>
          {sw ? 'Jisajili' : 'Create Account'}
        </h2>
        <p style={{margin:0, fontSize:13, color:'#6B7280'}}>
          {sw ? 'Unda akaunti yako ya kanisa' : 'Join the KKKT Yombo DMP portal'}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:14}}>
        {error && <ErrorBanner msg={error} />}

        {/* Full name */}
        <div>
          <label style={labelStyle}>{sw ? 'Jina Kamili' : 'Full Name'}</label>
          <input
            className="field-input"
            value={form.full_name}
            onChange={set('full_name')}
            placeholder={sw ? 'mfano: Yohana Mwangi' : 'e.g. John Mwangi'}
            required
            autoFocus
          />
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>{sw ? 'Barua Pepe' : 'Email Address'}</label>
          <input
            className="field-input"
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="you@church.com"
            required
            autoComplete="email"
          />
        </div>

        {/* Phone + Member No — side by side */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div>
            <label style={labelStyle}>{sw ? 'Simu' : 'Phone'}</label>
            <input
              className="field-input"
              value={form.phone}
              onChange={set('phone')}
              placeholder="+255 712…"
              inputMode="tel"
            />
          </div>
          <div>
            <label style={labelStyle}>{sw ? 'Namba ya Usharika' : 'Member No.'}</label>
            <input
              className="field-input"
              value={form.namba_ya_usharika}
              onChange={set('namba_ya_usharika')}
              placeholder="KKKT-001"
            />
          </div>
        </div>

        {/* Optional hint under the grid */}
        <p style={{margin:'-8px 0 0', fontSize:11, color:'#9CA3AF'}}>
          {sw
            ? 'Namba ya usharika si lazima — inaweza kusaidia kiongozi kukuthibitisha.'
            : 'Member number is optional — it helps leaders verify you faster.'}
        </p>

        {/* Password */}
        <div>
          <label style={labelStyle}>{sw ? 'Nenosiri' : 'Password'}</label>
          <div style={{position:'relative'}}>
            <input
              className="field-input"
              type={showPass ? 'text' : 'password'}
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
              style={{paddingRight:44}}
            />
            <button
              type="button"
              onClick={() => setShowPass(p => !p)}
              style={{
                position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                background:'none', border:'none', cursor:'pointer',
                padding:4, color:'#9CA3AF', fontSize:16, lineHeight:1,
              }}
            >
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
          {/* Password strength hint */}
          {form.password.length > 0 && form.password.length < 6 && (
            <p style={{margin:'4px 0 0', fontSize:11, color:'#991B1B'}}>
              {sw ? 'Herufi 6 au zaidi zinahitajika' : 'At least 6 characters required'}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !form.full_name || !form.email || !form.password}
          className="btn-primary w-full justify-center"
          style={{marginTop:4}}
        >
          {loading
            ? <Spinner label={sw ? 'Inasajili...' : 'Creating account…'} />
            : (sw ? 'Jisajili' : 'Create Account')}
        </button>
      </form>

      <div className="hairline" style={{margin:'20px 0'}} />

      <p style={{textAlign:'center', fontSize:13, color:'#6B7280', margin:0}}>
        {sw ? 'Una akaunti?' : 'Already have an account?'}{' '}
        <Link
          href="/auth/login"
          style={{fontWeight:700, color:'#1B3A6B', textDecoration:'underline', textUnderlineOffset:2}}
        >
          {sw ? 'Ingia' : 'Sign In'}
        </Link>
      </p>
    </PageShell>
  );
}

// ─── style constants ──────────────────────────────────────
const labelStyle = {
  display:'block', fontSize:11, fontWeight:700,
  color:'#6B7280', textTransform:'uppercase',
  letterSpacing:'0.08em', marginBottom:6,
};

// ─── shared sub-components ────────────────────────────────
function PageShell({ children }) {
  return (
    <div style={{
      minHeight:'100vh',
      background:'#EEE9DF',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'24px 16px',
    }}>
      <div style={{
        width:'100%', maxWidth:420,
        background:'#FDFCF9',
        borderRadius:16,
        border:'1px solid #DDD8CE',
        boxShadow:'0 2px 16px rgba(27,58,107,0.07), 0 1px 3px rgba(27,58,107,0.04)',
        padding:'36px 32px',
        position:'relative', overflow:'hidden',
        animation:'slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        <style>{`
          @keyframes slideUp {
            from { opacity:0; transform:translateY(18px); }
            to   { opacity:1; transform:translateY(0); }
          }
        `}</style>
        {children}
      </div>
    </div>
  );
}

function LogoBlock({ sw }) {
  return (
    <div style={{textAlign:'center', marginBottom:24}}>
      <img
        src="https://res.cloudinary.com/dcka18xuw/image/upload/v1775397623/luther_rb1fbu.webp"
        alt="KKKT Yombo DMP"
        style={{width:64, height:64, objectFit:'contain', marginBottom:12}}
      />
      <h1 style={{margin:'0 0 3px', fontSize:16, fontWeight:800, color:'#1B3A6B', letterSpacing:'0.01em'}}>
        KKKT Yombo DMP
      </h1>
      <p style={{margin:0, fontSize:11, color:'#9CA3AF', letterSpacing:'0.06em', textTransform:'uppercase'}}>
        {sw ? 'Mfumo wa Kanisa' : 'Church Portal'}
      </p>
    </div>
  );
}

function ErrorBanner({ msg }) {
  return (
    <div style={{
      padding:'10px 14px', borderRadius:8,
      border:'1px solid #FECACA', background:'#FEF2F2',
      color:'#991B1B', fontSize:13, lineHeight:1.5,
    }}>
      {msg}
    </div>
  );
}

function Spinner({ label }) {
  return (
    <span style={{display:'flex', alignItems:'center', gap:8}}>
      <span style={{
        width:14, height:14,
        border:'2px solid rgba(255,255,255,0.35)',
        borderTopColor:'#fff',
        borderRadius:'50%',
        display:'inline-block',
        animation:'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      {label}
    </span>
  );
}