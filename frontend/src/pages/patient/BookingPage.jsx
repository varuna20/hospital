/**
 * PATIENT BOOKING PAGE
 * =====================
 * 4-step appointment booking.
 * Supports hospital slug query param: /?hospital=city-medical
 * When accessed via a hospital's dedicated URL, it pre-selects that hospital.
 */
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { fUrl } from '../../utils/api';
import toast from 'react-hot-toast';
import { todayISO, fMoney, DAYS } from '../../utils/helpers';
import ChevFooter from '../../components/ChevFooter.jsx';

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
function StepBar({ step }) {
  const labels = ['Hospital', 'Doctor', 'Session', 'Confirm'];
  return (
    <div className="flex items-center justify-between mb-8 gap-0">
      {labels.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-2 relative">
            <StepDot n={i + 1} current={step === i} done={step > i} />
            <span className={`hidden sm:block text-[10px] md:text-[11px] absolute -bottom-5 whitespace-nowrap ${step >= i ? 'text-[var(--color-primary)] font-semibold' : 'text-white/20'}`}>
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 ${step > i ? 'bg-[var(--color-primary)]' : 'bg-white/10'}`} />
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
  const [searchParams] = useSearchParams();
  const slugFromUrl = searchParams.get('hospital');

  const [hospitals, setHospitals]     = useState([]);
  const [selHospital, setSelHospital] = useState(null);
  const [doctors, setDoctors]         = useState([]);
  const [step, setStep]               = useState(0);
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
      if (slugFromUrl) {
        const h = list.find(x => x.slug === slugFromUrl);
        if (h) { setSelHospital(h); setStep(1); }
      }
    }).catch(() => {});
  }, [slugFromUrl]);

  // Load doctors when hospital selected
  useEffect(() => {
    if (!selHospital?._id) return;
    api.get('/doctors?hospitalId=' + selHospital._id)
      .then(({ data }) => setDoctors(data.doctors || []))
      .catch(() => {});
  }, [selHospital]);

  // Filter sessions for selected date
  useEffect(() => {
    if (!selDoctor || !date) return;
    const dayOfWeek = new Date(date).getDay();
    const sessions = (selDoctor.sessions || []).filter(s => s.dayOfWeek === dayOfWeek && s.isActive);
    setAvailableSessions(sessions);
    setSelSession(null);
  }, [selDoctor, date]);

  const book = async () => {
    if (!form.name || !form.phone) { toast.error('Name and phone are required'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/appointments/book', {
        doctorId: selDoctor._id,
        hospitalId: selHospital._id,
        appointmentDate: date,
        sessionId: selSession?._id || `${selSession?.sessionName}-${selSession?.startTime}`,
        sessionLabel: selSession?.label || selSession?.sessionName,
        name: form.name,
        phone: form.phone,
        reason: form.reason,
      });
      setBooking(data);
      toast.success('Booking confirmed!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  // ── BOOKING SUCCESS ──────────────────────────────────────────────
  if (booking) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'DM Sans,sans-serif' }}>
        <div style={{ maxWidth: 440, width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 20, padding: '36px 32px', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: 'white', fontSize: 22, fontFamily: 'Sora,sans-serif', fontWeight: 700, marginBottom: 8 }}>Booking Confirmed!</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 24, fontSize: 14 }}>Your appointment has been booked successfully.</p>

          <div style={{ background: 'rgba(var(--color-primary-rgb),0.08)', border: '1px solid rgba(var(--color-primary-rgb),0.25)', borderRadius: 14, padding: '20px', marginBottom: 20, textAlign: 'left' }}>
            {[
              ['Queue Number', `#${booking.queueNumber}`, true],
              ['Hospital', selHospital?.name],
              ['Doctor', selDoctor?.name],
              ['Session', booking.appointment?.sessionLabel || 'General'],
              ['Date', new Date(date).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})],
              ['Patient', form.name],
            ].map(([l, v, highlight]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{l}</span>
                <span style={{ color: highlight ? 'var(--color-primary)' : 'white', fontWeight: highlight ? 800 : 500, fontSize: highlight ? 20 : 14 }}>{v}</span>
              </div>
            ))}
          </div>

          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 20 }}>
            Please arrive 10 minutes before your appointment. Show this screen to reception.
          </p>

          <button onClick={() => { setBooking(null); setStep(0); setForm({ name:'', phone:'', reason:'' }); setSelDoctor(null); }}
            style={{ background: 'linear-gradient(135deg, var(--color-primary), #00a8d4)', color: '#02040a', border: 'none', borderRadius: 12, padding: '12px 28px', fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%' }}>
            Book Another Appointment
          </button>
        </div>
        <ChevFooter minimal />
      </div>
    );
  }

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
        <img src="/chevara-brand.png" alt="Chevara Labs" className="h-5 md:h-6 object-contain opacity-40 shrink-0 ml-2" />
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center px-4 py-6 md:py-10">
        <div className="w-full max-w-[600px]">

          {/* Step bar */}
          <StepBar step={step} />

          {/* ── STEP 0: Select Hospital ── */}
          {step === 0 && (
            <div>
              <h2 style={{ color: 'white', fontSize: 20, fontFamily: 'Sora,sans-serif', fontWeight: 700, marginBottom: 6 }}>Select Hospital</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 20 }}>Choose where you'd like to book your appointment</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {hospitals.length === 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 0' }}>Loading hospitals…</p>
                )}
                {hospitals.map(h => (
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
                <button disabled={!selHospital} onClick={() => setStep(1)}
                  style={{ background: selHospital ? 'linear-gradient(135deg, var(--color-primary), #00a8d4)' : 'rgba(255,255,255,0.06)', color: selHospital ? '#02040a' : 'rgba(255,255,255,0.3)', border: 'none', borderRadius: 12, padding: '12px 28px', fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: 15, cursor: selHospital ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                  Next: Choose Doctor →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 1: Choose Doctor ── */}
          {step === 1 && (
            <div>
              <h2 style={{ color: 'white', fontSize: 20, fontFamily: 'Sora,sans-serif', fontWeight: 700, marginBottom: 6 }}>Choose Doctor</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 20 }}>Select your preferred doctor at {selHospital?.name}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {doctors.length === 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '40px 0' }}>No doctors available today</p>
                )}
                {doctors.map(d => (
                  <SelectCard key={d._id} selected={selDoctor?._id === d._id} onClick={() => setSelDoctor(d)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#02040a', flexShrink: 0 }}>
                        {d.name.replace('Dr. ','').charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: 'white', fontWeight: 600, fontSize: 15 }}>{d.name}</p>
                        <p style={{ color: 'var(--color-primary)', fontSize: 13 }}>{d.specialization}</p>
                        {d.qualifications?.length > 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{d.qualifications.join(', ')}</p>}
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
                <button onClick={() => setStep(0)}
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 22px', fontFamily: 'Sora,sans-serif', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  ← Back
                </button>
                <button disabled={!selDoctor} onClick={() => setStep(2)}
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
                <label className="label">Appointment Date</label>
                <input type="date" className="input" value={date} min={todayISO()} onChange={e => setDate(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                <label className="label">Available Sessions</label>
                {availableSessions.length === 0 ? (
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
        </div>
      </div>

      <ChevFooter />
    </div>
  );
}
