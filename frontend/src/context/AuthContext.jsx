import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [systemSettings, setSystemSettings] = useState(null);

  const fetchSystemSettings = async () => {
    try {
      const { data } = await api.get('/system/branding');
      if (data.success) setSystemSettings({ branding: data.branding });
    } catch (e) { console.warn('System branding fetch failed'); }
  };

  useEffect(() => {
    fetchSystemSettings();
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const saved = localStorage.getItem('user');
        
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          // Always try to fetch fresh user data if token exists
          const { data } = await api.get('/auth/me');
          if (data.success) {
            setUser(data.user);
            localStorage.setItem('user', JSON.stringify(data.user));
          } else if (saved) {
            setUser(JSON.parse(saved));
          }
        }
      } catch (e) {
        console.warn('Auth refresh failed, using saved data if available');
        const saved = localStorage.getItem('user');
        if (saved) setUser(JSON.parse(saved));
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = (token, userData) => {
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userData);
    } catch (e) {
      console.error('Login error:', e);
    }
  };

  const logout = () => {
    try { localStorage.clear(); } catch {}
    try { delete api.defaults.headers.common['Authorization']; } catch {}
    setUser(null);
    window.location.href = '/login';
  };

  useEffect(() => {
    if (!user || user.role === 'patient') return;

    // Admin/Superadmin: 5 mins, Others (Staff/Doctor): 6 hours
    const timeoutMs = (user.role === 'admin' || user.role === 'superadmin') 
      ? 5 * 60 * 1000 
      : 6 * 60 * 60 * 1000;

    let timeoutId;
    let lastActivity = Date.now();

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
      }, timeoutMs);
    };

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivity > 1000) { // Throttle
        lastActivity = now;
        resetTimer();
      }
    };

    resetTimer();
    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, handleActivity));

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  }, [user]);

  const updateHospital = (newHospitalData) => {
    if (!user) return;
    const updatedUser = { ...user, hospital: newHospitalData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const hospital = user?.hospitalId || user?.hospital || null;

  return (
    <AuthContext.Provider value={{ user, hospital, login, logout, updateHospital, systemSettings, fetchSystemSettings, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
