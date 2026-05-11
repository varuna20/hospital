import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { fMoney } from '../../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminRevenue() {
  const { hospital } = useAuth();
  const sym = hospital?.payment?.currencySymbol || 'Rs.';
  const [summary,   setSummary]   = useState(null);
  const [byDoctor,  setByDoctor]  = useState([]);
  const [daily,     setDaily]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [markingId, setMarkingId] = useState(null);
  const [period,    setPeriod]    = useState('month');
  const [month,     setMonth]     = useState(new Date().getMonth() + 1);
  const [year,      setYear]      = useState(new Date().getFullYear());

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  useEffect(() => { loadAll(); }, [period, month, year]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, d, chart] = await Promise.all([
        api.get(`/revenue/summary?period=${period}&month=${month}&year=${year}`),
        api.get(`/revenue/by-doctor?month=${month}&year=${year}`),
        api.get(`/revenue/daily?month=${month}&year=${year}`),
      ]);
      setSummary(s.data);
      setByDoctor(d.data.breakdown || []);
      setDaily(chart.data.daily || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const markPaid = async (id) => {
    setMarkingId(id);
    try { await api.put(`/revenue/mark-paid/${id}`, { paymentMethod: 'cash' }); loadAll(); }
    catch { } finally { setMarkingId(null); }
  };

  const exportCSV = () => {
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const end = new Date(year, month, 0).toISOString().split('T')[0];
    window.open(`/api/revenue/export?startDate=${start}&endDate=${end}`, '_blank');
  };

  const chartData = daily.map(d => ({
    date: d.date.slice(8),
    'Hospital': d.hospitalRev || 0,
    'Doctors': d.doctorRev || 0,
  }));

  const totals = byDoctor.reduce((acc, d) => ({
    doc: acc.doc + (d.doctorRevenue || 0),
    hosp: acc.hosp + (d.hospitalRevenue || 0),
    total: acc.total + (d.totalRevenue || 0),
  }), { doc: 0, hosp: 0, total: 0 });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="page-title">Revenue Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Hospital + Doctor revenue breakdown</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['day','month','year'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all"
              style={{ background: period===p?'var(--color-primary)':'var(--color-surface)', color: period===p?'white':'var(--color-text-muted)' }}>
              {p==='day'?'Today':p}
            </button>
          ))}
          {period==='month'&&<>
            <select className="input w-auto" value={month} onChange={e=>setMonth(Number(e.target.value))}>
              {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
            </select>
            <select className="input w-auto" value={year} onChange={e=>setYear(Number(e.target.value))}>
              {[2023,2024,2025,2026].map(y=><option key={y}>{y}</option>)}
            </select>
          </>}
          <button onClick={exportCSV} className="btn-ghost text-sm">📥 CSV</button>
        </div>
      </div>

      {/* Confidential */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl mb-5 text-xs font-semibold"
        style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171' }}>
        🔒 CONFIDENTIAL — This report contains sensitive financial data. Authorized personnel only.
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { l:'Hospital Revenue',  v:summary?.revenue?.paid?.hospitalRevenue, c:'var(--color-primary)', i:'🏥' },
          { l:'Doctor Revenue',    v:summary?.revenue?.paid?.doctorRevenue,   c:'#6366f1',              i:'🩺' },
          { l:'Total Collected',   v:summary?.revenue?.paid?.totalRevenue,    c:'var(--color-success)', i:'💰' },
          { l:'Pending Payment',   v:summary?.revenue?.pending?.pendingAmount, c:'var(--color-warning)', i:'⏳' },
        ].map(({ l,v,c,i })=>(
          <div key={l} className="stat-card">
            <span className="text-xl">{i}</span>
            <p className="stat-value" style={{ color:c }}>{loading?'—':fMoney(v,sym)}</p>
            <p className="stat-label">{l}</p>
          </div>
        ))}
      </div>

      {/* Daily chart */}
      {chartData.length > 0 && (
        <div className="card mb-6">
          <h3 className="section-title mb-1">{MONTHS[month-1]} {year} — Daily Revenue</h3>
          <p className="text-xs mb-4" style={{ color:'var(--color-text-muted)' }}>Paid appointments only · Hospital charge vs Doctor fees</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fill:'var(--color-text-muted)', fontSize:11 }} />
              <YAxis tick={{ fill:'var(--color-text-muted)', fontSize:10 }} tickFormatter={v=>`${Math.round(v/1000)}k`} />
              <Tooltip contentStyle={{ background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8 }}
                formatter={(v,n)=>[fMoney(v,sym),n]} />
              <Legend wrapperStyle={{ fontSize:12, color:'var(--color-text-muted)' }} />
              <Bar dataKey="Hospital" fill="var(--color-primary)" radius={[4,4,0,0]} />
              <Bar dataKey="Doctors"  fill="#6366f1"              radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-doctor breakdown */}
      {byDoctor.length > 0 && (
        <div className="card overflow-hidden p-0 mb-6">
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor:'var(--color-border)' }}>
            <h3 className="section-title">By Doctor — {MONTHS[month-1]} {year}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ background:'var(--color-surface2)',borderBottom:'1px solid var(--color-border)' }}>
                {['Doctor','Specialization','Appointments','Paid','Doctor Revenue','Hospital Revenue','Total'].map(h=>(
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {byDoctor.map((d,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid var(--color-border)' }}>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                          style={{ background:'var(--color-primary)' }}>
                          {(d.doctor?.name||'D').replace('Dr. ','').charAt(0)}
                        </div>
                        <span className="text-white font-medium">{d.doctor?.name}</span>
                      </div>
                    </td>
                    <td className="table-cell" style={{ color:'var(--color-text-muted)' }}>{d.doctor?.specialization}</td>
                    <td className="table-cell text-center" style={{ color:'var(--color-text-muted)' }}>{d.totalAppointments}</td>
                    <td className="table-cell text-center" style={{ color:'var(--color-success)' }}>{d.paidCount}</td>
                    <td className="table-cell font-medium" style={{ color:'#6366f1' }}>{fMoney(d.doctorRevenue,sym)}</td>
                    <td className="table-cell font-medium" style={{ color:'var(--color-primary)' }}>{fMoney(d.hospitalRevenue,sym)}</td>
                    <td className="table-cell font-bold text-white">{fMoney(d.totalRevenue,sym)}</td>
                  </tr>
                ))}
                <tr style={{ background:'var(--color-surface2)' }}>
                  <td colSpan={4} className="table-cell font-bold text-white">TOTAL</td>
                  <td className="table-cell font-bold" style={{ color:'#6366f1' }}>{fMoney(totals.doc,sym)}</td>
                  <td className="table-cell font-bold" style={{ color:'var(--color-primary)' }}>{fMoney(totals.hosp,sym)}</td>
                  <td className="table-cell font-bold text-white">{fMoney(totals.total,sym)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !summary?.revenue?.paid?.totalRevenue && byDoctor.length===0 && (
        <div className="card text-center py-14" style={{ color:'var(--color-text-muted)' }}>
          <div className="text-5xl mb-3">💰</div>
          <p className="text-lg font-medium text-white mb-1">No revenue data yet</p>
          <p className="text-sm">Revenue appears once appointments are completed and marked as paid.</p>
        </div>
      )}
    </div>
  );
}
