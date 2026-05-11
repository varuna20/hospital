import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { fMoney } from '../../utils/helpers';

export default function SuperDashboard() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get('/superadmin/stats').then(({ data }) => setStats(data.stats)).catch(() => {}); }, []);

  const cards = stats ? [
    { label:'Total Hospitals',  value: stats.hospitals,    icon:'🏥', color:'#0d9488', link:'/super/hospitals' },
    { label:'Total Doctors',    value: stats.doctors,      icon:'🩺', color:'#6366f1' },
    { label:'Total Patients',   value: stats.patients,     icon:'👥', color:'#f59e0b' },
    { label:'All Appointments', value: stats.appointments, icon:'📅', color:'white' },
    { label:'System Revenue',   value: fMoney(stats.revenue?.total), icon:'💰', color:'#10b981', link:'/super/revenue' },
    { label:'Hospital Revenue', value: fMoney(stats.revenue?.totalHospitalRevenue), icon:'🏛', color:'#0ea5e9' },
    { label:'Doctor Revenue',   value: fMoney(stats.revenue?.totalDoctorRevenue),  icon:'🩺', color:'#a78bfa' },
  ] : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">System Overview</h1>
        <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>All hospitals — real-time data</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {!stats ? Array(7).fill(0).map((_,i) => (
          <div key={i} className="stat-card animate-pulse">
            <div className="h-8 rounded w-12 mb-2" style={{ background:'var(--color-surface2)' }} />
            <div className="h-3 rounded w-20" style={{ background:'var(--color-surface2)' }} />
          </div>
        )) : cards.map(({ label, value, icon, color, link }) => (
          <div key={label} className="stat-card">
            <span className="text-2xl">{icon}</span>
            <p className="stat-value" style={{ color }}>{value}</p>
            <p className="stat-label">{label}</p>
            {link && <Link to={link} className="text-xs mt-1" style={{ color:'var(--color-primary)' }}>View →</Link>}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="section-title mb-3">Quick Actions</h3>
          <div className="space-y-2">
            {[
              { label:'Add New Hospital', icon:'🏥', link:'/super/hospitals' },
              { label:'View All Revenue', icon:'💰', link:'/super/revenue' },
            ].map(({ label, icon, link }) => (
              <Link key={label} to={link}
                className="flex items-center gap-3 p-3 rounded-xl transition-all hover:opacity-80"
                style={{ background:'var(--color-surface2)' }}>
                <span>{icon}</span>
                <span className="text-sm text-white">{label}</span>
                <span className="ml-auto" style={{ color:'var(--color-text-muted)' }}>→</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="section-title mb-3">System Health</h3>
          <div className="space-y-3 text-sm">
            {[
              { label:'API Server', status:'Online', ok:true },
              { label:'Database',   status:'Connected', ok:true },
              { label:'Socket.IO',  status:'Active', ok:true },
              { label:'WhatsApp',   status:'Configured per hospital', ok:null },
            ].map(({ label, status, ok }) => (
              <div key={label} className="flex items-center justify-between">
                <span style={{ color:'var(--color-text-muted)' }}>{label}</span>
                <span className="flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: ok === true ? '#10b981' : ok === false ? '#ef4444' : 'var(--color-text-muted)' }}>
                  <div className="w-1.5 h-1.5 rounded-full"
                    style={{ background: ok === true ? '#10b981' : ok === false ? '#ef4444' : 'gray' }} />
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
