'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { setAuth, clearAuth } from '../../../lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const WS  = process.env.NEXT_PUBLIC_WS_URL  || 'http://localhost:4000';

const STATUS = { WAITING: 'waiting', APPROVED: 'approved', REJECTED: 'rejected' };

export default function PendingPage() {
  const { lang, user } = useAuth();
  const sw     = lang === 'sw';
  const router = useRouter();

  const [status, setStatus] = useState(STATUS.WAITING);
  const [reason, setReason] = useState('');
  const [dots,   setDots]   = useState('');
  const socketRef = useRef(null);

  // ── animated waiting dots ─────────────────────────────
  useEffect(() => {
    if (status !== STATUS.WAITING) return;
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 600);
    return () => clearInterval(t);
  }, [status]);

  // ── socket: register + listen for notification ────────
  useEffect(() => {
    if (!user?.id) return;

    import('socket.io-client').then(({ io }) => {
      const socket = io(WS, { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('🔌 Socket connected:', socket.id);
        // Use the same 'loginUser' event as the rest of the codebase
        socket.emit('loginUser', { userId: String(user.id) });
      });

      // ── account status notifications ──────────────────
      socket.on('notification', (data) => {
        console.log('📨 Notification:', data);

        if (data.type === 'account_approved') {
          setStatus(STATUS.APPROVED);
          // Refresh stored user so is_active = 1
          const token = localStorage.getItem('church_token');
          fetch(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then(r => r.json())
            .then(({ user: freshUser }) => { if (freshUser) setAuth(token, freshUser); })
            .catch(() => {});
        }

        if (data.type === 'account_rejected') {
          setStatus(STATUS.REJECTED);
          setReason(data.reason || '');
        }
      });

      socket.on('disconnect', () => console.log('🔌 Socket disconnected'));

      return () => socket.disconnect();
    });
  }, [user?.id]);

  const handleEnter = () => router.replace('/dashboard');

  const handleLogout = () => {
    socketRef.current?.disconnect();
    clearAuth();
    router.replace('/auth/login');
  };

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
  // APPROVED
  // ─────────────────────────────────────────────────────
  if (status === STATUS.APPROVED) {
    return (
      <PageShell>
        <CrossWatermark />
        <LogoBlock sw={sw} />
        <div style={{textAlign:'center', marginBottom:24}}>
          <div style={{
            width:80, height:80, borderRadius:'50%',
            background:'#F0FDF4', border:'2px solid #BBF7D0',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            fontSize:36, marginBottom:16,
            animation:'popIn 0.4s cubic-bezier(0.16,1,0.3,1) both',
          }}>✅</div>
          <h2 style={{margin:'0 0 8px', fontSize:20, fontWeight:700, color:'#166534'}}>
            {sw ? 'Umeidhinishwa!' : "You're Approved!"}
          </h2>
          <p style={{margin:0, fontSize:14, color:'#4B5563', lineHeight:1.6}}>
            {sw
              ? 'Akaunti yako imekubaliwa. Karibu kwenye mfumo wa kanisa!'
              : 'Your account has been approved. Welcome to the church portal!'}
          </p>
        </div>

        <div style={{
          background:'#F0FDF4', border:'1px solid #BBF7D0',
          borderRadius:10, padding:'14px 18px', marginBottom:24, textAlign:'center',
        }}>
          <p style={{margin:0, fontSize:13, color:'#166534', fontWeight:600}}>
            {sw ? '🙏 Mungu akubariki katika huduma yako.' : '🙏 God bless you in your service.'}
          </p>
        </div>

        <button onClick={handleEnter} style={primaryBtnStyle}
          onMouseEnter={e => e.currentTarget.style.background='#234d8e'}
          onMouseLeave={e => e.currentTarget.style.background='#1B3A6B'}>
          {sw ? 'Ingia Dashibodi →' : 'Go to Dashboard →'}
        </button>

        <style>{`@keyframes popIn { from{opacity:0;transform:scale(0.7)} to{opacity:1;transform:scale(1)} }`}</style>
      </PageShell>
    );
  }

  // ─────────────────────────────────────────────────────
  // REJECTED
  // ─────────────────────────────────────────────────────
  if (status === STATUS.REJECTED) {
    return (
      <PageShell>
        <CrossWatermark />
        <LogoBlock sw={sw} />
        <div style={{textAlign:'center', marginBottom:24}}>
          <div style={{
            width:80, height:80, borderRadius:'50%',
            background:'#FEF2F2', border:'2px solid #FECACA',
            display:'inline-flex', alignItems:'center', justifyContent:'center',
            fontSize:36, marginBottom:16,
          }}>❌</div>
          <h2 style={{margin:'0 0 8px', fontSize:20, fontWeight:700, color:'#991B1B'}}>
            {sw ? 'Ombi Halijakubaliwa' : 'Application Not Approved'}
          </h2>
          <p style={{margin:0, fontSize:14, color:'#4B5563', lineHeight:1.6}}>
            {sw
              ? 'Ombi lako halikukubaliwa kwa sasa. Wasiliana na kanisa kwa maelezo zaidi.'
              : 'Your application was not approved at this time. Please contact the church.'}
          </p>
        </div>

        {reason && (
          <div style={{
            background:'#FEF2F2', border:'1px solid #FECACA',
            borderRadius:10, padding:'14px 18px', marginBottom:16,
          }}>
            <p style={{margin:'0 0 4px', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em'}}>
              {sw ? 'Sababu' : 'Reason'}
            </p>
            <p style={{margin:0, fontSize:13, color:'#991B1B'}}>{reason}</p>
          </div>
        )}

        <div style={{
          background:'#F5F0E8', border:'1px solid #E8DFC8',
          borderRadius:10, padding:'14px 18px', marginBottom:24,
        }}>
          <p style={{margin:0, fontSize:13, color:'#374151', lineHeight:1.6}}>
            {sw ? '📞 Wasiliana: ' : '📞 Contact: '}
            <a href={`mailto:${process.env.NEXT_PUBLIC_CHURCH_EMAIL || 'info@kkkt.co.tz'}`}
              style={{color:'#1B3A6B', fontWeight:600}}>
              {process.env.NEXT_PUBLIC_CHURCH_EMAIL || 'info@kkkt.co.tz'}
            </a>
          </p>
        </div>

        <button onClick={handleLogout} style={ghostBtnStyle}
          onMouseEnter={e => e.currentTarget.style.background='#F0EBE0'}
          onMouseLeave={e => e.currentTarget.style.background='none'}>
          ← {sw ? 'Rudi Ukurasa wa Kuingia' : 'Back to Login'}
        </button>
      </PageShell>
    );
  }

  // ─────────────────────────────────────────────────────
  // WAITING (default)
  // ─────────────────────────────────────────────────────
  return (
    <PageShell>
      <CrossWatermark />
      <LogoBlock sw={sw} />

      <div style={{textAlign:'center', marginBottom:24}}>
        <div style={{
          width:80, height:80, borderRadius:'50%',
          background:'#EAF0F8', border:'2px solid #C5D5EA',
          display:'inline-flex', alignItems:'center', justifyContent:'center',
          fontSize:36, marginBottom:16,
          animation:'pulse 2s ease-in-out infinite',
        }}>🕐</div>
        <h2 style={{margin:'0 0 8px', fontSize:20, fontWeight:700, color:'#1B3A6B'}}>
          {sw ? `Inasubiri Idhini${dots}` : `Awaiting Approval${dots}`}
        </h2>
        <p style={{margin:0, fontSize:14, color:'#4B5563', lineHeight:1.6, maxWidth:300, marginInline:'auto'}}>
          {sw
            ? 'Maombi yako yamepokewa. Kiongozi wa kanisa atakagua hivi karibuni.'
            : 'Your application has been received. A church leader will review it shortly.'}
        </p>
      </div>

      {/* Registered details */}
      {user && (
        <div style={{
          background:'#EAF0F8', border:'1px solid #C5D5EA',
          borderRadius:10, padding:'14px 18px', marginBottom:16,
        }}>
          <p style={{margin:'0 0 10px', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em'}}>
            {sw ? 'Taarifa Zako' : 'Your Details'}
          </p>
          {[
            [sw ? 'Jina' : 'Name',  user.full_name],
            ['Email',               user.email],
            ...(user.phone             ? [[sw ? 'Simu' : 'Phone', user.phone]] : []),
            ...(user.namba_ya_usharika ? [[sw ? 'Namba' : 'Member No.', user.namba_ya_usharika]] : []),
          ].map(([label, value]) => (
            <div key={label} style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
              <span style={{fontSize:12, color:'#6B7280'}}>{label}</span>
              <span style={{fontSize:12, fontWeight:600, color:'#1B3A6B'}}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* What happens next */}
      <div style={{
        background:'#F5F0E8', border:'1px solid #E8DFC8',
        borderRadius:10, padding:'16px 18px', marginBottom:16,
      }}>
        <p style={{margin:'0 0 10px', fontSize:11, fontWeight:700, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.06em'}}>
          {sw ? 'Hatua Zinazofuata' : 'What Happens Next'}
        </p>
        {[
          sw ? '✉️  Utapata barua pepe ya uthibitisho'   : "✉️  You'll receive a confirmation email",
          sw ? '👤  Kiongozi ataangalia maombi yako'     : '👤  A leader will review your application',
          sw ? '🔔  Ukurasa huu utasasishwa moja kwa moja' : '🔔  This page updates automatically in real-time',
        ].map((step, i) => (
          <p key={i} style={{margin: i < 2 ? '0 0 6px' : '0', fontSize:13, color:'#374151'}}>{step}</p>
        ))}
      </div>

      {/* Live indicator */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:20}}>
        <span style={{
          width:8, height:8, borderRadius:'50%', background:'#1B3A6B',
          display:'inline-block', animation:'blink 1.4s ease-in-out infinite',
        }} />
        <span style={{fontSize:12, color:'#6B7280'}}>
          {sw ? 'Inaangalia mabadiliko kwa wakati halisi' : 'Listening for real-time updates'}
        </span>
      </div>

      <button onClick={handleLogout} style={ghostBtnStyle}
        onMouseEnter={e => e.currentTarget.style.background='#F0EBE0'}
        onMouseLeave={e => e.currentTarget.style.background='none'}>
        {sw ? 'Toka / Badilisha Akaunti' : 'Sign Out / Switch Account'}
      </button>

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.05);opacity:.85} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
      `}</style>
    </PageShell>
  );
}

// ─── style constants ──────────────────────────────────────
const primaryBtnStyle = {
  width:'100%', padding:'12px', borderRadius:8,
  background:'#1B3A6B', color:'#fff',
  fontSize:14, fontWeight:700, border:'none', cursor:'pointer',
  transition:'background 0.12s', display:'block',
};
const ghostBtnStyle = {
  width:'100%', padding:'11px', borderRadius:8,
  background:'none', border:'1px solid #DDD8CE',
  color:'#6B7280', fontSize:13, fontWeight:600,
  cursor:'pointer', transition:'background 0.1s',
};

// ─── shared sub-components ────────────────────────────────
function PageShell({ children }) {
  return (
    <div style={{
      minHeight:'100vh', background:'#EEE9DF',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'24px 16px',
    }}>
      <div style={{
        width:'100%', maxWidth:420,
        background:'#FDFCF9', borderRadius:16,
        border:'1px solid #DDD8CE',
        boxShadow:'0 2px 16px rgba(27,58,107,0.07), 0 1px 3px rgba(27,58,107,0.04)',
        padding:'36px 32px',
        position:'relative', overflow:'hidden',
        animation:'slideUp 0.35s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}`}</style>
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
        style={{width:60, height:60, objectFit:'contain', marginBottom:10}}
      />
      <h1 style={{margin:'0 0 3px', fontSize:15, fontWeight:800, color:'#1B3A6B'}}>KKKT Yombo DMP</h1>
      <p style={{margin:0, fontSize:11, color:'#9CA3AF', letterSpacing:'0.06em', textTransform:'uppercase'}}>
        {sw ? 'Mfumo wa Kanisa' : 'Church Portal'}
      </p>
    </div>
  );
}