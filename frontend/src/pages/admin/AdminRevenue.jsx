import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { fMoney } from '../../utils/helpers';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f87171', '#06b6d4', '#a855f7', '#ec4899'];

export default function AdminRevenue() {
  const { hospital } = useAuth();
  const sym = hospital?.payment?.currencySymbol || 'Rs.';
  const [summary,   setSummary]   = useState(null);
  const [report,    setReport]    = useState(null);
  const [byDoctor,  setByDoctor]  = useState([]);
  const [daily,     setDaily]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState('month');
  const [reportType, setReportType] = useState('weekly');
  const [month,     setMonth]     = useState(new Date().getMonth() + 1);
  const [year,      setYear]      = useState(new Date().getFullYear());

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  useEffect(() => { loadAll(); }, [period, month, year]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, d, chart, rep] = await Promise.all([
        api.get(`/revenue/summary?period=${period}&month=${month}&year=${year}`),
        api.get(`/revenue/by-doctor?month=${month}&year=${year}`),
        api.get(`/revenue/daily?month=${month}&year=${year}`),
        api.get(`/hospitals/${hospital._id}/revenue-report`)
      ]);
      setSummary(s.data);
      setByDoctor(d.data.breakdown || []);
      setDaily(chart.data.daily || []);
      setReport(rep.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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

  const trendData = report ? (reportType === 'weekly' ? report.weekly : report.monthly) : [];

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Revenue Dashboard</h1>
          <p className="text-sm text-muted">Hospital & doctor collection insights</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select className="input w-auto h-10 py-1 text-xs font-bold" value={month} onChange={e=>setMonth(Number(e.target.value))}>
            {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
          </select>
          <select className="input w-auto h-10 py-1 text-xs font-bold" value={year} onChange={e=>setYear(Number(e.target.value))}>
            {[2024,2025,2026].map(y=><option key={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV} className="btn-ghost text-xs px-4 border border-white/10 h-10">📥 Export CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { l:'Hospital Revenue', v:summary?.revenue?.paid?.hospitalRevenue, c:'var(--color-primary)', i:'🏥' },
          { l:'Doctor Revenue',   v:summary?.revenue?.paid?.doctorRevenue,   c:'#6366f1',              i:'🩺' },
          { l:'Total Collected',  v:summary?.revenue?.paid?.totalRevenue,    c:'#10b981',              i:'💰' },
          { l:'Pending Payment',  v:summary?.revenue?.pending?.pendingAmount, c:'#f59e0b',              i:'⏳' },
        ].map(({ l,v,c,i })=>(
          <div key={l} className="stat-card group relative overflow-hidden">
            <div className="absolute -right-2 -bottom-2 text-4xl opacity-5 group-hover:scale-110 transition-all">{i}</div>
            <p className="stat-value text-xl md:text-2xl" style={{ color:c }}>{loading?'—':fMoney(v,sym)}</p>
            <p className="stat-label">{l}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="section-title text-base mb-1">Hospital Net Trends</h3>
              <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Hospital charge growth</p>
            </div>
            <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
              {['weekly','monthly'].map(t => (
                <button key={t} onClick={() => setReportType(t)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${reportType === t ? 'bg-primary text-white shadow-lg' : 'text-muted hover:text-white'}`}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorHosp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.3} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'var(--color-text-muted)', fontSize:10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill:'var(--color-text-muted)', fontSize:10 }} 
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip 
                  contentStyle={{ background:'rgba(15,23,42,0.95)', border:'1px solid var(--color-border)', borderRadius:12, backdropBlur:'10px' }}
                  itemStyle={{ fontSize:12, fontWeight:'bold' }}
                  labelStyle={{ fontSize:10, color:'var(--color-text-muted)', marginBottom:4 }}
                  formatter={(v) => [fMoney(v, sym), 'Hospital Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorHosp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Method Pie */}
        <div className="card">
          <h3 className="section-title text-base mb-1">Payment Distribution</h3>
          <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-8">Channel breakdown (30d)</p>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={report?.byPayment || []} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" nameKey="_id">
                  {(report?.byPayment || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background:'rgba(15,23,42,0.9)', border:'1px solid var(--color-border)', borderRadius:12 }}
                  formatter={(v) => fMoney(v, sym)}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize:11, paddingTop:20 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Breakdown */}
        <div className="card">
          <h3 className="section-title text-base mb-1">Daily Breakdown</h3>
          <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-6">Hospital vs Doctor collection</p>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.3} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill:'var(--color-text-muted)', fontSize:10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill:'var(--color-text-muted)', fontSize:10 }} />
                <Tooltip 
                  contentStyle={{ background:'rgba(15,23,42,0.9)', border:'1px solid var(--color-border)', borderRadius:12 }}
                  formatter={(v,n)=> [fMoney(v,sym), n]}
                />
                <Legend iconType="rect" wrapperStyle={{ fontSize:11, paddingTop:10 }} />
                <Bar dataKey="Hospital" fill="var(--color-primary)" radius={[4,4,0,0]} barSize={15} />
                <Bar dataKey="Doctors" fill="#6366f1" radius={[4,4,0,0]} barSize={15} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Doctor Share Pie */}
        <div className="card">
          <h3 className="section-title text-base mb-1">Revenue by Physician</h3>
          <p className="text-[10px] text-muted uppercase font-bold tracking-wider mb-6">Top 5 Doctors (30d)</p>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={report?.byDoctor || []} cx="50%" cy="50%" innerRadius={0} outerRadius={85} dataKey="value" label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {(report?.byDoctor || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background:'rgba(15,23,42,0.9)', border:'1px solid var(--color-border)', borderRadius:12 }}
                  formatter={(v) => fMoney(v, sym)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
