import axios from 'axios';
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

export const fUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  // If it starts with /uploads, prepend the base domain (without /api)
  return `${base}${url}`;
};

export { base };
export default api;
