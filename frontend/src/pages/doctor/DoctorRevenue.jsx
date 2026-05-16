import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { fMoney } from '../../utils/helpers';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend 
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f87171', '#06b6d4', '#a855f7'];

export default function DoctorRevenue() {
  const { user, hospital } = useAuth();
  const sym = hospital?.payment?.currencySymbol || 'Rs.';
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('weekly'); // weekly | monthly
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  
  const doctorId = user?.doctorProfile?._id || user?.doctorProfile;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  useEffect(() => {
    if (!doctorId) return;
    setLoading(true);
    Promise.all([
      api.get(`/revenue/my-revenue?month=${month}&year=${year}`),
      api.get(`/doctors/${doctorId}/revenue-report`)
    ]).then(([d, r]) => {
      setData(d.data);
      setReport(r.data);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, [doctorId, month, year]);

  const chartData = (data?.daily || []).map(d => ({ date: d.date.slice(8), Revenue: d.revenue, Patients: d.count }));
  const trendData = report ? (reportType === 'weekly' ? report.weekly : report.monthly) : [];

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Financial Analytics</h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>Dr. {(user?.name||'').replace('Dr. ','')} · {hospital?.name}</p>
        </div>
        <div className="flex gap-2">
          <select className="input w-auto h-10 py-1 text-xs font-bold" value={month} onChange={e=>setMonth(Number(e.target.value))}>
            {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
          </select>
          <select className="input w-auto h-10 py-1 text-xs font-bold" value={year} onChange={e=>setYear(Number(e.target.value))}>
            {[2024,2025,2026].map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { l:'Month Revenue', v:data?.summary?.myRevenue, c:'#6366f1', isAmt:true, i:'💰' },
          { l:'Patients Paid', v:data?.summary?.totalPatients, c:'var(--color-text)', isAmt:false, i:'👥' },
          { l:'Consultations', v:data?.summary?.completed, c:'#10b981', isAmt:false, i:'🩺' },
          { l:'Avg / Patient', v:data?.summary?.totalPatients ? (data.summary.myRevenue / data.summary.totalPatients) : 0, c:'#f59e0b', isAmt:true, i:'📈' },
        ].map(({ l,v,c,isAmt, i })=>(
          <div key={l} className="stat-card relative overflow-hidden group">
            <div className="absolute -right-2 -bottom-2 text-4xl opacity-5 group-hover:scale-110 transition-transform">{i}</div>
            <p className="stat-value" style={{ color:c }}>{loading?'—':isAmt?fMoney(v,sym):(v??0)}</p>
            <p className="stat-label">{l}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Trend Area Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="section-title text-base mb-0.5">Revenue Trends</h3>
              <p className="text-[10px] text-muted uppercase tracking-wider font-bold">Earnings growth over time</p>
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
          
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:'var(--color-text-muted)', fontSize:10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill:'var(--color-text-muted)', fontSize:10 }} 
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip 
                  contentStyle={{ background:'rgba(15,23,42,0.9)', border:'1px solid var(--color-border)', borderRadius:12, backdropBlur:'8px' }}
                  itemStyle={{ fontSize:12, fontWeight:'bold' }}
                  labelStyle={{ fontSize:10, color:'var(--color-text-muted)', marginBottom:4 }}
                  formatter={(v) => [fMoney(v, sym), 'Earnings']}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Appointment Status Pie */}
        <div className="card">
          <h3 className="section-title text-base mb-0.5">Patient Outcomes</h3>
          <p className="text-[10px] text-muted uppercase tracking-wider font-bold mb-6">Status distribution (30d)</p>
          
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={report?.pie || []} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {(report?.pie || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background:'rgba(15,23,42,0.9)', border:'1px solid var(--color-border)', borderRadius:12 }}
                  itemStyle={{ fontSize:12, fontWeight:'bold' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize:10, paddingTop:20 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Daily Bar Chart */}
        <div className="lg:col-span-2 card">
          <h3 className="section-title text-base mb-1">{MONTHS[month-1]} Daily Collection</h3>
          <p className="text-[10px] text-muted uppercase font-bold mb-6">Day-by-day revenue breakdown</p>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.3} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill:'var(--color-text-muted)', fontSize:10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill:'var(--color-text-muted)', fontSize:10 }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background:'rgba(15,23,42,0.9)', border:'1px solid var(--color-border)', borderRadius:12 }}
                  formatter={(v,n)=> [fMoney(v,sym), n]}
                />
                <Bar dataKey="Revenue" fill="#6366f1" radius={[4,4,0,0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Days List */}
        <div className="card p-0 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/5">
            <h3 className="section-title text-sm mb-0.5">Top Earning Days</h3>
            <p className="text-[10px] text-muted uppercase font-bold">Highest collection this month</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {(data?.daily || []).sort((a,b)=>b.revenue-a.revenue).slice(0, 6).map((d, i) => (
              <div key={d.date} className="flex items-center gap-3 p-3 border-b border-white/5 hover:bg-white/5 transition-colors">
                <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-bold text-muted">{i+1}</div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-white">{moment(d.date).format('MMM D, ddd')}</p>
                  <p className="text-[10px] text-muted">{d.count} patients</p>
                </div>
                <p className="text-sm font-bold text-primary">{fMoney(d.revenue, sym)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
