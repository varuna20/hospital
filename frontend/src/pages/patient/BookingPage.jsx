/**
 * PATIENT BOOKING PAGE
 * =====================
 * 4-step appointment booking.
 * Supports hospital slug query param: /?hospital=city-medical
 * When accessed via a hospital's dedicated URL, it pre-selects that hospital.
 */
import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import api, { fUrl } from '../../utils/api';
import toast from 'react-hot-toast';
import moment from 'moment';
import { todayISO, fMoney, DAYS } from '../../utils/helpers';
import ChevFooter from '../../components/ChevFooter.jsx';
import { useAuth } from '../../context/AuthContext';

// Step indicator dot
function StepDot({ n, current, done }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, transition: 'all 0.3s',
        background: done ? 'var(--color-primary)' : current ? 'rgba(var(--color-primary-rgb),0.2)' : 'rgba(255,255,255,0.05)',
        color: done || current ? 'var(--color-primary)' : 'rgba(255,255,255,0.3)',
        border: current ? '2px solid var(--color-primary)' : done ? '2px solid var(--color-primary)' : '2px solid rgba(255,255,255,0.08)',
      }}>
        {done ? '✓' : n}
      </div>
    </div>
  );
}

// Step progress bar
function StepBar({ step, isIsolated }) {
  const labels = isIsolated ? ['Doctor', 'Session', 'Confirm'] : ['Hospital', 'Doctor', 'Session', 'Confirm'];
  const offset = isIsolated ? 1 : 0;
  
  return (
    <div className="flex items-center justify-between mb-8 gap-0">
      {labels.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-2 relative">
            <StepDot n={i + 1} current={step === i + offset} done={step > i + offset} />
            <span className={`hidden sm:block text-[10px] md:text-[11px] absolute -bottom-5 whitespace-nowrap ${step >= i + offset ? 'text-[var(--color-primary)] font-semibold' : 'text-white/20'}`}>
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 ${step > i + offset ? 'bg-[var(--color-primary)]' : 'bg-white/10'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// Card component for selections
function SelectCard({ selected, onClick, children, disabled }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{
      padding: '16px 20px', borderRadius: 14, cursor: disabled ? 'not-allowed' : 'pointer',
      background: selected ? 'rgba(var(--color-primary-rgb),0.1)' : 'rgba(255,255,255,0.04)',
      border: `1.5px solid ${selected ? 'var(--color-primary)' : 'rgba(255,255,255,0.08)'}`,
      transition: 'all 0.2s',
      opacity: disabled ? 0.5 : 1,
      boxShadow: selected ? '0 0 0 3px rgba(var(--color-primary-rgb),0.12)' : 'none',
    }}
    onMouseEnter={e => { if (!selected && !disabled) e.currentTarget.style.borderColor = 'rgba(var(--color-primary-rgb),0.4)'; }}
    onMouseLeave={e => { if (!selected && !disabled) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}>
      {children}
    </div>
  );
}

export default function BookingPage() {
  const { user } = useAuth();
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeSlug = slug || searchParams.get('hospital');
  const isIsolated = !!activeSlug; // If true, hide step 0

  const [searchQuery, setSearchQuery] = useState('');
  const [selCategory, setSelCategory] = useState('');
  const [hospitals, setHospitals]     = useState([]);
  const [selHospital, setSelHospital] = useState(null);
  const [doctors, setDoctors]         = useState([]);
  const [step, setStep]               = useState(isIsolated ? 1 : 0);
  const [selDoctor, setSelDoctor]     = useState(null);
  const [date, setDate]               = useState(todayISO());
  const [availableSessions, setAvailableSessions] = useState([]);
  const [selSession, setSelSession]   = useState(null);
  const [form, setForm]               = useState({ name: '', phone: '', reason: '' });
  const [loading, setLoading]         = useState(false);
  const [booking, setBooking]         = useState(null);

  const sym = selHospital?.payment?.currencySymbol || 'Rs.';

  // Apply hospital theme
  useEffect(() => {
    if (!selHospital?.theme) return;
    const r = document.documentElement;
    const t = selHospital.theme;
    if (t.primary)    r.style.setProperty('--color-primary',     t.primary);
    if (t.accent)     r.style.setProperty('--color-accent',      t.accent);
    if (t.background) r.style.setProperty('--color-bg',          t.background);
    if (t.surface)    r.style.setProperty('--color-surface',     t.surface);
    if (t.primary) {
      const h = t.primary.replace('#', '');
      const rgb = [0,2,4].map(i => parseInt(h.slice(i,i+2),16)).join(',');
      r.style.setProperty('--color-primary-rgb', rgb);
    }
  }, [selHospital]);

  // Load hospitals (or pre-select via slug)
  useEffect(() => {
    api.get('/hospitals').then(({ data }) => {
      const list = data.hospitals || [];
      setHospitals(list);
      if (activeSlug) {
        const h = list.find(x => x.slug === activeSlug);
        if (h) { 
          setSelHospital(h); 
          setStep(1); 
        } else {
          toast.error("Hospital not found.");
          navigate('/');
        }
      }
    }).catch(() => {});
  }, [activeSlug]);

  // Load doctors when hospital selected
  useEffect(() => {
    if (!selHospital?._id) return;
    api.get('/doctors?hospitalId=' + selHospital._id)
      .then(({ data }) => setDoctors(data.doctors || []))
      .catch(() => {});
  }, [selHospital]);  const categories = [...new Set(doctors.map(d => d.specialization))].sort();

  const filteredHospitals = hospitals.filter(h => 
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (h.city && h.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredDoctors = doctors.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         d.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (!selHospital && d.hospitalId?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selCategory ? d.specialization === selCategory : true;
    
    // Check vacation status
    const onVacation = d.vacation?.enabled && (
      d.vacation.untilFurtherNotice || 
      (d.vacation.startDate && d.vacation.endDate && 
       new Date() >= new Date(d.vacation.startDate) && 
       new Date() <= new Date(d.vacation.endDate))
    );
    
    return matchesSearch && matchesCat && !onVacation;
  });

  const [calendarCounts, setCalendarCounts] = useState([]);

  // Load all doctors if no hospital selected (for global search)
  useEffect(() => {
    if (step === 1 && !selHospital) {
      api.get('/doctors').then(({ data }) => setDoctors(data.doctors || []));
    }
  }, [step, selHospital]);

  // Load calendar counts and available sessions
  useEffect(() => {
    if (!selDoctor?._id) return;
    
    // Fetch counts
    api.get(`/doctors/${selDoctor._id}/calendar-counts`)
      .then(({ data }) => setCalendarCounts(data.counts || []))
      .catch(() => {});

    // Filter sessions for current date
    const dayOfWeek = moment(date).day();
    const sessions = (selDoctor.sessions || []).filter(s => s.dayOfWeek === dayOfWeek && s.isActive);
    setAvailableSessions(sessions);
    setSelSession(null);
  }, [selDoctor, date]);

  // Calendar logic for availability
  const getDayStatus = (d) => {
    const dStr = d.format('YYYY-MM-DD');
    
    // 1. Vacation Check
    if (selDoctor?.vacation?.enabled) {
      const isIndefinite = selDoctor.vacation.untilFurtherNotice;
      const inRange = selDoctor.vacation.startDate && selDoctor.vacation.endDate && 
                      d.isSameOrAfter(moment(selDoctor.vacation.startDate), 'day') && 
                      d.isSameOrBefore(moment(selDoctor.vacation.endDate), 'day');
      if (isIndefinite || inRange) return 'vacation';
    }

    // 2. Check if doctor comes on this day
    const dayOfWeek = d.day();
    const daySessions = (selDoctor?.sessions || []).filter(s => s.dayOfWeek === dayOfWeek && s.isActive);
    if (daySessions.length === 0) return 'off';

    // 3. Check if all sessions are full
    const dayCounts = calendarCounts.filter(c => c._id.date === dStr);
    const allFull = daySessions.every(s => {
      const countObj = dayCounts.find(c => c._id.sessionId === (s._id || `${s.sessionName}-${s.startTime}`));
      return (countObj?.count || 0) >= s.maxPatients;
    });

    return allFull ? 'full' : 'available';
  };

  const book = async () => {
    if (!form.name || !form.phone) return toast.error('Please enter name and phone');
    setLoading(true);
    try {
      const payload = {
        doctorId: selDoctor._id,
        hospitalId: selHospital._id,
        appointmentDate: date,
        sessionId: selSession?._id || `${selSession?.sessionName}-${selSession?.startTime}`,
        sessionLabel: selSession?.label || selSession?.sessionName,
        name: form.name,
        phone: form.phone,
        reason: form.reason
      };
      const { data } = await api.post('/appointments/book', payload);
      setBooking(data);
      toast.success('Appointment booked successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  // ── MAIN BOOKING FLOW ────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', fontFamily: 'DM Sans,sans-serif' }}>

      {/* Header */}
      <header className="border-b border-white/5 p-3 md:p-4 flex items-center justify-between shrink-0 bg-[var(--color-bg)] sticky top-0 z-10">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {selHospital?.logo ? (
            <img src={fUrl(selHospital.logo)} alt="" className="h-8 md:h-10 object-contain shrink-0" />
          ) : (
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-lg font-black text-black shrink-0">
              {selHospital ? selHospital.name.charAt(0) : '🏥'}
            </div>
          )}
          <div className="truncate">
            <p className="text-white font-bold text-sm md:text-base leading-tight truncate">
              {selHospital?.name || 'Hospital eChanneling'}
            </p>
            {selHospital?.city && <p className="text-white/40 text-[10px] md:text-xs">{selHospital.city}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => {
              if (user && user.role === 'patient') {
                navigate('/patient-dashboard');
              } else {
                navigate(selHospital ? `/login/${selHospital.slug}` : '/login');
              }
            }}
            className="px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--color-primary)',
              border: '1.5px solid rgba(var(--color-primary-rgb),0.2)',
              cursor: 'pointer'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.15)';
              e.currentTarget.style.borderColor = 'var(--color-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.borderColor = 'rgba(var(--color-primary-rgb),0.2)';
            }}
          >
            {user && user.role === 'patient' ? '👤 Dashboard' : '🔑 Patient Portal'}
          </button>
          <img src="/chevara-brand.png" alt="Chevara Labs" className="h-5 md:h-6 object-contain opacity-40 shrink-0 ml-2" />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center px-4 py-6 md:py-10">
        <div className="w-full max-w-[600px]">
          
          {booking ? (
            <div className="text-center py-10 animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6 border-2 border-primary/30">
                <span className="text-5xl">✅</span>
              </div>
              <h2 style={{ color: 'white', fontSize: 28, fontFamily: 'Sora,sans-serif', fontWeight: 800, marginBottom: 8 }}>Booking Confirmed!</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, marginBottom: 40 }}>Your appointment has been successfully scheduled.</p>
              
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: '32px 20px', marginBottom: 40 }}>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Your Queue Number</p>
                <h1 style={{ color: 'var(--color-primary)', fontSize: 72, fontFamily: 'Sora,sans-serif', fontWeight: 900, lineHeight: 1, marginBottom: 12 }}>{booking.queueNumber}</h1>
                <p style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>Estimated Wait: ~{booking.estimatedWaitMinutes} mins</p>
              </div>

              <div className="space-y-3">
                <button onClick={() => window.location.reload()}
                  style={{ width: '100%', background: 'linear-gradient(135deg, var(--color-primary), #00a8d4)', color: '#02040a', border: 'none', borderRadius: 16, padding: '16px', fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                  Make Another Booking
                </button>
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>A confirmation message has been sent to your phone.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Step bar */}
              <StepBar step={step} />

          {/* ── STEP 0: Select Hospital ── */}
          {step === 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 style={{ color: 'white', fontSize: 20, fontFamily: 'Sora,sans-serif', fontWeight: 700 }}>Select Hospital</h2>
                <button onClick={() => { setSelHospital(null); setStep(1); }} className="text-xs text-primary font-bold">Search All Doctors instead</button>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 16 }}>Choose where you'd like to book your appointment</p>
              
              <div className="relative mb-4">
                <input type="text" placeholder="Search hospital by name or city..." 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm outline-none focus:border-primary transition-all"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hospitals.length === 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 0' }}>Loading hospitals…</p>
                )}
                {filteredHospitals.map(h => (
                  <SelectCard key={h._id} selected={selHospital?._id === h._id} onClick={() => setSelHospital(h)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      {h.logo ? (
                        <img src={fUrl(h.logo)} alt="" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 10, background: h.theme?.primary || 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#02040a', flexShrink: 0 }}>
                          {h.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>{h.name}</p>
                        {h.city && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{h.city}</p>}
                      </div>
                    </div>
                  </SelectCard>
                ))}
              </div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button disabled={!selHospital} onClick={() => { setStep(1); setSearchQuery(''); }}
                  style={{ background: selHospital ? 'linear-gradient(135deg, var(--color-primary), #00a8d4)' : 'rgba(255,255,255,0.06)', color: selHospital ? '#02040a' : 'rgba(255,255,255,0.3)', border: 'none', borderRadius: 12, padding: '12px 28px', fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 15, cursor: selHospital ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                  Next: Choose Doctor →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 1: Choose Doctor ── */}
          {step === 1 && (
            <div>
              <h2 style={{ color: 'white', fontSize: 20, fontFamily: 'Sora,sans-serif', fontWeight: 700, marginBottom: 2 }}>Choose Doctor</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 16 }}>
                {selHospital ? `Available doctors at ${selHospital.name}` : 'Search across all hospitals'}
              </p>

              {/* Search & Filters */}
              <div className="space-y-3 mb-6">
                <div className="relative">
                  <input type="text" placeholder="Search by doctor name or specialization..." 
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm outline-none focus:border-primary transition-all"
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  <button onClick={() => setSelCategory('')} 
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border ${!selCategory ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                    style={{ background: !selCategory ? 'var(--color-primary)' : 'transparent' }}>
                    ALL CATEGORIES
                  </button>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setSelCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border ${selCategory === cat ? 'bg-primary border-primary text-black' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                      style={{ background: selCategory === cat ? 'var(--color-primary)' : 'transparent' }}>
                      {cat.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {filteredDoctors.length === 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 0' }}>No doctors found matching your search</p>
                )}
                {filteredDoctors.map(d => (
                  <SelectCard key={d._id} selected={selDoctor?._id === d._id} onClick={() => { setSelDoctor(d); if(!selHospital) setSelHospital(d.hospitalId); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#02040a', flexShrink: 0 }}>
                        {d.name.replace('Dr. ','').charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>{d.name}</p>
                        <p style={{ color: 'var(--color-primary)', fontSize: 13 }}>{d.specialization}</p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{!selHospital && d.hospitalId?.name ? `🏥 ${d.hospitalId.name}` : d.qualifications?.join(', ')}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>{sym} {(d.fees?.totalFee || (d.fees?.doctorFee||0) + (d.fees?.hospitalCharge||0)).toLocaleString()}</p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>per consultation</p>
                      </div>
                    </div>
                  </SelectCard>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                {!isIsolated ? (
                  <button onClick={() => setStep(0)}
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 22px', fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                    ← Back
                  </button>
                ) : <div />}
                <button disabled={!selDoctor} onClick={() => { setStep(2); setSearchQuery(''); }}
                  style={{ background: selDoctor ? 'linear-gradient(135deg, var(--color-primary), #00a8d4)' : 'rgba(255,255,255,0.06)', color: selDoctor ? '#02040a' : 'rgba(255,255,255,0.3)', border: 'none', borderRadius: 12, padding: '12px 28px', fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 15, cursor: selDoctor ? 'pointer' : 'not-allowed' }}>
                  Next: Pick Session →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Pick Session ── */}
          {step === 2 && (
            <div>
              <h2 style={{ color: 'white', fontSize: 20, fontFamily: 'Sora,sans-serif', fontWeight: 700, marginBottom: 6 }}>Pick a Session</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 20 }}>Choose a date and available session for {selDoctor?.name}</p>

              <div style={{ marginBottom: 24 }}>
                <label className="label">Select Date</label>
                <div className="grid grid-cols-7 gap-1 mt-2">
                  {['S','M','T','W','T','F','S'].map((d,i) => (
                    <div key={`header-${i}`} className="text-[10px] font-bold text-center opacity-30 py-1">{d}</div>
                  ))}
                  {Array.from({ length: moment().day() }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: 28 }).map((_, i) => {
                    const d = moment().add(i, 'days');
                    const dStr = d.format('YYYY-MM-DD');
                    const isSelected = date === dStr;
                    const isToday = i === 0;
                    const status = getDayStatus(d);
                    
                    let bgColor = 'rgba(255,255,255,0.03)';
                    let borderColor = isToday ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.05)';
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

                    return (
                      <button key={dStr} type="button" onClick={() => setDate(dStr)}
                        style={{
                          aspectRatio: '1/1', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          background: isToday && !isSelected ? 'rgba(255,255,255,0.1)' : bgColor, border: `1.5px solid ${borderColor}`, cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                          gap: 4
                        }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isSelected || isToday ? 'white' : 'rgba(255,255,255,0.7)' }}>{d.format('D')}</span>
                        {isToday && <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--color-primary)', marginTop: -4 }}>TDY</span>}
                        <div style={{ 
                          width: 6, height: 6, borderRadius: '50%', background: dotColor,
                          boxShadow: dotColor !== 'transparent' ? `0 0 8px ${dotColor}` : 'none',
                          marginTop: isToday ? 0 : 2
                        }}></div>
                        {isSelected && <div style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, background: 'var(--color-primary)', borderRadius: '50%', border: '2px solid var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'black' }}>✓</div>}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-4 mt-3 px-1">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#22c55e]"></div><span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Available</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ef4444]"></div><span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Full / Unavailable</span></div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                <label className="label">Available Sessions</label>
                {selDoctor?.vacation?.enabled && (
                  (() => {
                    const bDate = moment(date);
                    const isIndefinite = selDoctor.vacation.untilFurtherNotice;
                    const inRange = selDoctor.vacation.startDate && selDoctor.vacation.endDate && 
                                    bDate.isSameOrAfter(moment(selDoctor.vacation.startDate), 'day') && 
                                    bDate.isSameOrBefore(moment(selDoctor.vacation.endDate), 'day');
                    
                    if (isIndefinite || inRange) {
                      return (
                        <div className="card" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', padding: '20px', textAlign: 'center' }}>
                          <span className="text-3xl mb-2 block">🏖️</span>
                          <h4 className="font-bold text-white mb-1">Dr. {selDoctor.name.replace('Dr. ','')} is on Vacation</h4>
                          <p className="text-xs text-red-400">{selDoctor.vacation.note || 'No appointments available for this period.'}</p>
                          <p className="text-[10px] text-white/30 mt-4">Please try selecting another date.</p>
                        </div>
                      );
                    }
                    return null;
                  })()
                )}

                {(!selDoctor?.vacation?.enabled || !(() => {
                    const bDate = moment(date);
                    const isIndefinite = selDoctor.vacation.untilFurtherNotice;
                    const inRange = selDoctor.vacation.startDate && selDoctor.vacation.endDate && 
                                    bDate.isSameOrAfter(moment(selDoctor.vacation.startDate), 'day') && 
                                    bDate.isSameOrBefore(moment(selDoctor.vacation.endDate), 'day');
                    return isIndefinite || inRange;
                })()) && (
                  availableSessions.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '30px 20px', borderStyle: 'dashed' }}>
                      <span className="text-2xl mb-2 block">📅</span>
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No sessions scheduled for this day.</p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Try selecting another date.</p>
                    </div>
                  ) : (
                    availableSessions.map((s, i) => (
                      <SelectCard key={s._id || i} selected={(selSession?._id || `${selSession?.sessionName}-${selSession?.startTime}`) === (s._id || `${s.sessionName}-${s.startTime}`)} onClick={() => setSelSession(s)}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>{s.label || s.sessionName || 'Regular Session'}</p>
                            <p style={{ color: 'var(--color-primary)', fontSize: 13 }}>{s.startTime} - {s.endTime}</p>
                          </div>
                          <div className="text-right">
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Max: {s.maxPatients} patients</p>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{s.slotDuration} min / patient</p>
                          </div>
                        </div>
                      </SelectCard>
                    ))
                  )
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                <button onClick={() => setStep(1)}
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 22px', fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  ← Back
                </button>
                <button disabled={!selSession} onClick={() => setStep(3)}
                  style={{ background: selSession ? 'linear-gradient(135deg, var(--color-primary), #00a8d4)' : 'rgba(255,255,255,0.06)', color: selSession ? '#02040a' : 'rgba(255,255,255,0.3)', border: 'none', borderRadius: 12, padding: '12px 28px', fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 15, cursor: selSession ? 'pointer' : 'not-allowed' }}>
                  Next: Your Details →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Patient Details ── */}
          {step === 3 && (
            <div>
              <h2 style={{ color: 'white', fontSize: 20, fontFamily: 'Sora,sans-serif', fontWeight: 700, marginBottom: 6 }}>Your Details</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 20 }}>Enter your information to complete the booking</p>

              {/* Booking summary */}
              <div style={{ background: 'rgba(var(--color-primary-rgb),0.06)', border: '1px solid rgba(var(--color-primary-rgb),0.15)', borderRadius: 14, padding: '16px 18px', marginBottom: 24 }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Booking Summary</p>
                {[
                  ['Hospital', selHospital?.name],
                  ['Doctor', selDoctor?.name],
                  ['Session', selSession?.label || 'General'],
                  ['Time', `${selSession?.startTime} - ${selSession?.endTime}`],
                  ['Date', new Date(date + 'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})],
                  ['Fee', `${sym} ${((selDoctor?.fees?.doctorFee||0)+(selDoctor?.fees?.hospitalCharge||0)).toLocaleString()}`],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{l}</span>
                    <span style={{ color: 'white', fontWeight: 500, fontSize: 13, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Form fields */}
              {[
                { key: 'name', label: 'Full Name *', type: 'text', placeholder: 'Enter your full name' },
                { key: 'phone', label: 'Mobile Number *', type: 'tel', placeholder: '+94 77 123 4567' },
                { key: 'reason', label: 'Reason for Visit (optional)', type: 'text', placeholder: 'Brief description of symptoms' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</label>
                  <input type={type} placeholder={placeholder} value={form[key]}
                    onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '13px 16px', color: 'white', fontSize: 15, outline: 'none', fontFamily: 'DM Sans,sans-serif', transition: 'border 0.2s', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
              ))}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 8 }}>
                <button onClick={() => setStep(2)}
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 22px', fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  ← Back
                </button>
                <button onClick={book} disabled={loading || !form.name || !form.phone}
                  style={{ background: loading || !form.name || !form.phone ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, var(--color-primary), #00a8d4)', color: loading || !form.name || !form.phone ? 'rgba(255,255,255,0.3)' : '#02040a', border: 'none', borderRadius: 12, padding: '12px 28px', fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 15, cursor: loading || !form.name || !form.phone ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                  {loading ? 'Booking…' : '✓ Confirm Booking'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </div>

      <ChevFooter />
    </div>
  );
}
