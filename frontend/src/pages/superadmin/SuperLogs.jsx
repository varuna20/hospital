import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { fDate, fTime } from '../../utils/helpers';

export default function SuperLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: '', status: '', hospitalId: '' });
  const [hospitals, setHospitals] = useState([]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/superadmin/message-logs', { params: filter });
      setLogs(data.logs || []);
    } catch (err) {
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    api.get('/superadmin/hospitals').then(res => setHospitals(res.data.hospitals || [])).catch(() => {});
  }, [filter]);

  const getStatusColor = (s) => {
    if (s === 'sent') return '#10b981';
    if (s === 'failed') return '#ef4444';
    if (s === 'skipped') return '#f59e0b';
    return 'var(--color-text-muted)';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Message Logs</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Track SMS and WhatsApp delivery status</p>
        </div>
        <button onClick={fetchLogs} className="btn-ghost text-xs">🔄 Refresh</button>
      </div>

      {/* Filters */}
      <div className="card grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="label">Message Type</label>
          <select className="input" value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
            <option value="">All Types</option>
            <option value="sms">SMS (text.lk)</option>
            <option value="whatsapp">WhatsApp (Twilio)</option>
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>
        <div>
          <label className="label">Hospital</label>
          <select className="input" value={filter.hospitalId} onChange={e => setFilter(f => ({ ...f, hospitalId: e.target.value }))}>
            <option value="">All Hospitals</option>
            {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
        </div>
      </div>

      {/* Log List */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)' }}>
                <th className="p-3 text-left">Time</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Hospital</th>
                <th className="p-3 text-left">Recipient</th>
                <th className="p-3 text-left">Message Preview</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="7" className="p-4"><div className="h-4 bg-white/5 rounded" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    No logs found matching your filters.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log._id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 whitespace-nowrap">
                      <p className="text-white font-medium">{fDate(log.createdAt)}</p>
                      <p style={{ color: 'var(--color-text-muted)' }}>{fTime(log.createdAt)}</p>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter"
                        style={{ background: log.type === 'whatsapp' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                                 color: log.type === 'whatsapp' ? '#10b981' : '#818cf8', fontSize: 9 }}>
                        {log.type}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="text-white font-medium truncate max-w-[120px]">{log.hospitalId?.shortName || log.hospitalId?.name || 'System'}</p>
                    </td>
                    <td className="p-3 font-mono" style={{ color: 'var(--color-primary)' }}>{log.recipient}</td>
                    <td className="p-3">
                      <p className="truncate max-w-[200px]" title={log.message} style={{ color: 'var(--color-text-muted)' }}>
                        {log.message}
                      </p>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: getStatusColor(log.status) }} />
                        <span className="font-bold uppercase" style={{ color: getStatusColor(log.status), fontSize: 9 }}>
                          {log.status}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      {log.error ? (
                        <p className="text-[10px] text-red-400 max-w-[150px] truncate" title={log.error}>{log.error}</p>
                      ) : (
                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{log.provider}</p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
