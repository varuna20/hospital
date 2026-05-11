import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { fMoney } from '../../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DoctorRevenue() {
  const { hospital } = useAuth();
  const sym = hospital?.payment?.currencySymbol || 'Rs.';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  useEffect(() => {
    setLoading(true);
    api.get(`/revenue/my-revenue?month=${month}&year=${year}`)
      .then(({ data: d }) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month, year]);

  const chartData = (data?.daily || []).map(d => ({ date: d.date.slice(8), Revenue: d.revenue, Patients: d.count }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">My Revenue</h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>Your consultation fee collection only</p>
        </div>
        <div className="flex gap-2">
          <select className="input w-auto" value={month} onChange={e=>setMonth(Number(e.target.value))}>
            {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
          </select>
          <select className="input w-auto" value={year} onChange={e=>setYear(Number(e.target.value))}>
            {[2023,2024,2025,2026].map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 rounded-xl mb-5 text-xs font-semibold"
        style={{ background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',color:'#f87171' }}>
        🔒 CONFIDENTIAL — Personal financial data. For authorized user only.
      </div>

      <div className="rounded-xl p-4 mb-5 flex items-start gap-3"
        style={{ background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.25)' }}>
        <span className="text-xl">ℹ️</span>
        <p className="text-sm" style={{ color:'rgba(165,180,252,0.9)' }}>
          Shows <strong>only your consultation fee</strong>. Hospital charges are separate.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { l:'My Revenue',   v:data?.summary?.myRevenue,      c:'#6366f1', isAmt:true },
          { l:'Patients Paid',v:data?.summary?.totalPatients,  c:'var(--color-text)', isAmt:false },
          { l:'Sessions Done',v:data?.summary?.completed,      c:'var(--color-success)', isAmt:false },
        ].map(({ l,v,c,isAmt })=>(
          <div key={l} className="stat-card">
            <p className="stat-value" style={{ color:c }}>{loading?'—':isAmt?fMoney(v,sym):(v??0)}</p>
            <p className="stat-label">{l}</p>
          </div>
        ))}
      </div>

      <div className="card mb-6">
        <h3 className="section-title mb-1">{MONTHS[month-1]} {year} — Daily Revenue</h3>
        <p className="text-xs mb-4" style={{ color:'var(--color-text-muted)' }}>Paid appointments only</p>
        {loading ? (
          <div className="h-52 flex items-center justify-center" style={{ color:'var(--color-text-muted)' }}>Loading…</div>
        ) : !chartData.length ? (
          <div className="h-52 flex items-center justify-center" style={{ color:'var(--color-text-muted)' }}>No paid appointments this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fill:'var(--color-text-muted)',fontSize:11 }} />
              <YAxis tick={{ fill:'var(--color-text-muted)',fontSize:10 }} tickFormatter={v=>`${Math.round(v/1000)}k`} />
              <Tooltip contentStyle={{ background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8 }}
                formatter={(v,n)=>n==='Revenue'?[fMoney(v,sym),n]:[v,n]} />
              <Bar dataKey="Revenue" name="My Revenue" fill="#6366f1" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {data?.daily?.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-5 py-3 border-b" style={{ borderColor:'var(--color-border)' }}>
            <h3 className="section-title text-sm">Daily Breakdown</h3>
          </div>
          <table className="w-full text-sm">
            <thead><tr style={{ background:'var(--color-surface2)',borderBottom:'1px solid var(--color-border)' }}>
              {['Date','Patients','My Revenue'].map(h=><th key={h} className="table-header">{h}</th>)}
            </tr></thead>
            <tbody>
              {data.daily.map(d=>(
                <tr key={d.date} style={{ borderBottom:'1px solid var(--color-border)' }}>
                  <td className="table-cell text-white">{d.date}</td>
                  <td className="table-cell" style={{ color:'var(--color-text-muted)' }}>{d.count}</td>
                  <td className="table-cell font-bold" style={{ color:'#6366f1' }}>{fMoney(d.revenue,sym)}</td>
                </tr>
              ))}
              <tr style={{ background:'var(--color-surface2)' }}>
                <td className="table-cell font-bold text-white">Total</td>
                <td className="table-cell font-bold text-white">{data.summary?.totalPatients}</td>
                <td className="table-cell font-bold" style={{ color:'#6366f1' }}>{fMoney(data.summary?.myRevenue,sym)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
