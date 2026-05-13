import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { fMoney } from '../../utils/helpers';

export default function AdminDashboard() {
  const { hospital } = useAuth();
  const [stats,   setStats]   = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/staff/dashboard'), api.get('/revenue/summary?period=day')])
      .then(([d, r]) => { setStats(d.data.doctorStats || []); setRevenue(r.data.revenue); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totals = stats.reduce((a, d) => ({
    total: a.total + d.stats.total, waiting: a.waiting + d.stats.waiting,
    completed: a.completed + d.stats.completed, absent: a.absent + d.stats.absent,
  }), { total: 0, waiting: 0, completed: 0, absent: 0 });

  const sym = hospital?.payment?.currencySymbol || 'Rs.';

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">{hospital?.name || 'Hospital'} — Admin</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Today counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[{ l: "Today's Bookings", v: totals.total, c: 'var(--color-text)', i: '📅' },
          { l: 'Waiting Now', v: totals.waiting, c: 'var(--color-warning)', i: '⏳' },
          { l: 'Completed', v: totals.completed, c: 'var(--color-success)', i: '✅' },
          { l: 'Absent', v: totals.absent, c: 'var(--color-danger)', i: '❌' }
        ].map(({ l, v, c, i }) => (
          <div key={l} className="stat-card">
            <span className="text-2xl">{i}</span>
            <p className="stat-value" style={{ color: c }}>{loading ? '—' : v}</p>
            <p className="stat-label">{l}</p>
          </div>
        ))}
      </div>

      {/* Revenue today */}
      {revenue && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          {[{ l: "Hospital Revenue (Today)", v: revenue.paid?.hospitalRevenue, c: 'var(--color-primary)' },
            { l: "Doctor Revenue (Today)", v: revenue.paid?.doctorRevenue, c: '#6366f1' },
            { l: 'Pending Collection', v: revenue.pending?.pendingAmount, c: 'var(--color-warning)' }
          ].map(({ l, v, c }) => (
            <div key={l} className="card" style={{ borderLeft: '3px solid ' + c }}>
              <p className="stat-value" style={{ color: c }}>{fMoney(v, sym)}</p>
              <p className="stat-label">{l}</p>
              <Link to="/admin/revenue" className="text-xs mt-1 block" style={{ color: 'var(--color-primary)' }}>Full report →</Link>
            </div>
          ))}
        </div>
      )}

      {/* Doctor grid */}
      <h2 className="section-title mb-3">Doctor Status Today</h2>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="card animate-pulse h-40" />) :
          stats.map(({ doctor: d, stats: s }) => (
            <div key={d._id} className="card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
                  style={{ background: 'var(--color-primary)' }}>{d.name.charAt(4) || 'D'}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{d.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-primary)' }}>{d.specialization} · {d.room}</p>
                </div>
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: d.todayStatus?.isArrived ? '#10b981' : '#f59e0b' }} />
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[['Total', s.total, 'var(--color-text)'], ['Wait', s.waiting, 'var(--color-warning)'],
                  ['Done', s.completed, 'var(--color-success)'], ['Abs', s.absent, 'var(--color-danger)']].map(([l, v, c]) => (
                  <div key={l} className="text-center py-2 rounded-lg" style={{ background: 'var(--color-surface2)' }}>
                    <p className="font-bold text-sm" style={{ color: c }}>{v}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Link to={`/admin/doctors`} className="btn-ghost text-xs flex-1 text-center">Manage →</Link>
                <Link to={`/staff/queue?doctor=${d._id}`} className="text-xs px-3 py-1.5 rounded-xl"
                  style={{ background: 'rgba(var(--color-primary-rgb),0.15)', color: 'var(--color-primary)' }}>
                  Queue
                </Link>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
