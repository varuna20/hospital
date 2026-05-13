import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { statusBadge, statusLabel, fMoney } from '../../utils/helpers';

function RefundCard({ apt, onAction }) {
  const { hospital } = useAuth();
  const sym = hospital?.payment?.currencySymbol || 'Rs.';
  const [loading, setLoading] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');

  const act = async (endpoint, body = {}) => {
    setLoading(endpoint);
    try {
      await api.put(`/appointments/${apt._id}/refund/${endpoint}`, body);
      toast.success(endpoint === 'doctor-approve' ? '✅ Refund approved — staff will process' : 'Refund rejected');
      onAction();
    } catch(e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setLoading(''); }
  };

  return (
    <div className="card border" style={{ borderColor:'rgba(245,158,11,0.35)', background:'rgba(245,158,11,0.04)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-bold text-white">{apt.patient?.name}</p>
          <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>Q#{apt.queueNumber} · {apt.patient?.phone}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-lg" style={{ color:'#6366f1' }}>{sym} {apt.fees?.doctorFee || 0}</p>
          <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>to refund</p>
        </div>
      </div>
      <div className="rounded-lg p-3 mb-3" style={{ background:'var(--color-surface2)' }}>
        <p className="text-xs font-semibold mb-1" style={{ color:'var(--color-text-muted)' }}>REASON FROM STAFF:</p>
        <p className="text-sm text-white">{apt.refund?.reason}</p>
        <p className="text-xs mt-1.5" style={{ color:'var(--color-text-muted)' }}>
          Requested by {apt.refund?.requestedBy}
        </p>
      </div>
      {!showReject ? (
        <div className="flex gap-2">
          <button onClick={() => act('doctor-approve')} disabled={!!loading}
            className="flex-1 py-2 rounded-xl text-sm font-bold"
            style={{ background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)' }}>
            {loading==='doctor-approve'?'Approving…':'✓ Approve Refund'}
          </button>
          <button onClick={() => setShowReject(true)} disabled={!!loading}
            className="flex-1 py-2 rounded-xl text-sm"
            style={{ background:'rgba(239,68,68,0.1)',color:'#f87171',border:'1px solid rgba(239,68,68,0.2)' }}>
            ✕ Reject
          </button>
        </div>
      ) : (
        <div>
          <label className="label">Rejection Reason</label>
          <input className="input mb-2" placeholder="Reason for rejecting refund…" value={reason} onChange={e=>setReason(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={()=>act('doctor-reject',{rejectionReason:reason})} disabled={!!loading}
              className="flex-1 py-2 rounded-xl text-sm" style={{ background:'rgba(239,68,68,0.15)',color:'#f87171' }}>
              {loading==='doctor-reject'?'…':'Confirm Reject'}
            </button>
            <button onClick={()=>setShowReject(false)} className="btn-ghost text-sm">Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DoctorDashboard() {
  const { user, hospital } = useAuth();
  const { socket } = useSocket();
  const [stats, setStats] = useState(null);
  const [apts, setApts] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [selSession, setSelSession] = useState('');
  const [loading, setLoading] = useState(true);
  const sym = hospital?.payment?.currencySymbol || 'Rs.';
  const doctorId = user?.doctorProfile?._id || user?.doctorProfile;

  const load = useCallback(async () => {
    if (!doctorId) return;
    try {
      let url = '/appointments/today/' + doctorId;
      if (selSession) url += `?sessionId=${selSession}`;
      
      const [s, a, r] = await Promise.all([
        api.get('/doctors/' + doctorId + '/stats'),
        api.get(url),
        api.get('/appointments/refunds/pending'),
      ]);
      setStats(s.data);
      setApts(a.data.appointments || []);
      setRefunds(r.data.refunds || []);
    } catch {}
    finally { setLoading(false); }
  }, [doctorId, selSession]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket || !doctorId || !hospital?._id) return;
    socket.emit('join_doctor_room', { hospitalId: hospital._id, doctorId });
    ['appointment_updated','next_called','refund_requested'].forEach(e => socket.on(e, load));
    return () => ['appointment_updated','next_called','refund_requested'].forEach(e => socket.off(e, load));
  }, [socket, doctorId, hospital, load]);

  const current = apts.find(a => a.status === 'in-progress');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Get today's sessions for the selector
  const dayOfWeek = new Date().getDay();
  const todaySessions = (user?.doctorProfile?.sessions || []).filter(s => s.dayOfWeek === dayOfWeek && s.isActive);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">{greeting}, {(user?.name||'').replace('Dr. ','')}</h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>
            {new Date().toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long'})} · {hospital?.name}
          </p>
        </div>
        {todaySessions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold" style={{ color:'var(--color-text-muted)' }}>VIEW SESSION:</span>
            <select className="input w-auto h-10 py-1 text-xs" 
              style={{ background:'rgba(var(--color-primary-rgb),0.1)', borderColor:'rgba(var(--color-primary-rgb),0.3)', color:'var(--color-primary)' }}
              value={selSession} onChange={e => setSelSession(e.target.value)}>
              <option value="">All Today's Patients</option>
              {todaySessions.map(s => <option key={s._id} value={s._id}>{s.label || s.sessionName} ({s.startTime})</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Refund requests — urgent */}
      {refunds.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="section-title text-base">⚠️ Pending Refund Approvals</h2>
            <span className="text-xs px-2 py-0.5 rounded-full animate-pulse font-bold"
              style={{ background:'rgba(245,158,11,0.2)',color:'#f59e0b' }}>
              {refunds.length} waiting
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {refunds.map(apt => <RefundCard key={apt._id} apt={apt} onAction={load} />)}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[['Today Total',apts.length,'var(--color-text)'],
          ['Waiting',apts.filter(a=>['booked','arrived'].includes(a.status)).length,'#f59e0b'],
          ['Completed',apts.filter(a=>a.status==='completed').length,'#10b981'],
          ["Revenue",fMoney(stats?.todayRevenue,sym),'#6366f1']].map(([l,v,c])=>(
          <div key={l} className="stat-card"><p className="stat-value" style={{ color:c }}>{v}</p><p className="stat-label">{l}</p></div>
        ))}
      </div>

      {/* Current patient */}
      {current && (
        <div className="card mb-5 border-2" style={{ borderColor:'var(--color-primary)' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background:'var(--color-primary)' }} />
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color:'var(--color-primary)' }}>Now Consulting</p>
              <div className="flex items-center gap-2">
                <p className="font-bold text-white text-lg">{current.patient?.name}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                  {current.sessionLabel || 'General'}
                </span>
              </div>
              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Q#{current.queueNumber} · {current.patient?.phone}</p>
            </div>
            <Link to={`/doctor/prescriptions/new?patientId=${current.patient?._id}&appointmentId=${current._id}`}
              className="btn-primary text-sm">+ Write Prescription</Link>
          </div>
        </div>
      )}

      {/* Queue table */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor:'var(--color-border)' }}>
          <h3 className="section-title">Today's Appointments {selSession ? ` — ${todaySessions.find(s=>s._id===selSession)?.label || 'Session'}` : ''}</h3>
          <span className="text-xs" style={{ color:'var(--color-text-muted)' }}>{apts.length} total</span>
        </div>
        {loading ? (
          <div className="text-center py-10" style={{ color:'var(--color-text-muted)' }}>Loading…</div>
        ) : apts.length === 0 ? (
          <div className="text-center py-12" style={{ color:'var(--color-text-muted)' }}>
            <div className="text-4xl mb-2">📅</div><p>No appointments {selSession?'in this session':'today'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[650px]">
              <thead><tr style={{ background:'var(--color-surface2)',borderBottom:'1px solid var(--color-border)' }}>
                {['#','Patient','Session','Status','Payment',''].map(h=><th key={h} className="table-header">{h}</th>)}
              </tr></thead>
              <tbody>
                {apts.map(a=>(
                  <tr key={a._id} style={{ borderBottom:'1px solid var(--color-border)',background:a.status==='in-progress'?'rgba(var(--color-primary-rgb),0.05)':'transparent' }}>
                    <td className="table-cell font-bold text-white">#{a.queueNumber}</td>
                    <td className="table-cell">
                      <p className="text-white">{a.patient?.name}</p>
                      <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{a.patient?.phone}</p>
                    </td>
                    <td className="table-cell">
                      <p className="text-xs" style={{ color: 'var(--color-primary)' }}>{a.sessionLabel || 'General'}</p>
                    </td>
                    <td className="table-cell"><span className={statusBadge(a.status)}>{statusLabel(a.status)}</span></td>
                    <td className="table-cell">
                      <p className="text-xs capitalize" style={{ color:a.paymentStatus==='paid'?'#10b981':a.paymentStatus==='refunded'?'#f87171':'var(--color-text-muted)' }}>
                        {a.paymentStatus}
                      </p>
                      {a.refund?.status&&a.refund.status!=='none'&&(
                        <p className="text-xs" style={{ color:'#f59e0b' }}>↩ Refund: {a.refund.status}</p>
                      )}
                    </td>
                    <td className="table-cell text-right">
                      {['completed','in-progress','arrived'].includes(a.status) && (
                        <Link to={`/doctor/prescriptions/new?patientId=${a.patient?._id}&appointmentId=${a._id}`}
                          className="text-[10px] px-2 py-1 rounded-lg font-bold"
                          style={{ background:'rgba(var(--color-primary-rgb),0.1)',color:'var(--color-primary)' }}>
                          💊 Rx
                        </Link>
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
