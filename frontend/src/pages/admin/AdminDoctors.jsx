/**
 * ADMIN DOCTORS PAGE — Full rewrite
 * Fixes: email/phone/bio/experience now load + save properly
 * New: create doctor login, reset password, monthly booking view
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { DAYS } from '../../utils/helpers';

// ─── Session schedule editor ──────────────────────────────────────
function SessionEditor({ sessions, onChange }) {
  // Group current sessions by day
  const sessionsByDay = DAYS.map((_, i) => sessions.filter(s => s.dayOfWeek === i));

  const addSession = (dayIdx) => {
    if (sessionsByDay[dayIdx].length >= 3) {
      toast.error('Maximum 3 sessions per day allowed');
      return;
    }
    const newSession = { 
      dayOfWeek: dayIdx, 
      startTime: '09:00', 
      endTime: '13:00', 
      isActive: true, 
      slotDuration: 15, 
      maxPatients: 30,
      sessionName: sessionsByDay[dayIdx].length === 0 ? 'Morning' : sessionsByDay[dayIdx].length === 1 ? 'Afternoon' : 'Evening'
    };
    onChange([...sessions, newSession]);
  };

  const removeSession = (dayIdx, sessionIdx) => {
    const daySessions = sessionsByDay[dayIdx];
    const sessionToRemove = daySessions[sessionIdx];
    onChange(sessions.filter(s => s !== sessionToRemove));
  };

  const updateSession = (dayIdx, sessionIdx, field, value) => {
    const daySessions = [...sessionsByDay[dayIdx]];
    daySessions[sessionIdx] = { ...daySessions[sessionIdx], [field]: value };
    
    // Reconstruct all sessions
    const otherDays = sessions.filter(s => s.dayOfWeek !== dayIdx);
    onChange([...otherDays, ...daySessions]);
  };

  return (
    <div className="space-y-4">
      {DAYS.map((dayName, dayIdx) => (
        <div key={dayIdx} className="rounded-2xl p-4 border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-white uppercase tracking-wider">{dayName}</span>
            <button 
              onClick={() => addSession(dayIdx)}
              disabled={sessionsByDay[dayIdx].length >= 3}
              className="text-xs px-2.5 py-1 rounded-lg transition-all"
              style={{ background: 'rgba(var(--color-primary-rgb),0.15)', color: 'var(--color-primary)' }}
            >
              + Add Session
            </button>
          </div>
          
          <div className="space-y-3">
            {sessionsByDay[dayIdx].map((s, sIdx) => (
              <div key={sIdx} className="p-3 rounded-xl border border-dashed relative" style={{ borderColor: 'rgba(var(--color-primary-rgb),0.3)', background: 'rgba(var(--color-primary-rgb),0.03)' }}>
                <button 
                  onClick={() => removeSession(dayIdx, sIdx)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                  style={{ background: '#ef4444' }}
                >✕</button>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Session Name</label>
                    <input className="input" style={{ padding:'4px 8px', fontSize:'12px' }}
                      value={s.sessionName} onChange={e => updateSession(dayIdx, sIdx, 'sessionName', e.target.value)} />
                  </div>
                  {[['startTime','Start','time'],['endTime','End','time'],['slotDuration','Min/pt','number'],['maxPatients','Max pts','number']].map(([k,l,t])=>(
                    <div key={k}>
                      <label className="label">{l}</label>
                      <input type={t} className="input" style={{ padding:'4px 8px', fontSize:'12px' }}
                        value={s[k]} onChange={e=>updateSession(dayIdx, sIdx, k, t==='number'?Number(e.target.value):e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {sessionsByDay[dayIdx].length === 0 && (
              <p className="text-xs text-center py-2 italic" style={{ color: 'var(--color-text-muted)' }}>Off Day</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Doctor Form ──────────────────────────────────────────────────
function DoctorForm({ doctor: editDoc, onSave, onCancel }) {
  const { hospital } = useAuth();
  const isEdit = !!editDoc;
  const sym = hospital?.payment?.currencySymbol || 'Rs.';
  const defaultSessions = [1,2,3,4,5].map(d=>({ dayOfWeek:d, startTime:'09:00', endTime:'17:00', isActive:true, slotDuration:15, maxPatients:30 }));

  const [form, setForm] = useState({
    name:'', email:'', phone:'', password:'Doctor@123',
    specialization:'', qualifications:'', experience:'', bio:'', room:'', avgConsultMinutes: 5,
    fees:{ doctorFee:0, hospitalCharge: hospital?.payment?.defaultHospitalCharge||500 },
    sessions: defaultSessions, isActive:true
  });
  const [loading, setLoading] = useState(false);

  // Load full doctor data when editing
  useEffect(() => {
    if (!isEdit || !editDoc?._id) return;
    api.get('/doctors/' + editDoc._id).then(({ data }) => {
      if (!data.success) return;
      const d = data.doctor;
      setForm({
        name: d.name||'', email: d.email||'', phone: d.phone||'',
        specialization: d.specialization||'',
        qualifications: (d.qualifications||[]).join(', '),
        experience: d.experience||'', bio: d.bio||'', room: d.room||'', avgConsultMinutes: d.avgConsultMinutes || 5,
        fees: { doctorFee: d.fees?.doctorFee||0, hospitalCharge: d.fees?.hospitalCharge||0 },
        sessions: d.sessions?.length ? d.sessions : defaultSessions,
        isActive: d.isActive !== false,
      });
    }).catch(()=>toast.error('Failed to load doctor profile'));
  }, [isEdit, editDoc?._id]);

  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const setFee = (k,v) => setForm(p=>({...p,fees:{...p.fees,[k]:Number(v)||0}}));
  const totalFee = (form.fees.doctorFee||0) + (form.fees.hospitalCharge||0);

  const save = async () => {
    if (!form.name||!form.specialization) { toast.error('Name and specialization required'); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        qualifications: typeof form.qualifications==='string'
          ? form.qualifications.split(',').map(q=>q.trim()).filter(Boolean)
          : form.qualifications
      };
      if (isEdit) {
        await api.put('/doctors/'+editDoc._id, payload);
        toast.success('Doctor profile saved!');
      } else {
        await api.post('/doctors', payload);
        toast.success('Doctor added!');
      }
      onSave();
    } catch(err) { toast.error(err.response?.data?.message||'Failed to save'); }
    finally { setLoading(false); }
  };

  return (
    <div className="card border-2 mb-6" style={{ borderColor:'var(--color-primary)' }}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="section-title">{isEdit?'Edit — '+editDoc.name:'Add New Doctor'}</h3>
        <button onClick={onCancel} className="btn-ghost text-sm">✕ Cancel</button>
      </div>
      <div className="grid xl:grid-cols-3 gap-6">
        {/* Col 1: Personal */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--color-text-muted)' }}>Personal / Professional</p>
          {[['name','Full Name *','text'],['email','Email','email'],['phone','Phone','tel'],
            ['specialization','Specialization *','text'],['qualifications','Qualifications (MBBS, MD…)','text'],
            ['room','Room / OPD','text'],['avgConsultMinutes','Avg Consult Time (mins)','number'],['experience','Years of Experience','number']].map(([k,l,t])=>(
            <div key={k}><label className="label">{l}</label>
              <input type={t} className="input" value={form[k]||''} onChange={e=>set(k,e.target.value)} /></div>
          ))}
          {!isEdit&&<div><label className="label">Login Password</label>
            <input type="password" className="input" value={form.password} onChange={e=>set('password',e.target.value)} /></div>}
          <div><label className="label">Bio / Description</label>
            <textarea className="input resize-none" rows={3} value={form.bio||''} onChange={e=>set('bio',e.target.value)} /></div>
        </div>
        {/* Col 2: Fees */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--color-text-muted)' }}>Fee Structure</p>
          <div className="card" style={{ background:'var(--color-surface2)' }}>
            <div className="space-y-3 mb-4">
              <div><label className="label">Doctor Fee ({sym})</label>
                <input type="number" className="input" value={form.fees.doctorFee} onChange={e=>setFee('doctorFee',e.target.value)} />
                <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>Paid directly to doctor</p></div>
              <div><label className="label">Hospital Charge ({sym})</label>
                <input type="number" className="input" value={form.fees.hospitalCharge} onChange={e=>setFee('hospitalCharge',e.target.value)} />
                <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>Hospital service fee</p></div>
            </div>
            <div className="border-t pt-3 space-y-1.5" style={{ borderColor:'var(--color-border)' }}>
              <div className="flex justify-between text-sm"><span style={{ color:'var(--color-text-muted)' }}>Doctor Fee</span><span style={{ color:'#6366f1' }}>{sym} {form.fees.doctorFee}</span></div>
              <div className="flex justify-between text-sm"><span style={{ color:'var(--color-text-muted)' }}>Hospital Charge</span><span style={{ color:'var(--color-primary)' }}>{sym} {form.fees.hospitalCharge}</span></div>
              <div className="flex justify-between font-bold text-white pt-2 border-t" style={{ borderColor:'var(--color-border)' }}>
                <span>Patient Pays</span><span>{sym} {totalFee}</span></div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background:'var(--color-surface2)' }}>
            <div onClick={()=>set('isActive',!form.isActive)} className="relative w-10 h-6 rounded-full cursor-pointer transition-colors"
              style={{ background:form.isActive?'#10b981':'rgba(255,255,255,0.1)' }}>
              <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform:form.isActive?'translateX(18px)':'translateX(4px)' }} />
            </div>
            <span className="text-sm text-white">{form.isActive?'Active':'Disabled'}</span>
          </div>
        </div>
        {/* Col 3: Schedule */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color:'var(--color-text-muted)' }}>Weekly Schedule</p>
          <SessionEditor sessions={form.sessions} onChange={s=>set('sessions',s)} />
        </div>
      </div>
      <div className="flex gap-3 mt-5 pt-4 border-t" style={{ borderColor:'var(--color-border)' }}>
        <button onClick={save} disabled={loading} className="btn-primary">{loading?'Saving…':isEdit?'✓ Save Changes':'+ Add Doctor'}</button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

// ─── Password / Login Modal ───────────────────────────────────────
function AuthModal({ doctor, type, onClose }) {
  const [form, setForm] = useState({ email: doctor?.email||'', password:'Doctor@123', newPassword:'' });
  const [loading, setLoading] = useState(false);
  const [hasLogin, setHasLogin] = useState(!!doctor?.userId);

  const createLogin = async () => {
    if (!form.email||!form.password) { toast.error('Email and password required'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/doctors/'+doctor._id+'/create-login', form);
      toast.success(data.message); setHasLogin(true); onClose();
    } catch(e){ toast.error(e.response?.data?.message||'Failed'); } finally{ setLoading(false); }
  };

  const resetPassword = async () => {
    if (!form.newPassword||form.newPassword.length<6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await api.put('/doctors/'+doctor._id+'/reset-password',{ newPassword:form.newPassword });
      toast.success('Password reset!'); onClose();
    } catch(e){ toast.error(e.response?.data?.message||'Failed'); } finally{ setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.7)' }}>
      <div className="card max-w-md w-full mx-4">
        {type==='create' ? (
          <>
            <h3 className="section-title mb-1">Create Login — {doctor?.name}</h3>
            <p className="text-xs mb-4" style={{ color:'var(--color-text-muted)' }}>
              {hasLogin ? '✓ This doctor already has a login account.' : 'Create a portal account for this doctor to log in.'}
            </p>
            <div className="space-y-3 mb-4">
              <div><label className="label">Login Email</label>
                <input className="input" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} /></div>
              <div><label className="label">Initial Password</label>
                <input type="password" className="input" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} /></div>
            </div>
            <div className="flex gap-3">
              <button onClick={createLogin} disabled={loading||hasLogin} className="btn-primary">{loading?'Creating…':'Create Login'}</button>
              <button onClick={onClose} className="btn-ghost">Cancel</button>
            </div>
          </>
        ) : (
          <>
            <h3 className="section-title mb-1">Reset Password — {doctor?.name}</h3>
            <p className="text-xs mb-4" style={{ color:'var(--color-text-muted)' }}>
              {doctor?.email && `Login email: ${doctor.email}`}
            </p>
            <div className="mb-4">
              <label className="label">New Password (min 6 characters)</label>
              <input type="password" className="input" placeholder="Enter new password"
                value={form.newPassword} onChange={e=>setForm(p=>({...p,newPassword:e.target.value}))} />
            </div>
            <div className="flex gap-3">
              <button onClick={resetPassword} disabled={loading} className="btn-primary">{loading?'Resetting…':'Reset Password'}</button>
              <button onClick={onClose} className="btn-ghost">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Monthly booking calendar for one doctor ──────────────────────
function MonthlyView({ doctor, onClose }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()+1);

  useEffect(()=>{
    setLoading(true);
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDate = new Date(year, month, 0);
    const end = `${year}-${String(month).padStart(2,'0')}-${String(endDate.getDate()).padStart(2,'0')}`;
    api.get(`/appointments?doctorId=${doctor._id}&startDate=${start}&endDate=${end}&limit=500`)
      .then(({ data: d }) => setData(d.appointments||[]))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[doctor._id, month, year]);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Group by day
  const byDay = {};
  data.forEach(a=>{
    const day = new Date(a.appointmentDate).getDate();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(a);
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month-1, 1).getDay();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4" style={{ background:'rgba(0,0,0,0.7)' }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="w-full max-w-4xl max-h-screen overflow-y-auto rounded-2xl shadow-2xl" style={{ background:'var(--color-surface)' }}>
        {/* Header */}
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between" style={{ background:'var(--color-surface)', borderColor:'var(--color-border)' }}>
          <div>
            <h3 className="font-bold text-white text-lg">{doctor.name} — Monthly Bookings</h3>
            <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{doctor.specialization}</p>
          </div>
          <div className="flex items-center gap-3">
            <select className="input w-auto" value={month} onChange={e=>setMonth(Number(e.target.value))}>
              {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
            </select>
            <select className="input w-auto" value={year} onChange={e=>setYear(Number(e.target.value))}>
              {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y=><option key={y}>{y}</option>)}
            </select>
            <button onClick={onClose} className="btn-ghost text-sm">✕ Close</button>
          </div>
        </div>
        <div className="p-6">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[['Total Booked',data.length,'var(--color-primary)'],
              ['Completed',data.filter(a=>a.status==='completed').length,'#10b981'],
              ['Absent',data.filter(a=>a.status==='absent').length,'#ef4444'],
              ['Upcoming',data.filter(a=>['booked','arrived'].includes(a.status)).length,'#f59e0b']].map(([l,v,c])=>(
              <div key={l} className="stat-card py-3">
                <p className="stat-value text-2xl" style={{ color:c }}>{v}</p>
                <p className="stat-label">{l}</p>
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="text-center py-10" style={{ color:'var(--color-text-muted)' }}>Loading…</div>
          ) : (
            <div>
              <div className="grid grid-cols-7 mb-2">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
                  <div key={d} className="text-center text-xs font-semibold py-2" style={{ color:'var(--color-text-muted)' }}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells before month start */}
                {Array(firstDow).fill(null).map((_,i)=><div key={'empty'+i} />)}
                {/* Day cells */}
                {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
                  const apts = byDay[day] || [];
                  const isToday = day===now.getDate() && month===now.getMonth()+1 && year===now.getFullYear();
                  const isPast = new Date(year,month-1,day) < new Date(now.getFullYear(),now.getMonth(),now.getDate());
                  return (
                    <div key={day} className="rounded-xl p-2 min-h-[70px]"
                      style={{ background: isToday?'rgba(var(--color-primary-rgb),0.15)':isPast?'rgba(255,255,255,0.02)':'rgba(255,255,255,0.04)',
                               border: isToday?'1px solid rgba(var(--color-primary-rgb),0.4)':'1px solid var(--color-border)' }}>
                      <p className="text-xs font-bold mb-1.5" style={{ color: isToday?'var(--color-primary)':'rgba(255,255,255,0.5)' }}>{day}</p>
                      {apts.length>0 && (
                        <div>
                          <span className="inline-block px-1.5 py-0.5 rounded text-xs font-bold"
                            style={{ background:'rgba(var(--color-primary-rgb),0.2)', color:'var(--color-primary)' }}>
                            {apts.length} {apts.length===1?'apt':'apts'}
                          </span>
                          <div className="flex gap-0.5 mt-1 flex-wrap">
                            {apts.slice(0,6).map(a=>(
                              <div key={a._id} className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: a.status==='completed'?'#10b981':a.status==='absent'?'#ef4444':a.status==='in-progress'?'var(--color-primary)':'#f59e0b' }}
                                title={`#${a.queueNumber} ${a.patient?.name||''} — ${a.status}`} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs" style={{ color:'var(--color-text-muted)' }}>
                {[['#10b981','Completed'],['#f59e0b','Booked/Arrived'],['var(--color-primary)','In-Progress'],['#ef4444','Absent']].map(([c,l])=>(
                  <div key={l} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ background:c }} /><span>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Doctor Card ──────────────────────────────────────────────────
function DoctorCard({ doctor, hospitalId, onEdit }) {
  const { hospital } = useAuth();
  const sym = hospital?.payment?.currencySymbol||'Rs.';
  const [authModal, setAuthModal] = useState(null); // 'create' | 'reset'
  const [showCalendar, setShowCalendar] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const displayUrl = `${window.location.origin}/display/${hospitalId}/${doctor._id}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(displayUrl).then(()=>{ setCopyDone(true); toast.success('Copied!'); setTimeout(()=>setCopyDone(false),2000); });
  };

  return (
    <>
      {authModal && <AuthModal doctor={doctor} type={authModal} onClose={()=>setAuthModal(null)} />}
      {showCalendar && <MonthlyView doctor={doctor} onClose={()=>setShowCalendar(false)} />}

      <div className="card">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-white text-xl flex-shrink-0"
            style={{ background: doctor.isActive?'var(--color-primary)':'#475569' }}>
            {(doctor.name||'D').replace('Dr. ','').charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-white">{doctor.name}</p>
              {!doctor.isActive&&<span className="badge badge-absent">Inactive</span>}
              {doctor.userId && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:'rgba(16,185,129,0.1)',color:'#10b981' }}>✓ Has Login</span>}
            </div>
            <p className="text-sm" style={{ color:'var(--color-primary)' }}>{doctor.specialization}</p>
            {doctor.qualifications?.length > 0 && <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{doctor.qualifications.join(', ')}</p>}
          </div>
        </div>

        {/* Contact info */}
        <div className="space-y-1 mb-3 text-sm">
          {doctor.email && <p style={{ color:'var(--color-text-muted)' }}>✉ {doctor.email}</p>}
          {doctor.phone && <p style={{ color:'var(--color-text-muted)' }}>📞 {doctor.phone}</p>}
          {doctor.room  && <p style={{ color:'var(--color-text-muted)' }}>🚪 {doctor.room}</p>}
          {doctor.experience && <p style={{ color:'var(--color-text-muted)' }}>⏱ {doctor.experience} years experience</p>}
          {doctor.bio   && <p className="text-xs mt-1 line-clamp-2" style={{ color:'var(--color-text-muted)' }}>{doctor.bio}</p>}
        </div>

        {/* Fees */}
        <div className="rounded-xl p-2.5 mb-3 space-y-1" style={{ background:'var(--color-surface2)' }}>
          {[['Doctor Fee', doctor.fees?.doctorFee||0,'#6366f1'],['Hospital',doctor.fees?.hospitalCharge||0,'var(--color-primary)'],['Total',doctor.fees?.totalFee||0,'white']].map(([l,v,c],i)=>(
            <div key={l} className={`flex justify-between text-xs ${i===2?'font-bold border-t pt-1':''}`} style={i===2?{borderColor:'var(--color-border)'}:{}}>
              <span style={{ color:'var(--color-text-muted)' }}>{l}</span>
              <span style={{ color:c }}>{sym} {v.toLocaleString()}</span>
            </div>
          ))}
        </div>

        {/* Schedule days */}
        <div className="flex flex-wrap gap-1 mb-3">
          {DAYS.map((d,i)=>{
            const s = (doctor.sessions||[]).find(x=>x.dayOfWeek===i&&x.isActive);
            return <span key={d} className="text-xs px-2 py-0.5 rounded"
              style={{ background:s?'rgba(var(--color-primary-rgb),0.15)':'var(--color-surface2)', color:s?'var(--color-primary)':'var(--color-text-muted)' }}>
              {d.slice(0,3)}{s?` ${s.startTime}`:''}
            </span>;
          })}
        </div>

        {/* Display URL */}
        <div className="rounded-lg p-2 mb-3 flex items-center gap-2" style={{ background:'rgba(var(--color-primary-rgb),0.05)',border:'1px solid rgba(var(--color-primary-rgb),0.15)' }}>
          <span className="text-xs flex-shrink-0" style={{ color:'var(--color-primary)' }}>📺</span>
          <span className="text-xs flex-1 truncate font-mono" style={{ color:'var(--color-text-muted)' }}>/display/…/{doctor._id?.toString().slice(-8)}</span>
          <button onClick={copyUrl} className="text-xs px-2 py-0.5 rounded flex-shrink-0"
            style={{ background:copyDone?'rgba(16,185,129,0.2)':'rgba(var(--color-primary-rgb),0.15)', color:copyDone?'#10b981':'var(--color-primary)' }}>
            {copyDone?'✓':'Copy'}
          </button>
          <a href={displayUrl} target="_blank" rel="noreferrer" className="text-xs px-2 py-0.5 rounded"
            style={{ background:'rgba(var(--color-primary-rgb),0.15)', color:'var(--color-primary)' }}>Open</a>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={()=>onEdit(doctor)} className="btn-ghost text-xs flex-1">✏ Edit</button>
          <button onClick={()=>setShowCalendar(true)} className="text-xs px-2 py-1.5 rounded-lg transition-all"
            style={{ background:'rgba(var(--color-primary-rgb),0.1)', color:'var(--color-primary)' }}
            title="Monthly bookings">📅</button>
          {!doctor.userId
            ? <button onClick={()=>setAuthModal('create')} className="text-xs px-2 py-1.5 rounded-lg" style={{ background:'rgba(16,185,129,0.1)',color:'#10b981' }} title="Create login">+ Login</button>
            : <button onClick={()=>setAuthModal('reset')} className="text-xs px-2 py-1.5 rounded-lg" style={{ background:'rgba(245,158,11,0.1)',color:'#f59e0b' }} title="Reset password">🔑</button>
          }
          <a href={displayUrl} target="_blank" rel="noreferrer" className="text-xs px-2 py-1.5 rounded-lg"
            style={{ background:'rgba(var(--color-primary-rgb),0.08)',color:'var(--color-primary)' }} title="Open display">📺</a>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function AdminDoctors() {
  const { hospital } = useAuth();
  const hospitalId = hospital?._id;
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [search, setSearch] = useState('');

  const fetchDoctors = () => {
    setLoading(true);
    api.get('/doctors')
      .then(({ data }) => setDoctors(data.doctors||[]))
      .catch(()=>toast.error('Failed to load doctors'))
      .finally(()=>setLoading(false));
  };
  useEffect(()=>{ fetchDoctors(); },[]);

  const handleSaved = () => { setShowForm(false); setEditDoc(null); fetchDoctors(); };
  const filtered = doctors.filter(d=>!search||d.name.toLowerCase().includes(search.toLowerCase())||d.specialization.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Doctors</h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>{doctors.length} registered</p>
        </div>
        <div className="flex gap-3">
          <input className="input max-w-xs" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
          <button onClick={()=>{ setShowForm(true); setEditDoc(null); }} className="btn-primary whitespace-nowrap">+ Add Doctor</button>
        </div>
      </div>

      {(showForm||editDoc)&&(
        <DoctorForm doctor={editDoc} onSave={handleSaved} onCancel={()=>{ setShowForm(false); setEditDoc(null); }} />
      )}

      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{Array(3).fill(0).map((_,i)=><div key={i} className="card animate-pulse h-72"/>)}</div>
      ) : filtered.length===0 ? (
        <div className="card text-center py-14" style={{ color:'var(--color-text-muted)' }}>
          <div className="text-5xl mb-3">🩺</div>
          <p>{search?`No doctors matching "${search}"`:'No doctors yet. Click "+ Add Doctor" to get started.'}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(d=><DoctorCard key={d._id} doctor={d} hospitalId={hospitalId} onEdit={d=>{ setEditDoc(d); setShowForm(false); window.scrollTo(0,0); }} />)}
        </div>
      )}
    </div>
  );
}
