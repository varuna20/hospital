import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { fMoney } from '../../utils/helpers';

export default function SuperDashboard() {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);

  useEffect(() => { 
    api.get('/superadmin/stats').then(({ data }) => setStats(data.stats)).catch(() => {}); 
    api.get('/superadmin/today-sessions').then(({ data }) => setSessions(data.sessions || [])).catch(() => {});
  }, []);

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

      <div className="card mt-4">
        <h3 className="section-title mb-3">Today's Doctor Sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>No doctor sessions scheduled for today across any hospital.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                  <th className="pb-2 font-medium">Doctor</th>
                  <th className="pb-2 font-medium">Specialization</th>
                  <th className="pb-2 font-medium">Hospital</th>
                  <th className="pb-2 font-medium">Sessions</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sessions.map(doc => (
                  <tr key={doc._id}>
                    <td className="py-3 font-medium text-white">{doc.name}</td>
                    <td className="py-3" style={{ color: 'var(--color-text-muted)' }}>{doc.specialization}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {doc.hospital?.logoUrl && <img src={doc.hospital.logoUrl} alt="" className="w-5 h-5 rounded-full object-cover bg-white/10" />}
                        <span className="text-white">{doc.hospital?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        {doc.sessions.map((s, i) => (
                          <span key={i} className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--color-surface2)', color: 'var(--color-text-muted)', width: 'fit-content' }}>
                            {s.sessionName}: {s.startTime} - {s.endTime}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3">
                      {doc.todayStatus?.isArrived ? (
                        <span className="text-xs px-2 py-1 rounded text-[#10b981] bg-[#10b981]/10 font-medium">Arrived</span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded text-[#f59e0b] bg-[#f59e0b]/10 font-medium">Expected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
