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
  if (err.response?.status === 401) { localStorage.clear(); window.location.href = '/login'; }
  return Promise.reject(err);
});
export default api;
