import axios from 'axios';

// VITE_API_URL should be set to the full backend URL e.g. https://hospital-api.onrender.com/api
// In dev, leave it blank — Vite proxy handles /api and /uploads automatically
const base = import.meta.env.VITE_API_URL || '';
const baseURL = base ? (base.endsWith('/api') ? base : `${base}/api`) : '/api';

const api = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  const isPublic = err.config?.url?.includes('/system/branding') || err.config?.url?.includes('/hospitals');
  if (err.response?.status === 401 && !isPublic) { 
    localStorage.clear(); 
    if (window.location.pathname !== '/login') window.location.href = '/login'; 
  }
  return Promise.reject(err);
});

/**
 * fUrl — resolves a relative upload path to an absolute URL.
 *
 * Examples:
 *   fUrl('/uploads/logos/logo.png')  => 'https://api.hospital.com/uploads/logos/logo.png'
 *   fUrl('https://...')               => 'https://...' (unchanged)
 *   fUrl(null)                        => '' (safe)
 *
 * In development (no VITE_API_URL), returns the path as-is so Vite proxy handles it.
 * In production, prepends the backend origin from VITE_API_URL.
 */
export const fUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;

  // Derive the backend origin (strip trailing /api if present)
  let backendOrigin = '';
  if (base) {
    backendOrigin = base.endsWith('/api') ? base.slice(0, -4) : base;
    // Remove trailing slash
    backendOrigin = backendOrigin.replace(/\/$/, '');
  }

  // Ensure path starts with /
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${backendOrigin}${path}`;
};

export { base };
export default api;
