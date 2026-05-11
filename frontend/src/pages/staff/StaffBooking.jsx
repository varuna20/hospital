import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { todayISO, fMoney } from '../../utils/helpers';

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
    
    // Auto-select first session if only one exists
    if (sessions.length === 1) {
      const s = sessions[0];
      const sid = s._id || `${s.sessionName}-${s.startTime}`;
      setForm(f => ({ ...f, sessionId: sid, sessionLabel: s.label || s.sessionName }));
    } else {
      setForm(f => ({ ...f, sessionId: '', sessionLabel: '' }));
    }
  }, [form.doctorId, form.appointmentDate, doctors]);

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
            <p className="text-sm mb-2" style={{ color: 'var(--color-text-muted)' }}>Estimated wait: ~{result.estimatedWaitMinutes} mins</p>
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
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="label">Doctor *</label>
                <select className="input" value={form.doctorId} onChange={e => setForm(f => ({ ...f, doctorId: e.target.value }))}>
                  <option value="">Select Doctor</option>
                  {doctors.map(d => <option key={d._id} value={d._id}>{d.name} — {d.specialization}</option>)}
                </select>
              </div>
              <div><label className="label">Date *</label>
                <input type="date" className="input" value={form.appointmentDate} min={todayISO()} onChange={e => setForm(f => ({ ...f, appointmentDate: e.target.value }))} />
              </div>
            </div>

            {availableSessions.length > 0 && (
              <div className="mb-3">
                <label className="label">Available Sessions *</label>
                <div className="grid grid-cols-3 gap-2">
                  {availableSessions.map((s, i) => {
                    const sid = s._id || `${s.sessionName}-${s.startTime}`;
                    const isSelected = form.sessionId === sid;
                    return (
                      <button key={s._id || i} type="button" 
                        onClick={() => setForm(f => ({ ...f, sessionId: sid, sessionLabel: s.label || s.sessionName }))}
                        className="px-3 py-2 rounded-xl text-xs font-medium border transition-all text-center"
                        style={{ 
                          background: isSelected ? 'var(--color-primary)' : 'var(--color-surface2)',
                          borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                          color: isSelected ? 'black' : 'white'
                        }}>
                        {s.label || s.sessionName}<br/>
                        <span className="opacity-60">{s.startTime}</span>
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
