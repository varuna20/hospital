import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { fMoney } from '../../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SYM = 'Rs.';

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <div className="text-right">
          <p className="stat-value" style={{ color }}>{value}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>}
        </div>
      </div>
      <p className="stat-label">{label}</p>
    </div>
  );
}

export default function SuperRevenue() {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState('month');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/superadmin/revenue?period=${period}&month=${month}&year=${year}`)
      .then(({ data: res }) => {
        setData(res.byHospital || []);
        setSummary(res.summary || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, month, year]);

  const chartData = data.slice(0, 10).map(h => ({
    name: (h.hospitalName || '').split(' ')[0],
    Hospital: Math.round(h.hospitalRevenue || 0),
    Doctors: Math.round(h.doctorRevenue || 0),
    Commission: Math.round(h.commission || 0),
    PlanFee: Math.round(h.planFee || 0),
  }));

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Platform Revenue</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            All hospitals · Subscriptions + Commissions + Appointment Revenue
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['day', 'month', 'year'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="px-4 py-2 rounded-xl text-sm capitalize font-medium transition-all"
              style={{ background: period === p ? 'var(--color-primary)' : 'var(--color-surface)', color: period === p ? 'white' : 'var(--color-text-muted)' }}>
              {p === 'day' ? 'Today' : p}
            </button>
          ))}
          {period === 'month' && <>
            <select className="input w-auto" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select className="input w-auto" value={year} onChange={e => setYear(Number(e.target.value))}>
              {[2023, 2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
            </select>
          </>}
        </div>
      </div>

      {/* Confidential */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl mb-5 text-xs font-semibold"
        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
        🔒 CONFIDENTIAL — Platform financial data. Super Admin only.
      </div>

      {/* PLATFORM REVENUE (what super admin earns) */}
      <div className="card mb-5" style={{ background: 'linear-gradient(135deg, rgba(var(--color-primary-rgb),0.12), rgba(var(--color-primary-rgb),0.04))', border: '1px solid rgba(var(--color-primary-rgb),0.3)' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">💎</span>
          <div>
            <h3 className="font-bold text-white text-lg">Your Platform Revenue</h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>What you earn from all hospitals this period</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-3xl font-black" style={{ color: 'var(--color-primary)', fontFamily: 'Sora,sans-serif' }}>
              {loading ? '—' : fMoney(summary?.totalPlatformRevenue, SYM)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Total platform revenue</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            ['Subscription Fees', summary?.totalPlanFees, '#6366f1', '📦', 'Fixed monthly plan fees'],
            ['Commission Earned', summary?.totalCommission, 'var(--color-primary)', '📊', '% of hospital charges'],
            ['Total Appointments', summary?.totalAppointments, '#10b981', '📅', 'Paid appointments'],
          ].map(([l, v, c, i, sub]) => (
            <div key={l} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>
              <p className="font-bold text-lg" style={{ color: c, fontFamily: 'Sora,sans-serif' }}>
                {loading ? '—' : (l === 'Total Appointments' ? (v || 0).toLocaleString() : fMoney(v, SYM))}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hospital appointment revenue summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Hospital Revenue" value={loading ? '—' : fMoney(summary?.totalHospitalRevenue, SYM)}
          sub="All hospital charges collected" color="var(--color-primary)" icon="🏥" />
        <StatCard label="Doctor Revenue" value={loading ? '—' : fMoney(summary?.totalDoctorRevenue, SYM)}
          sub="All doctor fees collected" color="#6366f1" icon="🩺" />
        <StatCard label="Total Appointments" value={loading ? '—' : (summary?.totalAppointments || 0).toLocaleString()}
          sub="Paid appointments" color="var(--color-success)" icon="📅" />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card mb-6">
          <h3 className="section-title mb-1">Revenue by Hospital</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>Top 10 hospitals by appointment revenue</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                formatter={(v, n) => [fMoney(v, SYM), n]} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)' }} />
              <Bar dataKey="Hospital" fill="var(--color-primary)" radius={[4,4,0,0]} />
              <Bar dataKey="Doctors"  fill="#6366f1"              radius={[4,4,0,0]} />
              <Bar dataKey="Commission" fill="#f59e0b"            radius={[4,4,0,0]} />
              <Bar dataKey="PlanFee"  fill="#10b981"              radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-hospital breakdown table */}
      {data.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="section-title">Per-Hospital Breakdown</h3>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{data.length} hospitals</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface2)', borderBottom: '1px solid var(--color-border)' }}>
                  {['Hospital', 'Plan', 'Apts', 'Hosp Revenue', 'Dr Revenue', 'Commission %', 'Commission Earned', 'Plan Fee', 'You Earn'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="table-cell">
                      <p className="text-white font-medium">{h.hospitalName}</p>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                        style={{ background: 'rgba(var(--color-primary-rgb),0.1)', color: 'var(--color-primary)' }}>
                        {h.subscriptionPlan || 'trial'}
                      </span>
                    </td>
                    <td className="table-cell text-center" style={{ color: 'var(--color-text-muted)' }}>{h.appointments || 0}</td>
                    <td className="table-cell" style={{ color: 'var(--color-primary)' }}>{fMoney(h.hospitalRevenue, SYM)}</td>
                    <td className="table-cell" style={{ color: '#6366f1' }}>{fMoney(h.doctorRevenue, SYM)}</td>
                    <td className="table-cell text-center" style={{ color: '#f59e0b' }}>{h.commissionPercent || 0}%</td>
                    <td className="table-cell" style={{ color: '#f59e0b' }}>{fMoney(h.commission, SYM)}</td>
                    <td className="table-cell" style={{ color: '#10b981' }}>{fMoney(h.planFee, SYM)}</td>
                    <td className="table-cell font-bold" style={{ color: 'white' }}>{fMoney(h.platformRevenue, SYM)}</td>
                  </tr>
                ))}
                {/* Totals */}
                <tr style={{ background: 'var(--color-surface2)', fontWeight: 700 }}>
                  <td className="table-cell text-white" colSpan={3}>TOTAL</td>
                  <td className="table-cell" style={{ color: 'var(--color-primary)' }}>{fMoney(summary?.totalHospitalRevenue, SYM)}</td>
                  <td className="table-cell" style={{ color: '#6366f1' }}>{fMoney(summary?.totalDoctorRevenue, SYM)}</td>
                  <td className="table-cell" />
                  <td className="table-cell" style={{ color: '#f59e0b' }}>{fMoney(summary?.totalCommission, SYM)}</td>
                  <td className="table-cell" style={{ color: '#10b981' }}>{fMoney(summary?.totalPlanFees, SYM)}</td>
                  <td className="table-cell text-white">{fMoney(summary?.totalPlatformRevenue, SYM)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && data.length === 0 && (
        <div className="card text-center py-14" style={{ color: 'var(--color-text-muted)' }}>
          <div className="text-5xl mb-3">💰</div>
          <p className="text-lg font-medium text-white mb-1">No revenue data yet</p>
          <p className="text-sm">Revenue will appear once hospitals have paid appointments.</p>
        </div>
      )}
    </div>
  );
}
