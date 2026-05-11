import ChevFooter from '../components/ChevFooter.jsx';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [hospitals,   setHospitals]   = useState([]);
  const [selectedH,   setSelectedH]   = useState(null);
  const [email,       setEmail]        = useState('');
  const [password,    setPassword]     = useState('');
  const [loading,     setLoading]      = useState(false);
  const [isSuperMode, setIsSuperMode]  = useState(false);
  const { login, user }               = useAuth();
  const navigate                      = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) { const m={superadmin:'/super',admin:'/admin',staff:'/staff',doctor:'/doctor'}; navigate(m[user.role]||'/'); }
  }, [user]);

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

  const handleLogin = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { email, password };
      if (!isSuperMode && selectedH) payload.hospitalSlug = selectedH.slug;

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
            <img src={selectedH.logo} alt="Hospital Logo" className="w-24 h-24 object-contain mx-auto mb-4 rounded-2xl" />
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
          <div className="flex gap-2 mb-6">
            <button onClick={() => setIsSuperMode(false)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${!isSuperMode ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              style={!isSuperMode ? { background: theme.primary } : { background: 'var(--color-surface)' }}>
              Hospital Login
            </button>
            <button onClick={() => setIsSuperMode(true)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${isSuperMode ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              style={!isSuperMode ? { background: 'var(--color-surface)' } : {}}>
              Super Admin
            </button>
          </div>

          {/* Mobile: hospital selector */}
          {!isSuperMode && (
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
            <img src="/chevara-logo.png" alt="Chevara Labs" style={{ height:36, objectFit:'contain', opacity:0.8 }} />
          </div>

          <div className="card" style={{ borderColor: `${theme.primary}33` }}>
            <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily:'Sora,sans-serif' }}>
              {isSuperMode ? '🔐 Super Admin Access' : 'Sign In'}
            </h2>
            <p className="text-sm mb-6" style={{ color:'var(--color-text-muted)' }}>
              {isSuperMode ? 'Global system management' : selectedH ? `Logging in to ${selectedH.name}` : 'Select your hospital to continue'}
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required autoFocus />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <button type="submit" disabled={loading || (!isSuperMode && !selectedH)}
                className="w-full py-3 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center gap-2"
                style={{ background: loading ? 'var(--color-surface2)' : (isSuperMode ? '#7c3aed' : theme.primary) }}>
                {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Signing in...</> : 'Sign In →'}
              </button>
            </form>

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
                  <button key={d.e} onClick={() => { setEmail(d.e); setPassword(d.p); if(d.super) setIsSuperMode(true); }}
                    className="text-xs py-1.5 px-2 rounded-lg text-left transition-all hover:opacity-80"
                    style={{ background:'var(--color-surface2)', color:'var(--color-text-muted)' }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center mt-4 text-sm" style={{ color:'var(--color-text-muted)' }}>
            Patient?{' '}
            <a href="/" className="font-medium" style={{ color:'var(--color-primary)' }}>Book appointment →</a>
          </p>
        </div>
      </div>
      </div>
      <ChevFooter />
    </div>
  );
}
