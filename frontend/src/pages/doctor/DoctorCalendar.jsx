import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import moment from 'moment';

export default function DoctorCalendar() {
  const { user, hospital } = useAuth();
  const [counts, setCounts] = useState([]);
  const [hospitalsList, setHospitalsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [showRequest, setShowRequest] = useState(false);
  const [selDay, setSelDay] = useState(null);
  const [request, setRequest] = useState({ type: 'cancel', reason: '', proposedDate: '' });
  
  const doctorId = user?.doctorProfile?._id || user?.doctorProfile;

  const load = useCallback(async () => {
    if (!doctorId) return;
    try {
      const [countsRes, hospRes] = await Promise.all([
        api.get(`/doctors/${doctorId}/calendar-counts`),
        api.get('/hospitals')
      ]);
      setCounts(countsRes.data.counts || []);
      setHospitalsList(hospRes.data.hospitals || []);
    } catch {} finally { setLoading(false); }
  }, [doctorId]);

  useEffect(() => { load(); }, [load]);

  const days = [];
  for (let i = 0; i < 30; i++) {
    days.push(moment().add(i, 'days'));
  }

  const getDaySessions = (dateStr) => {
    const dayOfWeek = moment(dateStr).day();
    const docSessions = user?.doctorProfile?.sessions || [];
    const dayCounts = counts.filter(c => c._id.date === dateStr);

    const activeSessions = docSessions.filter(s => s.dayOfWeek === dayOfWeek);

    return activeSessions.map(session => {
      const sessHospId = session.hospitalId?._id || session.hospitalId;
      const matchCount = dayCounts.find(c => c._id.hospitalId?.toString() === sessHospId?.toString());
      
      const resolvedHosp = matchCount?.hospital || 
                           (typeof session.hospitalId === 'object' && session.hospitalId !== null && session.hospitalId.name ? session.hospitalId : null) ||
                           hospitalsList.find(h => h._id?.toString() === sessHospId?.toString());

      return {
        _id: session._id,
        sessionName: session.sessionName || 'Session',
        startTime: session.startTime,
        endTime: session.endTime,
        hospital: resolvedHosp,
        count: matchCount ? matchCount.count : 0
      };
    });
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

  const selectedDaySessions = getDaySessions(selectedDate);

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
          const daySessions = getDaySessions(dateStr);
          const isToday = i === 0;
          const isSelected = selectedDate === dateStr;
          const hasBookings = daySessions.some(s => s.count > 0);

          return (
            <div 
              key={dateStr} 
              onClick={() => setSelectedDate(dateStr)}
              className={`card p-3 flex flex-col min-h-[150px] transition-all cursor-pointer ${
                isSelected 
                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5' 
                  : hasBookings
                    ? 'border-emerald-500/40 bg-emerald-500/5 shadow-md shadow-emerald-500/5 hover:border-emerald-400'
                    : 'hover:border-primary/50'
              } ${day.day() === 0 ? 'bg-red-500/5 border-red-500/20' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isToday 
                    ? 'bg-primary text-white' 
                    : hasBookings 
                      ? 'bg-emerald-500 text-white font-extrabold' 
                      : 'bg-white/5 text-muted'
                }`}>
                  {day.format('D')}
                </span>
                <span className="text-[10px] uppercase font-bold text-muted">{day.format('ddd')}</span>
              </div>
              
              <div className="flex-1 space-y-1">
                {daySessions.length > 0 ? daySessions.map((s, idx) => {
                  const sHasBooking = s.count > 0;
                  return (
                    <div key={idx} className="group relative">
                      <div className={`w-full text-left p-1.5 rounded-lg border transition-all ${
                        sHasBooking
                          ? 'bg-emerald-500/10 border-emerald-500/35 hover:bg-emerald-500/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}>
                        <p className={`text-[10px] font-bold truncate ${sHasBooking ? 'text-emerald-400' : 'text-white/70'}`}>
                          {s.sessionName}
                        </p>
                        <p className={`text-[9px] truncate font-semibold ${sHasBooking ? 'text-emerald-100/50' : 'text-white/40'}`}>
                          🏥 {s.hospital?.shortName || s.hospital?.name || 'Hospital'}
                        </p>
                        <p className={`text-xs font-black mt-0.5 ${sHasBooking ? 'text-emerald-300' : 'text-white/40'}`}>
                          {sHasBooking ? `🟢 ${s.count} Booked` : '0 Booked'}
                        </p>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-[10px] text-muted italic text-center mt-4">Off Day</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Day Details Section */}
      <div className="card mt-6 border-2" style={{ borderColor: 'var(--color-primary)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="section-title text-base mb-0">📅 Scheduled Sessions on {moment(selectedDate).format('dddd, MMMM D, YYYY')}</h2>
            <p className="text-xs text-muted">Click any date on the calendar above to view its sessions.</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary">
            {selectedDaySessions.length} active sessions
          </span>
        </div>

        {selectedDaySessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedDaySessions.map((s, idx) => {
              const hospName = s.hospital?.name || hospital?.name || 'Assigned Hospital';
              const hospCity = s.hospital?.city || hospital?.city || '';
              const timeStr = `${s.startTime} - ${s.endTime}`;

              const sHasBooking = s.count > 0;
              return (
                <div 
                  key={idx} 
                  className="p-4 rounded-xl border flex flex-col justify-between transition-all" 
                  style={{ 
                    borderColor: sHasBooking ? 'rgba(16,185,129,0.45)' : 'var(--color-border)', 
                    background: sHasBooking ? 'rgba(16,185,129,0.06)' : 'var(--color-surface2)',
                    boxShadow: sHasBooking ? '0 10px 15px -3px rgba(16,185,129,0.1)' : 'none'
                  }}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className={`text-xs font-black ${sHasBooking ? 'text-emerald-400' : 'text-white'}`}>{s.sessionName}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border transition-all ${
                        sHasBooking 
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                          : 'bg-white/5 text-muted border-transparent'
                      }`}>
                        {sHasBooking ? `🟢 ${s.count} Booked Patients` : '0 Booked Patients'}
                      </span>
                    </div>
                    
                    <p className={`text-sm font-black mb-1 ${sHasBooking ? 'text-emerald-50/90' : 'text-white/90'}`}>🏥 {hospName}</p>
                    {hospCity && (
                      <p className="text-xs text-muted mb-2">Location: {hospCity}</p>
                    )}

                    {timeStr && (
                      <p className={`text-xs font-bold mb-3 ${sHasBooking ? 'text-emerald-400' : 'text-primary'}`}>⏰ Consulting Time: {timeStr}</p>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelDay({ date: selectedDate, sessionId: s._id, sessionLabel: s.sessionName });
                      setShowRequest(true);
                    }}
                    className="w-full py-2 rounded-xl text-xs font-bold text-center border transition-all mt-2"
                    style={{ background: 'rgba(var(--color-primary-rgb),0.08)', borderColor: 'rgba(var(--color-primary-rgb),0.2)', color: 'var(--color-primary)' }}
                  >
                    ⏳ Request Reschedule / Cancel
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10">
            <span className="text-3xl block mb-2">🏝️</span>
            <p className="text-xs text-muted italic">No consulting appointments or sessions booked for this date.</p>
          </div>
        )}
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
