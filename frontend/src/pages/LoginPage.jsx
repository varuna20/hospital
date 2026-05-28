import ChevFooter from '../components/ChevFooter.jsx';
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { fUrl } from '../utils/api';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
  const [searchParams] = window.location.search ? [new URLSearchParams(window.location.search)] : [new URLSearchParams()];
  const defaultTab = searchParams.get('tab') === 'patient' ? 'patient' : 'staff';

  const [hospitals,   setHospitals]   = useState([]);
  const [selectedH,   setSelectedH]   = useState(null);
  const [email,       setEmail]        = useState('');
  const [password,    setPassword]     = useState('');
  const [loading,     setLoading]      = useState(false);
  const [isSuperMode, setIsSuperMode]  = useState(false);
  const [tab,         setTab]          = useState(defaultTab); // 'patient' | 'staff' | 'super'
  const [phone,       setPhone]        = useState('');
  const [otpSent,     setOtpSent]      = useState(false);
  const [otpCode,     setOtpCode]      = useState('');
  const [submitting,  setSubmitting]   = useState(false);
  const { login, user, systemSettings } = useAuth();
  const navigate                      = useNavigate();
  const branding                      = systemSettings?.branding || {};

  // Redirect if already logged in
  useEffect(() => {
    if (user) { const m={superadmin:'/super',admin:'/admin',staff:'/staff',doctor:'/doctor',patient:'/patient-dashboard'}; navigate(m[user.role]||'/'); }
  }, [user, navigate]);

  // Load hospital list
  useEffect(() => {
    api.get('/hospitals').then(({ data }) => setHospitals(data.hospitals || [])).catch(() => {});
  }, []);

  // Apply selected hospital's theme to login page
  useEffect(() => {
    if (!selectedH?.theme) return;
    const r = document.documentElement;
    r.style.setProperty('--color-primary',    selectedH.theme.primary || '#0d9488');
    r.style.setProperty('--color-accent',     selectedH.theme.accent  || '#f59e0b');
    r.style.setProperty('--color-primary-rgb', hexToRgb(selectedH.theme.primary || '#0d9488'));
  }, [selectedH]);

  function hexToRgb(hex) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  }

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setSubmitting(true);
      const { data } = await api.post('/auth/patient/google', {
        token: credentialResponse.credential,
        hospitalId: selectedH?._id,
      });
      if (data.success) {
        login(data.token, { ...data.patient, role: 'patient' });
        navigate('/patient-dashboard', { replace: true });
        toast.success(`Welcome, ${data.patient.name}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Google login failed');
    } finally { setSubmitting(false); }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone) return toast.error('Enter mobile number');
    setSubmitting(true);
    try {
      await api.post('/auth/patient/request-otp', { phone, hospitalId: selectedH?._id });
      setOtpSent(true);
      toast.success('Verification code sent via SMS');
    } catch (err) { toast.error('Failed to send code'); } 
    finally { setSubmitting(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode) return toast.error('Enter 4-digit code');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/patient/verify-otp', { phone, hospitalId: selectedH?._id, otpCode });
      if (data.success) {
        login(data.token, data.user || data.patient);
        navigate('/patient-dashboard', { replace: true });
        toast.success(`Welcome back`);
      }
    } catch (err) { toast.error('Invalid verification code'); } 
    finally { setSubmitting(false); }
  };

  const handleLogin = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { email, password };
      if (tab !== 'super' && selectedH) payload.hospitalSlug = selectedH.slug;

      const { data } = await api.post('/auth/login', payload);
      if (data.success) {
        login(data.token, data.user);
        toast.success(`Welcome, ${data.user.name}!`);
        const map = { superadmin:'/super', admin:'/admin', staff:'/staff', doctor:'/doctor' };
        navigate(map[data.user.role] || '/');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  const theme = selectedH?.theme || { primary:'#0d9488' };

  return (
    <div className="min-h-screen flex flex-col" style={{ background:'var(--color-bg)' }}>
      <div className="flex flex-1">

      {/* Left panel - hospital branding / list */}
      <div className="hidden lg:flex lg:w-2/5 flex-col items-center justify-center p-10 relative overflow-hidden"
        style={{ background:`linear-gradient(135deg, ${theme.primary}22, ${theme.primary}08)`,
                 borderRight:`1px solid ${theme.primary}22` }}>

        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[0,1,2].map(i => (
            <div key={i} className="absolute rounded-full opacity-10"
              style={{ width:`${200+i*120}px`, height:`${200+i*120}px`,
                border:`1px solid ${theme.primary}`,
                top:'50%', left:'50%', transform:'translate(-50%,-50%)' }} />
          ))}
        </div>

        <div className="relative z-10 text-center mb-8">
          {selectedH?.logo ? (
            <img src={fUrl(selectedH.logo)} alt="Hospital Logo" className="w-24 h-24 object-contain mx-auto mb-4 rounded-2xl" />
          ) : (
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-bold text-white"
              style={{ background: theme.primary }}>
              {selectedH ? selectedH.name.charAt(0) : '🏥'}
            </div>
          )}
          <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily:'Sora,sans-serif' }}>
            {selectedH ? selectedH.name : 'Hospital eChanneling'}
          </h1>
          {selectedH && <p className="text-sm" style={{ color:theme.primary }}>{selectedH.city}</p>}
        </div>

        {/* Hospital selector cards */}
        {!isSuperMode && (
          <div className="w-full space-y-2 max-h-80 overflow-y-auto">
            {hospitals.map(h => (
              <button key={h._id} onClick={() => setSelectedH(h)}
                className="w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-3"
                style={{
                  background: selectedH?._id === h._id ? `${h.theme?.primary}22` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedH?._id === h._id ? h.theme?.primary : 'transparent'}`,
                }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ background: h.theme?.primary || '#0d9488' }}>
                  {h.name.charAt(0)}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{h.name}</p>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{h.city}</p>
                </div>
                {selectedH?._id === h._id && (
                  <div className="ml-auto text-xs px-2 py-0.5 rounded-full text-white" style={{ background: h.theme?.primary }}>
                    Selected
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">

          {/* Mode toggle */}
          <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-xl">
            <button onClick={() => { setIsSuperMode(false); setTab('patient'); }}
              className={`flex-1 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${tab === 'patient' ? 'text-black' : 'text-gray-400 hover:text-white'}`}
              style={tab === 'patient' ? { background: theme.primary } : {}}>
              Patient
            </button>
            <button onClick={() => { setIsSuperMode(false); setTab('staff'); }}
              className={`flex-1 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${tab === 'staff' ? 'text-black' : 'text-gray-400 hover:text-white'}`}
              style={tab === 'staff' ? { background: theme.primary } : {}}>
              Staff
            </button>
            <button onClick={() => { setIsSuperMode(true); setTab('super'); }}
              className={`flex-1 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${tab === 'super' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
              style={tab === 'super' ? {} : {}}>
              Super Admin
            </button>
          </div>

          {/* Mobile: hospital selector */}
          {tab !== 'super' && (
            <div className="lg:hidden mb-4">
              <label className="label">Select Hospital</label>
              <select className="input" value={selectedH?._id || ''} onChange={e => setSelectedH(hospitals.find(h => h._id === e.target.value) || null)}>
                <option value="">-- Select Hospital --</option>
                {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
              </select>
            </div>
          )}

          {/* Chevara logo above card */}
          <div className="flex justify-center mb-5">
            <img src={branding.logo ? fUrl(branding.logo) : '/chevara-brand.png'} alt={branding.brandName || 'Chevara Labs'} style={{ height:36, objectFit:'contain', opacity:0.8 }} />
          </div>

          <div className="card" style={{ borderColor: `${theme.primary}33` }}>
            <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily:'Sora,sans-serif' }}>
              {tab === 'super' ? '🔐 Super Admin Access' : tab === 'patient' ? 'Patient Portal' : 'Staff Sign In'}
            </h2>
            <p className="text-sm mb-6" style={{ color:'var(--color-text-muted)' }}>
              {tab === 'super' ? 'Global system management' : selectedH ? `Logging in to ${selectedH.name}` : 'Select your hospital to continue'}
            </p>

            {tab === 'patient' ? (
              !selectedH ? (
                 <div className="text-center py-6 text-white/50 text-sm border border-white/10 border-dashed rounded-xl">
                   Please select a hospital from the list to access your patient portal.
                 </div>
              ) : (
                <div>
                  <div style={{ marginBottom:20, display:'flex', justifyContent:'center' }}>
                    <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => toast.error('Google popup failed or was closed')} useOneTap />
                  </div>
                  
                  <div style={{ display:'flex', alignItems:'center', margin:'20px 0' }}>
                    <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }} />
                    <span style={{ padding:'0 10px', fontSize:11, color:'#6b7b8f', textTransform:'uppercase', fontWeight:'bold' }}>OR</span>
                    <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.1)' }} />
                  </div>

                  {!otpSent ? (
                    <form onSubmit={handleSendOtp}>
                      <div style={{ marginBottom:16 }}>
                        <label style={{ display:'block', color:'#6b7b8f', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Mobile Number</label>
                        <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+94 77..." className="input" />
                      </div>
                      <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl font-semibold text-black transition-all" style={{ background: theme.primary }}>
                        {submitting ? 'Sending...' : 'Send Verification Code'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp}>
                      <div style={{ marginBottom:16 }}>
                        <label style={{ display:'block', color:'#6b7b8f', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Verification Code</label>
                        <input type="text" required maxLength={4} value={otpCode} onChange={e => setOtpCode(e.target.value)} placeholder="----" className="input" style={{ textAlign:'center', letterSpacing:'8px', fontSize:20, fontWeight:900 }} />
                      </div>
                      <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl font-semibold text-black transition-all" style={{ background: theme.primary }}>
                        {submitting ? 'Verifying...' : 'Sign In'}
                      </button>
                      <button type="button" onClick={() => setOtpSent(false)} className="w-full mt-3 text-xs text-white/50 hover:text-white">Change mobile number</button>
                    </form>
                  )}
                </div>
              )
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required autoFocus />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <button type="submit" disabled={loading || (tab === 'staff' && !selectedH)}
                  className="w-full py-3 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
                  style={{ background: loading ? 'var(--color-surface2)' : (tab === 'super' ? '#7c3aed' : theme.primary) }}>
                  {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Signing in...</> : 'Sign In →'}
                </button>
              </form>
            )}

            {/* Demo hints */}
            <div className="mt-5 pt-4 border-t" style={{ borderColor:'var(--color-border)' }}>
              <p className="text-xs mb-2" style={{ color:'var(--color-text-muted)' }}>Demo credentials:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label:'Super Admin', e:'superadmin@echanneling.com', p:'SuperAdmin@123', super:true },
                  { label:'City Admin',  e:'admin@citymedical.lk',       p:'Admin@123' },
                  { label:'City Staff',  e:'staff@citymedical.lk',       p:'Staff@123' },
                  { label:'City Doctor', e:'amara@citymedical.lk',       p:'Doctor@123' },
                ].map(d => (
                  <button key={d.e} type="button" onClick={() => { setEmail(d.e); setPassword(d.p); if(d.super) { setIsSuperMode(true); setTab('super'); } else { setIsSuperMode(false); setTab('staff'); } }}
                    className="text-xs py-1.5 px-2 rounded-lg text-left transition-all hover:opacity-80"
                    style={{ background:'var(--color-surface2)', color:'var(--color-text-muted)' }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
      <ChevFooter />
    </div>
  );
}
