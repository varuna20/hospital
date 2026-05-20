import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import moment from 'moment';
import { todayISO, fMoney, waitEstimateFromMins } from '../../utils/helpers';

export default function StaffBooking() {
  const { hospital } = useAuth();
  const hid = hospital?._id;
  const sym = hospital?.payment?.currencySymbol || 'Rs.';
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selPatient, setSelPatient] = useState(null);
  const [availableSessions, setAvailableSessions] = useState([]);
  const [form, setForm] = useState({ 
    doctorId: '', 
    appointmentDate: todayISO(), 
    sessionId: '',
    sessionLabel: '',
    name: '', 
    phone: '', 
    reason: '', 
    isEmergency: false 
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [calendarCounts, setCalendarCounts] = useState([]);

  useEffect(() => {
    api.get('/doctors')
      .then(({ data }) => setDoctors(data.doctors || []))
      .catch(err => console.error('Failed to load doctors:', err.response?.data || err.message));
  }, []);

  // Fetch sessions when doctor or date changes
  useEffect(() => {
    if (!form.doctorId || !form.appointmentDate) {
      setAvailableSessions([]);
      return;
    }
    const doc = doctors.find(d => d._id === form.doctorId);
    if (!doc) return;

    const dayOfWeek = new Date(form.appointmentDate).getDay();
    const sessions = (doc.sessions || []).filter(s => s.dayOfWeek === dayOfWeek && s.isActive);
    setAvailableSessions(sessions);
    
    // Fetch counts
    api.get(`/doctors/${form.doctorId}/calendar-counts`)
      .then(({ data }) => setCalendarCounts(data.counts || []))
      .catch(() => {});

    // Auto-select first session if only one exists
    if (sessions.length === 1) {
      const s = sessions[0];
      const sid = s._id || `${s.sessionName}-${s.startTime}`;
      setForm(f => ({ ...f, sessionId: sid, sessionLabel: s.label || s.sessionName }));
    } else {
      setForm(f => ({ ...f, sessionId: '', sessionLabel: '' }));
    }
  }, [form.doctorId, form.appointmentDate, doctors]);

  const getDayStatus = (d) => {
    if (!form.doctorId) return 'none';
    const doc = doctors.find(x => x._id === form.doctorId);
    if (!doc) return 'none';

    const dStr = d.format('YYYY-MM-DD');
    
    // 1. Vacation Check
    if (doc.vacation?.enabled) {
      const isIndefinite = doc.vacation.untilFurtherNotice;
      const inRange = doc.vacation.startDate && doc.vacation.endDate && 
                      d.isSameOrAfter(moment(doc.vacation.startDate), 'day') && 
                      d.isSameOrBefore(moment(doc.vacation.endDate), 'day');
      if (isIndefinite || inRange) return 'vacation';
    }

    // 2. Check if doctor comes on this day
    const dayOfWeek = d.day();
    const daySessions = (doc.sessions || []).filter(s => s.dayOfWeek === dayOfWeek && s.isActive);
    if (daySessions.length === 0) return 'off';

    // 3. Check if all sessions are full
    const dayCounts = calendarCounts.filter(c => c._id.date === dStr);
    const allFull = daySessions.every(s => {
      const countObj = dayCounts.find(c => c._id.sessionId === (s._id || `${s.sessionName}-${s.startTime}`));
      return (countObj?.count || 0) >= s.maxPatients;
    });

    return allFull ? 'full' : 'available';
  };

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/patients/search?q=${search}&hospitalId=${hid}`).then(({ data }) => setSearchResults(data.patients || []));
    }, 300);
    return () => clearTimeout(t);
  }, [search, hid]);

  const pickPatient = p => { 
    setSelPatient(p); 
    setForm(f => ({ ...f, name: p.name, phone: p.phone })); 
    setSearchResults([]); 
    setSearch(p.name); 
  };

  const handleBook = async e => {
    e.preventDefault();
    if (!form.doctorId) { toast.error('Select a doctor'); return; }
    if (availableSessions.length > 0 && !form.sessionId) { toast.error('Select a session'); return; }
    
    setLoading(true);
    try {
      const payload = { 
        doctorId: form.doctorId, 
        appointmentDate: form.appointmentDate, 
        sessionId: form.sessionId,
        sessionLabel: form.sessionLabel,
        hospitalId: hid, 
        reason: form.reason, 
        isEmergency: form.isEmergency 
      };
      
      if (selPatient) payload.patientId = selPatient._id;
      else { 
        if (!form.name || !form.phone) { 
          toast.error('Enter patient name and phone'); 
          setLoading(false); 
          return; 
        } 
        payload.name = form.name; 
        payload.phone = form.phone; 
      }
      
      const { data } = await api.post('/appointments/book', payload);
      setResult(data);
      toast.success(`Booked! Queue #${data.queueNumber}`);
    } catch (err) { 
      toast.error(err.response?.data?.message || 'Booking failed'); 
    } finally { 
      setLoading(false); 
    }
  };

  const reset = () => { 
    setResult(null); 
    setSelPatient(null); 
    setSearch(''); 
    setForm({ 
      doctorId: '', 
      appointmentDate: todayISO(), 
      sessionId: '',
      sessionLabel: '',
      name: '', 
      phone: '', 
      reason: '', 
      isEmergency: false 
    }); 
  };

  const selDoctor = doctors.find(d => d._id === form.doctorId);

  if (result) {
    return (
      <div>
        <h1 className="page-title mb-6">New Booking</h1>
        <div className="max-w-md">
          <div className="card text-center">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-white mb-1">Booking Confirmed!</h2>
            <div className="text-6xl font-bold my-4" style={{ color: 'var(--color-primary)', fontFamily: 'Sora,sans-serif' }}>
              {result.queueNumber}
            </div>
            <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Session: {result.appointment?.sessionLabel || 'General'}
            </p>
            <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>Estimated wait: {waitEstimateFromMins(result.estimatedWaitMinutes)}</p>
            {result.fees?.totalAmount > 0 && (
              <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--color-surface2)' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-muted)' }}>Doctor Fee</span>
                  <span style={{ color: '#6366f1' }}>{fMoney(result.fees.doctorFee, sym)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--color-text-muted)' }}>Hospital Charge</span>
                  <span style={{ color: 'var(--color-primary)' }}>{fMoney(result.fees.hospitalCharge, sym)}</span>
                </div>
                <div className="flex justify-between font-bold border-t mt-1.5 pt-1.5" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="text-white">Total</span>
                  <span className="text-white">{fMoney(result.fees.totalAmount, sym)}</span>
                </div>
              </div>
            )}
            {result.guestToken && (
              <div className="text-xs p-2 rounded-lg mb-4 break-all" style={{ background: 'var(--color-surface2)', color: 'var(--color-text-muted)' }}>
                Tracking link: /queue-status/{result.guestToken}
              </div>
            )}
            <button onClick={reset} className="btn-primary w-full">+ New Booking</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title mb-6">New Booking</h1>
      <div className="max-w-2xl">
        <form onSubmit={handleBook} className="space-y-4">

          {/* Patient search */}
          <div className="card">
            <h3 className="section-title mb-4">Patient Information</h3>
            <div className="relative mb-3">
              <label className="label">Search Existing Patient</label>
              <input className="input" placeholder="Search by name or phone…" value={search}
                onChange={e => { setSearch(e.target.value); setSelPatient(null); }} />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl overflow-hidden shadow-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  {searchResults.map(p => (
                    <button key={p._id} type="button" onClick={() => pickPatient(p)}
                      className="w-full text-left px-4 py-3 transition-all"
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <p className="text-white text-sm font-medium">{p.name}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{p.phone}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selPatient && (
              <div className="flex items-center justify-between rounded-xl px-4 py-2 mb-3" style={{ background: 'rgba(var(--color-primary-rgb),0.1)', border: '1px solid rgba(var(--color-primary-rgb),0.3)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>✓ {selPatient.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{selPatient.phone}</p>
                </div>
                <button type="button" onClick={() => { setSelPatient(null); setSearch(''); }} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Change</button>
              </div>
            )}
            {!selPatient && (
              <div className="grid grid-cols-2 gap-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <div><label className="label">Name *</label><input className="input" placeholder="Full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="label">Phone *</label><input className="input" placeholder="+94 77…" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
            )}
          </div>

          {/* Appointment details */}
          <div className="card">
            <h3 className="section-title mb-4">Appointment Details</h3>
            <div className="mb-4">
              <label className="label">Doctor *</label>
              <select className="input" value={form.doctorId} onChange={e => setForm(f => ({ ...f, doctorId: e.target.value }))}>
                <option value="">Select Doctor</option>
                {doctors.map(d => <option key={d._id} value={d._id}>{d.name} — {d.specialization}</option>)}
              </select>
            </div>

            <div className="mb-6">
              <label className="label">Select Date *</label>
              <div className="grid grid-cols-7 gap-1 mt-2">
                {['S','M','T','W','T','F','S'].map((day,idx) => (
                  <div key={`header-${idx}`} className="text-[10px] font-bold text-center opacity-30 py-1">{day}</div>
                ))}
                {Array.from({ length: moment().day() }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: 28 }).map((_, i) => {
                  const d = moment().add(i, 'days');
                  const dStr = d.format('YYYY-MM-DD');
                  const isSelected = form.appointmentDate === dStr;
                  const isToday = i === 0;
                  const status = getDayStatus(d);
                  
                  let bgColor = 'var(--color-surface2)';
                  let borderColor = isToday ? 'rgba(255,255,255,0.3)' : 'var(--color-border)';
                  let dotColor = 'transparent';

                  if (status === 'available') {
                    dotColor = '#22c55e'; // Green
                    bgColor = 'rgba(34,197,94,0.05)';
                    if (isSelected) { bgColor = 'rgba(34,197,94,0.2)'; borderColor = '#22c55e'; }
                  } else if (status === 'full' || status === 'off' || status === 'vacation') {
                    dotColor = '#ef4444'; // Red
                    bgColor = 'rgba(239,68,68,0.05)';
                    if (isSelected) { bgColor = 'rgba(239,68,68,0.2)'; borderColor = '#ef4444'; }
                  }

                  const dayCounts = calendarCounts.filter(c => c._id.date === dStr);
                  const totalBooked = dayCounts.reduce((sum, c) => sum + (c.count || 0), 0);
                  const dayOfWeek = d.day();
                  const daySessions = (doc?.sessions || []).filter(s => s.dayOfWeek === dayOfWeek && s.isActive);
                  const maxDayCapacity = daySessions.reduce((sum, s) => sum + (s.maxPatients || 0), 0);

                  return (
                    <button key={dStr} type="button" onClick={() => setForm(f => ({ ...f, appointmentDate: dStr }))}
                      style={{
                        aspectRatio: '1/1', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        background: isToday && !isSelected ? 'rgba(255,255,255,0.1)' : bgColor, border: `1.5px solid ${borderColor}`, cursor: 'pointer', transition: 'all 0.2s', position: 'relative', gap: 2
                      }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isSelected || isToday ? 'white' : 'rgba(255,255,255,0.7)' }}>{d.format('D')}</span>
                      {maxDayCapacity > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 600, color: isSelected || isToday ? 'white' : 'var(--color-text-muted)' }}>
                          {totalBooked}/{maxDayCapacity}
                        </span>
                      )}
                      <div style={{ 
                        width: 6, height: 6, borderRadius: '50%', background: dotColor,
                        boxShadow: dotColor !== 'transparent' ? `0 0 8px ${dotColor}` : 'none',
                        marginTop: 2
                      }}></div>
                      {isSelected && <div style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, background: 'var(--color-primary)', borderRadius: '50%', border: '2px solid var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'black' }}>✓</div>}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-3 px-1">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#22c55e]"></div><span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Available</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ef4444]"></div><span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Full / Unavailable</span></div>
              </div>
            </div>

            {selDoctor?.vacation?.enabled && (() => {
              const bDate = moment(form.appointmentDate);
              const isIndefinite = selDoctor.vacation.untilFurtherNotice;
              const inRange = selDoctor.vacation.startDate && selDoctor.vacation.endDate && 
                              bDate.isSameOrAfter(moment(selDoctor.vacation.startDate), 'day') && 
                              bDate.isSameOrBefore(moment(selDoctor.vacation.endDate), 'day');
              
              if (isIndefinite || inRange) {
                return (
                  <div className="rounded-xl p-4 mb-3 border border-red-500/30 text-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <p className="text-xl mb-1">🏖️</p>
                    <p className="text-sm font-bold text-white">Dr. {selDoctor.name.replace('Dr. ','')} is on Vacation</p>
                    <p className="text-xs text-red-400 mt-1">{selDoctor.vacation.note || 'No bookings allowed.'}</p>
                  </div>
                );
              }
              return null;
            })()}

            {availableSessions.length > 0 && !(() => {
              const bDate = moment(form.appointmentDate);
              const isIndefinite = selDoctor?.vacation?.untilFurtherNotice;
              const inRange = selDoctor?.vacation?.startDate && selDoctor?.vacation?.endDate && 
                              bDate.isSameOrAfter(moment(selDoctor.vacation.startDate), 'day') && 
                              bDate.isSameOrBefore(moment(selDoctor.vacation.endDate), 'day');
              return selDoctor?.vacation?.enabled && (isIndefinite || inRange);
            })() && (
              <div className="mb-3">
                <label className="label">Available Sessions *</label>
                <div className="grid grid-cols-3 gap-2">
                  {availableSessions.map((s, i) => {
                    const sid = s._id || `${s.sessionName}-${s.startTime}`;
                    const isSelected = form.sessionId === sid;
                    return (
                      <button key={s._id || i} type="button" 
                        onClick={() => setForm(f => ({ ...f, sessionId: sid, sessionLabel: s.label || s.sessionName }))}
                        className="px-3 py-2 rounded-xl text-xs font-medium border transition-all text-center flex flex-col items-center justify-center"
                        style={{ 
                          background: isSelected ? 'var(--color-primary)' : 'var(--color-surface2)',
                          borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                          color: isSelected ? 'black' : 'white'
                        }}>
                        <span className="font-bold">{s.label || s.sessionName}</span>
                        <span className="opacity-60 text-[10px] mt-0.5">{s.startTime}</span>
                        
                        {(() => {
                          const bDate = moment(form.appointmentDate).format('YYYY-MM-DD');
                          const dayCounts = calendarCounts.filter(c => c._id.date === bDate);
                          const countObj = dayCounts.find(c => c._id.sessionId === sid);
                          const currentCount = countObj?.count || 0;
                          const maxCount = s.maxPatients || 0;
                          return maxCount > 0 ? (
                            <div className="mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold" 
                              style={{
                                background: isSelected ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)',
                                color: currentCount >= maxCount ? (isSelected ? '#ef4444' : '#f87171') : (isSelected ? 'black' : 'var(--color-primary)')
                              }}>
                              {currentCount} / {maxCount} Booked
                            </div>
                          ) : null;
                        })()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-3"><label className="label">Reason</label>
              <textarea className="input resize-none" rows={2} placeholder="Chief complaint…" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} /></div>

            {/* Fee preview */}
            {selDoctor && (selDoctor.fees?.doctorFee > 0 || selDoctor.fees?.hospitalCharge > 0) && (
              <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--color-surface2)' }}>
                <p className="text-xs mb-2 font-semibold" style={{ color: 'var(--color-text-muted)' }}>FEE BREAKDOWN</p>
                {[['Doctor Fee', selDoctor.fees.doctorFee, '#6366f1'], ['Hospital Charge', selDoctor.fees.hospitalCharge, 'var(--color-primary)'],
                  ['Total Patient Pays', (selDoctor.fees.doctorFee + selDoctor.fees.hospitalCharge), 'white']].map(([l, v, c], i) => (
                  <div key={l} className={`flex justify-between text-sm ${i === 2 ? 'font-bold pt-1.5 mt-1.5 border-t' : ''}`} style={i === 2 ? { borderColor: 'var(--color-border)' } : {}}>
                    <span style={{ color: i === 2 ? 'white' : 'var(--color-text-muted)' }}>{l}</span>
                    <span style={{ color: c }}>{fMoney(v, sym)}</span>
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setForm(f => ({ ...f, isEmergency: !f.isEmergency }))}
                className="relative w-10 h-6 rounded-full transition-colors"
                style={{ background: form.isEmergency ? '#ef4444' : 'var(--color-surface2)' }}>
                <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform: form.isEmergency ? 'translateX(18px)' : 'translateX(4px)' }} />
              </div>
              <span className="text-sm text-white">Emergency case <span style={{ color: 'var(--color-text-muted)' }}>(prioritize in queue)</span></span>
            </label>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Booking…</> : '📅 Confirm Booking'}
          </button>
        </form>
      </div>
    </div>
  );
}
