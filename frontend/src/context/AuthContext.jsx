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
    try {
      const token = localStorage.getItem('token');
      const saved = localStorage.getItem('user');
      if (token && saved) {
        const u = JSON.parse(saved);
        setUser(u);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      // Corrupted storage - clear it
      localStorage.clear();
    } finally {
      setLoading(false);
    }
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

  const updateHospital = (newHospitalData) => {
    if (!user) return;
    const updatedUser = { ...user, hospital: newHospitalData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const hospital = user?.hospital || null;

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
