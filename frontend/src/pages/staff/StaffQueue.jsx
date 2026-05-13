/**
 * STAFF QUEUE PAGE
 * ================
 * Manages live patient queue for each doctor.
 * Refund workflow: Staff requests → Doctor approves → Staff completes.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { statusBadge, statusLabel, fMoney } from '../../utils/helpers';

// ── SMS Message Modal ─────────────────────────────────────────────
function MessageModal({ apt, onClose }) {
  const { hospital } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const templates = [
    { label: 'Come to Room', text: `Hi ${apt.patient?.name}, please proceed to Dr. ${apt.doctor?.name}'s room (Q#${apt.queueNumber}) now. Thank you.` },
    { label: 'Next in Queue', text: `Hi ${apt.patient?.name}, you are next in queue for Dr. ${apt.doctor?.name}. Please be ready near the room.` },
    { label: 'Slight Delay', text: `Hi ${apt.patient?.name}, there is a slight delay in Dr. ${apt.doctor?.name}'s session. We appreciate your patience.` },
    { label: 'Check-in', text: `Hi ${apt.patient?.name}, please come to the reception for a quick check-in for your appointment with Dr. ${apt.doctor?.name}.` }
  ];

  const send = async () => {
    if (!message.trim()) return toast.error('Message cannot be empty');
    setLoading(true);
    try {
      await api.post('/hospitals/send-manual-sms', {
        to: apt.patient?.phone,
        message: message,
        hospitalId: hospital?._id
      });
      toast.success('Message sent!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card max-w-lg w-full shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="section-title">Send SMS to Patient</h3>
          <button onClick={onClose} className="text-xl opacity-50 hover:opacity-100">✕</button>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
          <p className="text-white font-bold text-sm">{apt.patient?.name}</p>
          <p className="text-xs text-muted">Q#{apt.queueNumber} · {apt.patient?.phone}</p>
        </div>

        <div className="mb-4">
          <label className="label">Quick Templates</label>
          <div className="grid grid-cols-2 gap-2">
            {templates.map(t => (
              <button key={t.label} onClick={() => setMessage(t.text)}
                className="text-[10px] text-left p-2 rounded-lg border border-white/10 hover:bg-primary/20 transition-colors">
                <span className="font-bold block mb-0.5">{t.label}</span>
                <span className="text-muted truncate block">{t.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="label">Message Content</label>
          <textarea className="input min-h-[100px] text-sm" value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Type your custom message here..." />
          <p className="text-[10px] mt-1 text-right text-muted">{message.length} characters</p>
        </div>

        <div className="flex gap-3">
          <button onClick={send} disabled={loading || !message} className="btn-primary flex-1">
            {loading ? 'Sending...' : '🚀 Send Message'}
          </button>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Status action buttons ──────────────────────────────────────────
function StatusActions({ apt, onUpdate, onRefundRequest, onSendMessage }) {
  const map = {
    booked:        [{ l:'✓ Arrived', s:'arrived',     bg:'rgba(234,179,8,0.15)', c:'#eab308' }, { l:'Absent', s:'absent', bg:'rgba(239,68,68,0.15)', c:'#ef4444' }],
    arrived:       [{ l:'▶ Start',   s:'in-progress', bg:'var(--color-primary)', c:'white', primary:true }, { l:'Absent', s:'absent', bg:'rgba(239,68,68,0.15)', c:'#ef4444' }],
    'in-progress': [{ l:'✓ Done',    s:'completed',   bg:'rgba(16,185,129,0.15)', c:'#10b981' }],
    completed: [], absent: [], cancelled: [],
  };
  return (
    <div className="flex gap-1.5 flex-wrap items-center">
      {(map[apt.status] || []).map(({ l, s, bg, c }) => (
        <button key={s} onClick={() => onUpdate(apt._id, s)}
          className="text-xs py-1.5 px-3 rounded-lg font-medium transition-all"
          style={{ background: bg, color: c }}>
          {l}
        </button>
      ))}
      {/* Refund button — only for paid completed appointments */}
      {apt.paymentStatus === 'paid' && apt.status === 'completed' && (!apt.refund?.status || apt.refund.status === 'none' || apt.refund.status === 'rejected') && (
        <button onClick={() => onRefundRequest(apt)}
          className="text-xs py-1.5 px-3 rounded-lg font-medium transition-all"
          style={{ background:'rgba(239,68,68,0.1)', color:'#f87171' }}>
          ↩ Refund
        </button>
      )}
      {/* Refund status badge */}
      {apt.refund?.status && apt.refund.status !== 'none' && (
        <RefundBadge refund={apt.refund} apt={apt} />
      )}
      
      {/* Message button */}
      <button onClick={() => onSendMessage(apt)}
        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
        title="Send SMS">
        <span>💬</span>
      </button>
    </div>
  );
}

// ── Refund status badge ────────────────────────────────────────────
function RefundBadge({ refund, apt }) {
  const [completing, setCompleting] = useState(false);

  const complete = async (e) => {
    e.stopPropagation();
    setCompleting(true);
    try {
      await api.put(`/appointments/${apt._id}/refund/complete`);
      toast.success(`Refund of ${fMoney(refund.refundAmount)} completed`);
      window.location.reload();
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setCompleting(false); }
  };

  if (refund.status === 'requested') return (
    <span className="text-xs px-2 py-1 rounded-lg animate-pulse"
      style={{ background:'rgba(245,158,11,0.15)', color:'#f59e0b' }}>
      ⏳ Awaiting Doctor Approval
    </span>
  );
  if (refund.status === 'doctor_approved') return (
    <button onClick={complete} disabled={completing}
      className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
      style={{ background:'rgba(16,185,129,0.2)', color:'#10b981', border:'1px solid rgba(16,185,129,0.4)' }}>
      {completing ? '…' : `✓ Process Refund Rs.${refund.refundAmount}`}
    </button>
  );
  if (refund.status === 'completed') return (
    <span className="text-xs px-2 py-1 rounded-lg" style={{ background:'rgba(16,185,129,0.1)', color:'#10b981' }}>
      ✓ Refunded
    </span>
  );
  if (refund.status === 'rejected') return (
    <span className="text-xs px-2 py-1 rounded-lg" title={refund.rejectionReason}
      style={{ background:'rgba(239,68,68,0.1)', color:'#f87171' }}>
      ✕ Refund Rejected
    </span>
  );
  return null;
}

// ── Refund request modal ───────────────────────────────────────────
function RefundModal({ apt, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const sym = useAuth().hospital?.payment?.currencySymbol || 'Rs.';

  const submit = async () => {
    if (!reason.trim()) { toast.error('Please provide a reason'); return; }
    setLoading(true);
    try {
      await api.post(`/appointments/${apt._id}/refund/request`, { reason });
      toast.success('Refund request sent to doctor for approval');
      onDone();
      onClose();
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.7)' }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="card max-w-md w-full">
        <h3 className="section-title mb-1">Request Doctor Fee Refund</h3>
        <p className="text-xs mb-4" style={{ color:'var(--color-text-muted)' }}>
          The doctor must approve this before you can process it.
        </p>

        {/* Appointment summary */}
        <div className="rounded-xl p-3 mb-4" style={{ background:'var(--color-surface2)' }}>
          <p className="text-white font-semibold">{apt.patient?.name}</p>
          <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>
            Q#{apt.queueNumber} · {apt.doctor?.name}
          </p>
          <div className="flex gap-4 mt-2 text-xs">
            <span style={{ color:'var(--color-text-muted)' }}>Doctor Fee:</span>
            <span className="font-bold" style={{ color:'#6366f1' }}>{sym} {apt.fees?.doctorFee || 0}</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="label">Reason for Refund *</label>
          <textarea className="input resize-none" rows={3}
            placeholder="e.g. Doctor did not attend the session, patient waited too long, double booking error…"
            value={reason} onChange={e => setReason(e.target.value)} />
        </div>

        <div className="rounded-xl p-3 mb-4 text-xs" style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', color:'#f59e0b' }}>
          ⚠️ Refund workflow: You request → Doctor approves → You process payment back to patient.
        </div>

        <div className="flex gap-3">
          <button onClick={submit} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Sending…' : 'Send to Doctor for Approval'}
          </button>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Session time override ──────────────────────────────────────────
function SessionForm({ docId, current, onClose, onSaved }) {
  const [form, setForm] = useState({ sessionStart: current?.sessionStart||'', sessionEnd: current?.sessionEnd||'', sessionNotes: current?.sessionNotes||'' });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    try { await api.put(`/doctors/${docId}/session`, form); toast.success('Session updated'); onSaved(); onClose(); }
    catch { toast.error('Failed'); } finally { setLoading(false); }
  };
  return (
    <div className="card mb-4 border" style={{ borderColor:'rgba(var(--color-primary-rgb),0.4)' }}>
      <h4 className="section-title text-sm mb-3">Override Session Times</h4>
      <div className="grid md:grid-cols-3 gap-3 mb-3">
        {[['sessionStart','Start Time','time'],['sessionEnd','End Time','time'],['sessionNotes','Notes','text']].map(([k,l,t])=>(
          <div key={k}><label className="label">{l}</label>
            <input type={t} className="input" value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} /></div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={loading} className="btn-primary text-sm">{loading?'Saving…':'Save'}</button>
        <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function StaffQueue() {
  const [params] = useSearchParams();
  const { socket } = useSocket();
  const { hospital } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [selDoc, setSelDoc] = useState(params.get('doctor') || '');
  const [selSession, setSelSession] = useState('');
  const [apts, setApts] = useState([]);
  const [queue, setQueue] = useState({ currentNumber: 0 });
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showSession, setShowSession] = useState(false);
  const [refundApt, setRefundApt] = useState(null);
  const [messageApt, setMessageApt] = useState(null);
  const sym = hospital?.payment?.currencySymbol || 'Rs.';

  // Load doctors
  useEffect(() => {
    api.get('/doctors')
      .then(({ data }) => {
        const docs = data.doctors || [];
        setDoctors(docs);
        if (!selDoc && docs[0]) setSelDoc(docs[0]._id);
      })
      .catch(err => console.error('Failed to load doctors:', err.response?.data || err.message));
  }, []);

  const fetchQ = useCallback(() => {
    if (!selDoc) return;
    setLoading(true);
    let url = `/appointments/today/${selDoc}`;
    if (selSession) url += `?sessionId=${selSession}`;
    
    api.get(url)
      .then(({ data }) => {
        setApts(data.appointments || []);
        setQueue({ currentNumber: data.currentNumber || 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selDoc, selSession]);

  useEffect(() => { fetchQ(); }, [fetchQ]);

  useEffect(() => {
    if (!socket || !selDoc || !hospital?._id) return;
    socket.emit('join_doctor_room', { hospitalId: hospital._id, doctorId: selDoc });
    const events = ['appointment_updated', 'next_called', 'appointment_booked', 'refund_approved'];
    events.forEach(e => socket.on(e, fetchQ));
    return () => events.forEach(e => socket.off(e, fetchQ));
  }, [socket, selDoc, hospital, fetchQ]);

  const callNext = async () => {
    try {
      const url = `/queue/next/${selDoc}` + (selSession ? `?sessionId=${selSession}` : '');
      const { data } = await api.post(url);
      data.nextPatient === null ? toast('Queue empty', { icon: 'ℹ️' }) : toast.success(`Now serving: #${data.currentNumber}`);
      fetchQ();
    } catch { toast.error('Failed to call next'); }
  };

  const updateStatus = async (id, status) => {
    try { await api.put(`/appointments/${id}/status`, { status }); fetchQ(); }
    catch { toast.error('Failed'); }
  };

  const markArrived = async (docId, arrived) => {
    try { await api.put(`/doctors/${docId}/arrival`, { isArrived: arrived, notify: arrived }); fetchQ(); toast.success(arrived ? 'Doctor marked arrived and patients notified' : 'Status updated'); }
    catch { toast.error('Failed'); }
  };

  const handleNotifyDelay = () => {
    const expected = prompt('Enter expected arrival time (e.g. 10:30 AM):');
    if (!expected) return;

    api.post('/appointments/notify-delay', { 
      doctorId: selDoc, 
      sessionId: selSession,
      sessionLabel: availableSessions.find(s => s._id === selSession)?.label,
      expectedTime: expected 
    })
    .then(() => toast.success('Delay notification sent to patients'))
    .catch(() => toast.error('Failed to send notification'));
  };

  const handleCancelSession = () => {
    const reason = prompt('Reason for cancellation (sent to patients):');
    if (!reason) return;
    if (!window.confirm('Are you sure? This will cancel ALL bookings for this session and notify patients.')) return;

    api.post('/appointments/cancel-session', {
      doctorId: selDoc,
      sessionId: selSession,
      sessionLabel: availableSessions.find(s => s._id === selSession)?.label,
      reason
    })
    .then(() => {
      toast.success('Session cancelled and patients notified');
      fetchQ();
    })
    .catch(() => toast.error('Cancellation failed'));
  };

  const selectedDoctor = doctors.find(d => d._id === selDoc);
  const dayOfWeek = new Date().getDay();
  const availableSessions = selectedDoctor ? (selectedDoctor.sessions || []).filter(s => s.dayOfWeek === dayOfWeek && s.isActive) : [];

  const filteredApts = apts.filter(a => {
    if (filter === 'waiting') return ['booked','arrived'].includes(a.status);
    if (filter === 'completed') return ['completed','absent'].includes(a.status);
    if (filter === 'refunds') return a.refund?.status && a.refund.status !== 'none';
    return true;
  });

  // Counts
  const waiting   = apts.filter(a => ['booked','arrived'].includes(a.status)).length;
  const completed = apts.filter(a => a.status === 'completed').length;
  const absent    = apts.filter(a => a.status === 'absent').length;
  const refunds   = apts.filter(a => a.refund?.status && a.refund.status !== 'none').length;
  const revenue   = apts.filter(a => a.paymentStatus === 'paid').reduce((s,a) => s + (a.fees?.totalAmount||0), 0);

  return (
    <div>
      {refundApt && <RefundModal apt={refundApt} onClose={() => setRefundApt(null)} onDone={fetchQ} />}
      {messageApt && <MessageModal apt={messageApt} onClose={() => setMessageApt(null)} />}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="page-title">Queue Manager</h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>{hospital?.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Session filter if multiple sessions */}
          {availableSessions.length > 0 && (
            <select className="input w-auto h-10 py-1 text-xs font-bold" 
              style={{ background:'rgba(var(--color-primary-rgb),0.1)', borderColor:'rgba(var(--color-primary-rgb),0.3)', color:'var(--color-primary)' }}
              value={selSession} onChange={e => setSelSession(e.target.value)}>
              <option value="">All Today's Sessions</option>
              {availableSessions.map(s => <option key={s._id} value={s._id}>{s.label || s.sessionName} ({s.startTime})</option>)}
            </select>
          )}
          {/* Doctor selector */}
          <select className="input w-auto h-10" value={selDoc} onChange={e => { setSelDoc(e.target.value); setSelSession(''); }}>
            {doctors.length === 0 && <option value="">No doctors found</option>}
            {doctors.map(d => <option key={d._id} value={d._id}>{d.name} — {d.specialization}</option>)}
          </select>
          <Link to="/staff/booking" className="btn-primary text-sm whitespace-nowrap h-10 flex items-center">+ Book Patient</Link>
        </div>
      </div>

      {/* Doctor status bar */}
      {selectedDoctor && (
        <div className="card mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
                style={{ background: selectedDoctor.todayStatus?.isArrived ? '#10b981' : '#f59e0b' }}>
                {(selectedDoctor.name||'D').replace('Dr. ','').charAt(0)}
              </div>
              <div>
                <p className="font-bold text-white">{selectedDoctor.name}</p>
                <p className="text-xs" style={{ color: selectedDoctor.todayStatus?.isArrived ? '#10b981' : '#f59e0b' }}>
                  {selectedDoctor.todayStatus?.isArrived ? '● Arrived — Session Active' : '○ Not yet arrived'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap ml-auto">
              {!selectedDoctor.todayStatus?.isArrived
                ? <button onClick={() => markArrived(selDoc, true)} className="text-xs px-3 py-2 rounded-xl font-medium" style={{ background:'rgba(16,185,129,0.15)',color:'#10b981' }}>✓ Mark Arrived</button>
                : <button onClick={() => markArrived(selDoc, false)} className="text-xs px-3 py-2 rounded-xl" style={{ background:'rgba(239,68,68,0.1)',color:'#ef4444' }}>Mark Left</button>
              }
              {selSession && (
                <>
                  <button onClick={handleNotifyDelay} className="text-xs px-3 py-2 rounded-xl font-medium border border-amber-500/30 text-amber-500 hover:bg-amber-500/10">Notify Delay</button>
                  <button onClick={handleCancelSession} className="text-xs px-3 py-2 rounded-xl font-medium border border-red-500/30 text-red-500 hover:bg-red-500/10">Cancel Session</button>
                </>
              )}
              <button onClick={() => setShowSession(s=>!s)} className="btn-ghost text-xs">⏰ Session Times</button>
              <button onClick={callNext}
                className="text-sm px-5 py-2 rounded-xl font-bold transition-all"
                style={{ background:'var(--color-primary)',color:'white' }}>
                ▶ Call Next {selSession ? ' (Session)' : ''}
              </button>
            </div>
          </div>
          {showSession && <div className="mt-4"><SessionForm docId={selDoc} current={selectedDoctor.todayStatus} onClose={() => setShowSession(false)} onSaved={fetchQ} /></div>}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[['Waiting',waiting,'#f59e0b'],['Current',queue.currentNumber,'var(--color-primary)'],
          ['Done',completed,'#10b981'],['Absent',absent,'#6b7280'],
          ['Revenue',fMoney(revenue,sym),'#6366f1']].map(([l,v,c])=>(
          <div key={l} className="stat-card py-3">
            <p className="stat-value text-xl md:text-2xl" style={{ color:c }}>{v}</p>
            <p className="stat-label">{l}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[['all','All',apts.length],['waiting','Waiting',waiting],['completed','Completed',completed],['refunds','Refunds',refunds]].map(([k,l,count])=>(
          <button key={k} onClick={()=>setFilter(k)}
            className="px-4 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={{ background:filter===k?'var(--color-primary)':'var(--color-surface)', color:filter===k?'white':'var(--color-text-muted)' }}>
            {l} {count>0&&<span className="ml-1 text-xs opacity-70">({count})</span>}
          </button>
        ))}
      </div>

      {/* Queue list */}
      {loading ? (
        <div className="text-center py-10" style={{ color:'var(--color-text-muted)' }}>Loading queue…</div>
      ) : filteredApts.length === 0 ? (
        <div className="card text-center py-12" style={{ color:'var(--color-text-muted)' }}>
          <div className="text-4xl mb-2">🔢</div>
          <p>No patients in this category</p>
          {filter === 'all' && <Link to="/staff/booking" className="btn-primary mt-4 inline-block text-sm">+ Book a Patient</Link>}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr style={{ background:'var(--color-surface2)', borderBottom:'1px solid var(--color-border)' }}>
                  {['#','Patient','Session','Status','Payment','Actions'].map(h=>(
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredApts.map(apt => {
                  const isCurrent = apt.status === 'in-progress';
                  return (
                    <tr key={apt._id}
                      style={{ borderBottom:'1px solid var(--color-border)', background: isCurrent ? 'rgba(var(--color-primary-rgb),0.06)' : 'transparent' }}>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          {apt.isEmergency && <span title="Emergency" className="text-red-500 text-xs">🚨</span>}
                          <span className="font-bold text-white">#{apt.queueNumber}</span>
                          {isCurrent && <span className="text-xs px-1.5 py-0.5 rounded-full animate-pulse"
                            style={{ background:'rgba(var(--color-primary-rgb),0.2)',color:'var(--color-primary)' }}>LIVE</span>}
                        </div>
                      </td>
                      <td className="table-cell">
                        <p className="text-white font-medium">{apt.patient?.name}</p>
                        <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{apt.patient?.phone}</p>
                      </td>
                      <td className="table-cell">
                        <p className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>{apt.sessionLabel || 'General'}</p>
                      </td>
                      <td className="table-cell">
                        <span className={statusBadge(apt.status)}>{statusLabel(apt.status)}</span>
                      </td>
                      <td className="table-cell">
                        <span className="text-xs px-2 py-0.5 rounded-full capitalize"
                          style={{ background: apt.paymentStatus==='paid'?'rgba(16,185,129,0.1)':'rgba(255,255,255,0.05)', color: apt.paymentStatus==='paid'?'#10b981':'var(--color-text-muted)' }}>
                          {apt.paymentStatus}
                        </span>
                      </td>
                      <td className="table-cell">
                        <StatusActions apt={apt} onUpdate={updateStatus} onRefundRequest={setRefundApt} onSendMessage={setMessageApt} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
