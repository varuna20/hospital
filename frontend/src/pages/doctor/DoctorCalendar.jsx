import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import moment from 'moment';

export default function DoctorCalendar() {
  const { user, hospital } = useAuth();
  const [counts, setCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [selDay, setSelDay] = useState(null);
  const [request, setRequest] = useState({ type: 'cancel', reason: '', proposedDate: '' });
  
  const doctorId = user?.doctorProfile?._id || user?.doctorProfile;

  const load = useCallback(async () => {
    if (!doctorId) return;
    try {
      const { data } = await api.get(`/doctors/${doctorId}/calendar-counts`);
      setCounts(data.counts || []);
    } catch {} finally { setLoading(false); }
  }, [doctorId]);

  useEffect(() => { load(); }, [load]);

  const days = [];
  for (let i = 0; i < 30; i++) {
    days.push(moment().add(i, 'days'));
  }

  const getDayCounts = (dateStr) => {
    return counts.filter(c => c._id.date === dateStr);
  };

  const submitRequest = async () => {
    if (!request.reason) return toast.error('Please provide a reason');
    try {
      await api.post('/doctors/request-change', {
        doctorId,
        ...request,
        date: selDay.date,
        sessionId: selDay.sessionId,
        sessionLabel: selDay.sessionLabel
      });
      toast.success('Request sent to staff');
      setShowRequest(false);
    } catch { toast.error('Failed to send request'); }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">Session Calendar</h1>
          <p className="text-sm text-muted">View upcoming bookings and manage your availability</p>
        </div>
        <button onClick={() => window.history.back()} className="btn-ghost text-sm">← Back to Dashboard</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {days.map((day, i) => {
          const dateStr = day.format('YYYY-MM-DD');
          const dayCounts = getDayCounts(dateStr);
          const isToday = i === 0;

          return (
            <div key={dateStr} className={`card p-3 flex flex-col min-h-[140px] transition-all hover:border-primary/50 cursor-default ${day.day() === 0 ? 'bg-red-500/5 border-red-500/20' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isToday ? 'bg-primary text-white' : 'bg-white/5 text-muted'}`}>
                  {day.format('D')}
                </span>
                <span className="text-[10px] uppercase font-bold text-muted">{day.format('ddd')}</span>
              </div>
              
              <div className="flex-1 space-y-1">
                {dayCounts.length > 0 ? dayCounts.map(c => (
                  <div key={c._id.sessionId} className="group relative">
                    <button onClick={() => { setSelDay({ date: dateStr, ...c._id, sessionLabel: c.label }); setShowRequest(true); }}
                      className="w-full text-left p-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all">
                      <p className="text-[10px] font-bold text-primary truncate">{c.label || 'Session'}</p>
                      <p className="text-xs font-black text-white">{c.count} Booked</p>
                    </button>
                  </div>
                )) : (
                  <p className="text-[10px] text-muted italic text-center mt-4">No bookings</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setShowRequest(false)}>
          <div className="card max-w-md w-full shadow-2xl border-primary/20">
            <h3 className="section-title mb-1">Request Session Change</h3>
            <p className="text-xs text-muted mb-4">{moment(selDay.date).format('LL')} — {selDay.sessionLabel}</p>
            
            <div className="space-y-4">
              <div>
                <label className="label">Request Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setRequest({...request, type:'cancel'})}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${request.type==='cancel' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-white/5 border-white/10 text-muted'}`}>
                    ❌ Cancel Session
                  </button>
                  <button onClick={() => setRequest({...request, type:'reschedule'})}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${request.type==='reschedule' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-white/5 border-white/10 text-muted'}`}>
                    ⏳ Reschedule
                  </button>
                </div>
              </div>

              {request.type === 'reschedule' && (
                <div>
                  <label className="label">Proposed New Date</label>
                  <input type="date" className="input text-sm" min={moment().format('YYYY-MM-DD')}
                    onChange={e => setRequest({...request, proposedDate: e.target.value})} />
                </div>
              )}

              <div>
                <label className="label">Reason</label>
                <textarea className="input text-sm min-h-[80px]" placeholder="Brief reason for the change..."
                  value={request.reason} onChange={e => setRequest({...request, reason: e.target.value})} />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={submitRequest} className="btn-primary flex-1">Send Request</button>
                <button onClick={() => setShowRequest(false)} className="btn-ghost">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
