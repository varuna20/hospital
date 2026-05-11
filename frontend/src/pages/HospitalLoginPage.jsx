/**
 * HOSPITAL LOGIN PAGE
 * ====================
 * Dedicated login for a specific hospital via URL slug.
 * URL: /login/city-medical-center
 * - Loads hospital branding automatically
 * - Only shows login for that hospital (no hospital selector)
 * - Super admin login still works here
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import ChevFooter from '../components/ChevFooter.jsx';

export default function HospitalLoginPage() {
  const { slug } = useParams();
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!user) return;
    const map = { superadmin: '/super', admin: '/admin', staff: '/staff', doctor: '/doctor' };
    navigate(map[user.role] || '/', { replace: true });
  }, [user, navigate]);

  // Load hospital by slug
  useEffect(() => {
    if (!slug) return;
    api.get('/auth/hospital/' + slug)
      .then(({ data }) => {
        if (data.success) {
          setHospital(data.hospital);
          // Apply theme
          if (data.hospital.theme) {
            const t = data.hospital.theme;
            const r = document.documentElement;
            if (t.primary)    r.style.setProperty('--color-primary', t.primary);
            if (t.background) r.style.setProperty('--color-bg', t.background);
            if (t.surface)    r.style.setProperty('--color-surface', t.surface);
            if (t.primary) {
              const hex = t.primary.replace('#','');
              const rgb = [0,2,4].map(i => parseInt(hex.slice(i,i+2),16));
              r.style.setProperty('--color-primary-rgb', rgb.join(','));
            }
          }
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Enter email and password'); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/login', {
        email: form.email,
        password: form.password,
        hospitalId: hospital?._id,
        hospitalSlug: slug,  // tenant isolation check on server
      });
      if (!data.success) { toast.error(data.message || 'Login failed'); return; }
      login(data.token, data.user);
      const map = { superadmin: '/super', admin: '/admin', staff: '/staff', doctor: '/doctor' };
      navigate(map[data.user.role] || '/', { replace: true });
      toast.success(`Welcome, ${data.user.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const primary = hospital?.theme?.primary || '#00d4aa';
  const bg      = hospital?.theme?.background || '#02040a';

  if (loading) return (
    <div style={{ minHeight:'100vh', background:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:36, height:36, border:`3px solid ${primary}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight:'100vh', background:bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,sans-serif' }}>
      <div style={{ fontSize:64, marginBottom:16 }}>🏥</div>
      <h2 style={{ color:'white', marginBottom:8, fontFamily:'Sora,sans-serif' }}>Hospital Not Found</h2>
      <p style={{ color:'#6b7b8f', marginBottom:24 }}>No hospital found for "<strong>{slug}</strong>"</p>
      <a href="/login" style={{ color:primary, textDecoration:'underline' }}>← Go to main login</a>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:bg, display:'flex', flexDirection:'column', fontFamily:'DM Sans,sans-serif' }}>
      {/* Background decoration */}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-20%', right:'-10%', width:600, height:600, borderRadius:'50%', background:`radial-gradient(${primary}18, transparent 70%)` }} />
        <div style={{ position:'absolute', bottom:'-20%', left:'-10%', width:500, height:500, borderRadius:'50%', background:`radial-gradient(${primary}10, transparent 70%)` }} />
      </div>

      {/* Content */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 20px', position:'relative', zIndex:1 }}>
        <div style={{ width:'100%', maxWidth:420 }}>

          {/* Hospital branding */}
          <div style={{ textAlign:'center', marginBottom:36 }}>
            {hospital?.logo ? (
              <img src={hospital.logo} alt={hospital.name} style={{ height:64, objectFit:'contain', marginBottom:16, display:'block', margin:'0 auto 16px' }} />
            ) : (
              <div style={{ width:72, height:72, borderRadius:18, background:`linear-gradient(135deg, ${primary}, ${primary}88)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, fontWeight:900, color:'#02040a', fontFamily:'Sora,sans-serif', margin:'0 auto 16px' }}>
                {(hospital?.name || '?').charAt(0)}
              </div>
            )}
            <h1 style={{ fontFamily:'Sora,sans-serif', fontWeight:800, color:'white', fontSize:26, marginBottom:4 }}>
              {hospital?.name}
            </h1>
            {hospital?.city && (
              <p style={{ color:'#6b7b8f', fontSize:14 }}>{hospital.city}</p>
            )}
          </div>

          {/* Login card */}
          <div style={{
            background:'rgba(15,18,25,0.95)',
            border:`1px solid ${primary}25`,
            borderRadius:20,
            padding:'32px 36px',
            boxShadow:`0 0 0 1px ${primary}08, 0 24px 64px rgba(0,0,0,0.6), 0 2px 8px ${primary}12`,
          }}>
            <h2 style={{ fontFamily:'Sora,sans-serif', fontWeight:700, color:'white', fontSize:18, marginBottom:6 }}>Staff Login</h2>
            <p style={{ color:'#6b7b8f', fontSize:13, marginBottom:24 }}>Sign in to manage appointments and queue</p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', color:'#6b7b8f', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Email Address</label>
                <input
                  type="email" autoComplete="email" required
                  value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  placeholder="your@email.com"
                  style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:`1px solid rgba(255,255,255,0.1)`, borderRadius:10, padding:'12px 14px', color:'white', fontSize:14, outline:'none', fontFamily:'DM Sans,sans-serif', transition:'border 0.2s' }}
                  onFocus={e => e.target.style.borderColor = primary}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              <div style={{ marginBottom:24 }}>
                <label style={{ display:'block', color:'#6b7b8f', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Password</label>
                <input
                  type="password" autoComplete="current-password" required
                  value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  placeholder="••••••••"
                  style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:`1px solid rgba(255,255,255,0.1)`, borderRadius:10, padding:'12px 14px', color:'white', fontSize:14, outline:'none', fontFamily:'DM Sans,sans-serif', transition:'border 0.2s' }}
                  onFocus={e => e.target.style.borderColor = primary}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              <button
                type="submit" disabled={submitting}
                style={{
                  width:'100%', padding:'13px', borderRadius:12, border:'none',
                  background: submitting ? '#1e2533' : `linear-gradient(135deg, ${primary}, #00a8d4)`,
                  color: submitting ? '#6b7b8f' : '#02040a',
                  fontFamily:'Sora,sans-serif', fontWeight:700, fontSize:15,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition:'all 0.2s',
                  boxShadow: submitting ? 'none' : `0 4px 20px ${primary}40`,
                }}>
                {submitting ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div style={{ textAlign:'center', marginTop:20 }}>
              <a href="/login" style={{ color:'#6b7b8f', fontSize:12, textDecoration:'none' }}
                onMouseEnter={e => e.target.style.color = primary}
                onMouseLeave={e => e.target.style.color = '#6b7b8f'}>
                ← Back to main login
              </a>
            </div>
          </div>

          {/* Chevara logo */}
          <div style={{ textAlign:'center', marginTop:24 }}>
            <img src="/chevara-logo.png" alt="Chevara Labs" style={{ height:22, objectFit:'contain', opacity:0.4 }} />
          </div>
        </div>
      </div>

      <ChevFooter />
    </div>
  );
}
