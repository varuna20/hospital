import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { fMoney } from '../../utils/helpers';

import toast from 'react-hot-toast';

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
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="page-title">{hospital?.name || 'Hospital'} — Admin</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        <button onClick={() => {
          const url = `${window.location.origin}/book/${hospital?.slug}`;
          navigator.clipboard.writeText(url);
          toast.success('Patient booking link copied!');
        }} className="btn-ghost text-xs px-3 font-bold border border-white/10 flex items-center gap-2">
          <span>🔗</span> Copy Patient Link
        </button>
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
      
      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => <div key={i} className="card animate-pulse h-40" />)}
        </div>
      ) : (() => {
        const todayDow = new Date().getDay();
        const comingToday = stats.filter(({ doctor: d }) => d.sessions?.some(s => s.dayOfWeek === todayDow && s.isActive));
        const notComingToday = stats.filter(({ doctor: d }) => !d.sessions?.some(s => s.dayOfWeek === todayDow && s.isActive));

        const RenderDoctor = ({ doctor: d, stats: s }) => (
          <div key={d._id} className="card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg"
                style={{ background: 'var(--color-primary)' }}>
                {d.name.replace(/^Dr\.\s+/i, '').charAt(0) || 'D'}
              </div>
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
        );

        return (
          <div className="space-y-8">
            {/* Segment 1: Coming Today */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color:'var(--color-primary)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background:'var(--color-primary)' }}></span>
                Doctors Coming Today ({comingToday.length})
              </p>
              {comingToday.length === 0 ? (
                <div className="p-8 rounded-2xl border-2 border-dashed text-center" style={{ borderColor:'var(--color-border)' }}>
                  <p className="text-sm italic" style={{ color:'var(--color-text-muted)' }}>No doctors scheduled for today.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {comingToday.map(RenderDoctor)}
                </div>
              )}
            </div>

            {/* Segment 2: Not Coming Today */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color:'var(--color-text-muted)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background:'var(--color-text-muted)' }}></span>
                Not Scheduled Today ({notComingToday.length})
              </p>
              {notComingToday.length === 0 ? (
                <div className="p-8 rounded-2xl border-2 border-dashed text-center" style={{ borderColor:'var(--color-border)' }}>
                  <p className="text-sm italic" style={{ color:'var(--color-text-muted)' }}>All doctors are scheduled for today.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-75 grayscale-[0.5]">
                  {notComingToday.map(RenderDoctor)}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
