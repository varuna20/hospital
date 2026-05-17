import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { fMoney } from '../../utils/helpers';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f87171', '#06b6d4', '#a855f7', '#ec4899'];

export default function AdminRevenue() {
  const { hospital, systemSettings } = useAuth();
  const sym = hospital?.payment?.currencySymbol || 'Rs.';
  const paypalEmail = systemSettings?.payment?.paypalEmail || 'varuna.20@gmail.com';
  const currencyCode = hospital?.payment?.currency || 'LKR';

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

  const [billingCycle, setBillingCycle] = useState('monthly');
  const [paymentHistory, setPaymentHistory] = useState([]);

  useEffect(() => { loadAll(); }, [period, month, year]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, d, chart, rep, ph] = await Promise.all([
        api.get(`/revenue/summary?period=${period}&month=${month}&year=${year}`),
        api.get(`/revenue/by-doctor?month=${month}&year=${year}`),
        api.get(`/revenue/daily?month=${month}&year=${year}`),
        api.get(`/hospitals/${hospital._id}/revenue-report`),
        api.get(`/subscriptions/payments`) // Fetch payment history
      ]);
      setSummary(s.data);
      setByDoctor(d.data.breakdown || []);
      setDaily(chart.data.daily || []);
      setReport(rep.data);
      setPaymentHistory(ph.data.payments || []);
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

  // Calculate System Due (Commission + Subscription)
  const hospRev = summary?.revenue?.paid?.hospitalRevenue || 0;
  const commPct = hospital?.billing?.commissionPercent || 0;
  const commissionAmt = (hospRev * commPct) / 100;
  
  // Base subscription fee based on plan (fallback to 29 if not set)
  const baseMonthly = hospital?.subscriptionPlan === 'trial' ? 0 : 
                      hospital?.subscriptionPlan === 'premium' ? 99 : 
                      hospital?.subscriptionPlan === 'enterprise' ? 199 : 29;

  const planFee = billingCycle === 'annual' ? baseMonthly * 12 : baseMonthly;
  const totalDue = commissionAmt + planFee; 

  const logPayment = async (details) => {
    try {
      await api.post('/subscriptions/payments', {
        amount: totalDue,
        currency: currencyCode,
        period: `${MONTHS[month-1]} ${year}`,
        billingCycle,
        transactionId: details?.id || 'manual_entry',
        details
      });
      loadAll();
    } catch (e) { console.error('Failed to log payment to system', e); }
  };

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

      <div className="card mb-8 border-l-4 border-accent" style={{ background: 'var(--color-surface2)' }}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">System Subscription & Commission Due</h3>
            <p className="text-sm text-muted mb-3">Please settle your current month's dues to keep services active.</p>
            
            <div className="flex bg-black/20 p-1 rounded-lg w-fit mb-3">
              <button onClick={() => setBillingCycle('monthly')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${billingCycle==='monthly'?'bg-primary text-white':'text-muted hover:text-white'}`}>Monthly</button>
              <button onClick={() => setBillingCycle('annual')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${billingCycle==='annual'?'bg-primary text-white':'text-muted hover:text-white'}`}>Annual (Save 10%)</button>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 font-bold capitalize">Plan: {hospital?.subscriptionPlan || 'Trial'}</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 font-bold">Base: {fMoney(planFee, sym)}</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 font-bold">Comm ({commPct}%): {fMoney(commissionAmt, sym)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 mt-4 md:mt-0">
            <div className="text-right">
              <p className="text-xs text-muted uppercase font-bold tracking-wider mb-1">Amount Due</p>
              <p className="text-2xl font-bold text-accent">{fMoney(totalDue, sym)}</p>
            </div>
            {systemSettings?.payment?.paypalClientId ? (
              <div className="w-[200px] mt-2">
                <PayPalScriptProvider options={{ "client-id": systemSettings.payment.paypalClientId, currency: currencyCode }}>
                  <PayPalButtons 
                    style={{ layout: "horizontal", height: 48, color: 'blue' }}
                    createOrder={(data, actions) => {
                      return actions.order.create({
                        purchase_units: [{
                          amount: { value: (totalDue > 0 ? totalDue : 1).toString() },
                          description: `Subscription & Comm (${MONTHS[month-1]} ${year})`
                        }],
                      });
                    }}
                    onApprove={async (data, actions) => {
                      const details = await actions.order.capture();
                      toast.success('Payment completed successfully!');
                      logPayment(details);
                    }}
                    onError={(err) => {
                      toast.error('PayPal Checkout failed. Check your PayPal config.');
                      console.error(err);
                    }}
                  />
                </PayPalScriptProvider>
              </div>
            ) : (
              <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank" onSubmit={() => { setTimeout(() => logPayment({ method: 'redirect_form' }), 5000) }}>
                <input type="hidden" name="cmd" value="_xclick" />
                <input type="hidden" name="business" value={paypalEmail} />
                <input type="hidden" name="currency_code" value={currencyCode} />
                <input type="hidden" name="item_name" value={`Hospital Subscription & Commission (${MONTHS[month-1]} ${year})`} />
                <input type="hidden" name="amount" value={totalDue > 0 ? totalDue : 1} />
                <input type="hidden" name="return" value={window.location.href} />
                <button type="submit" disabled={totalDue <= 0 && hospital?.subscriptionPlan === 'trial'} 
                  className={`btn-primary flex items-center gap-2 h-12 px-6 mt-2 ${totalDue <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <span className="text-xl">💳</span> Pay via PayPal
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Payment History Log */}
      {paymentHistory.length > 0 && (
        <div className="card mb-8">
          <h3 className="section-title text-base mb-4">Subscription Payment History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <th className="py-2 text-muted font-medium">Date</th>
                  <th className="py-2 text-muted font-medium">Period</th>
                  <th className="py-2 text-muted font-medium">Cycle</th>
                  <th className="py-2 text-muted font-medium">Method</th>
                  <th className="py-2 text-muted font-medium">Amount</th>
                  <th className="py-2 text-muted font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map(p => (
                  <tr key={p._id} className="border-b last:border-0" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-3 text-white">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 text-white">{p.period}</td>
                    <td className="py-3 capitalize text-white">{p.billingCycle}</td>
                    <td className="py-3 capitalize text-muted">{p.paymentMethod}</td>
                    <td className="py-3 font-bold text-white">{fMoney(p.amount, p.currency)}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${p.status === 'paid' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
