/**
 * SUPER ADMIN HOSPITAL MANAGER
 * ============================
 * Allows super admin to access any hospital's data directly.
 * Displayed as a modal/drawer from SuperHospitals.
 */
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { fDate, fMoney, DAYS } from '../../utils/helpers';

// ── Quick-add doctor for a specific hospital ───────────────────────
function QuickAddDoctor({ hospitalId, sym, onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', email:'', phone:'', password:'Doctor@123', specialization:'', room:'', fees:{ doctorFee:0, hospitalCharge:500 } });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (!form.name || !form.specialization) { toast.error('Name and specialization required'); return; }
    setLoading(true);
    try {
      await api.post('/doctors', { ...form, hospitalId });
      toast.success('Doctor added!'); onSaved();
    } catch(e) { toast.error(e.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };
  return (
    <div className="card border border-teal-500/30 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-white text-sm">Quick Add Doctor</h4>
        <button onClick={onClose} className="text-xs" style={{ color:'var(--color-text-muted)' }}>✕</button>
      </div>
      <div className="grid md:grid-cols-3 gap-3 mb-3">
        {[['name','Name *'],['email','Email'],['phone','Phone'],['specialization','Specialization *'],['room','Room'],['password','Password']].map(([k,l])=>(
          <div key={k}><label className="label">{l}</label>
            <input type={k==='password'?'password':'text'} className="input" value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} /></div>
        ))}
        <div><label className="label">Doctor Fee ({sym})</label><input type="number" className="input" value={form.fees.doctorFee} onChange={e=>setForm(p=>({...p,fees:{...p.fees,doctorFee:Number(e.target.value)}}))} /></div>
        <div><label className="label">Hospital Charge ({sym})</label><input type="number" className="input" value={form.fees.hospitalCharge} onChange={e=>setForm(p=>({...p,fees:{...p.fees,hospitalCharge:Number(e.target.value)}}))} /></div>
      </div>
      <button onClick={save} disabled={loading} className="btn-primary text-sm">{loading?'Adding…':'+ Add Doctor'}</button>
    </div>
  );
}

// ── Quick-add staff ────────────────────────────────────────────────
function QuickAddStaff({ hospitalId, onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', email:'', password:'Staff@123', phone:'', role:'staff' });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    try { await api.post('/hospitals/'+hospitalId+'/staff', form); toast.success('Staff added!'); onSaved(); }
    catch(e) { toast.error(e.response?.data?.message||'Error'); } finally { setLoading(false); }
  };
  return (
    <div className="card border border-blue-500/30 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-white text-sm">Quick Add Staff</h4>
        <button onClick={onClose} className="text-xs" style={{ color:'var(--color-text-muted)' }}>✕</button>
      </div>
      <div className="grid md:grid-cols-3 gap-3 mb-3">
        {[['name','Name *'],['email','Email *'],['phone','Phone'],['password','Password']].map(([k,l])=>(
          <div key={k}><label className="label">{l}</label>
            <input type={k==='password'?'password':'text'} className="input" value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} /></div>
        ))}
        <div><label className="label">Role</label>
          <select className="input" value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}>
            <option value="staff">Staff (Reception)</option><option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <button onClick={save} disabled={loading} className="btn-primary text-sm">{loading?'Adding…':'+ Add Staff'}</button>
    </div>
  );
}

// ── Hospital manager drawer ────────────────────────────────────────
export default function HospitalManager({ hospital, onClose }) {
  const [tab, setTab] = useState('doctors');
  const [doctors, setDoctors] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const sym = hospital?.payment?.currencySymbol || 'Rs.';

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        api.get('/doctors?hospitalId=' + hospital._id),
        api.get('/hospitals/' + hospital._id + '/staff')
      ]);
      setDoctors(d.data.doctors || []);
      setStaff(s.data.staff || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (hospital) fetchAll(); }, [hospital]);

  const toggleUser = async (id) => {
    try { await api.put('/hospitals/users/' + id + '/toggle'); fetchAll(); }
    catch { toast.error('Failed'); }
  };

  if (!hospital) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" style={{ background:'rgba(0,0,0,0.7)' }}
      onClick={e => { if(e.target === e.currentTarget) onClose(); }}>
      <div className="h-full overflow-y-auto w-full max-w-3xl shadow-2xl"
        style={{ background:'var(--color-surface)', borderLeft:'1px solid var(--color-border)' }}>

        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b flex items-center justify-between"
          style={{ background:'var(--color-surface)', borderColor:'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
              style={{ background: hospital.theme?.primary || 'var(--color-primary)' }}>
              {hospital.name.charAt(0)}
            </div>
            <div>
              <h2 className="font-bold text-white">{hospital.name}</h2>
              <p className="text-xs" style={{ color:'var(--color-primary)' }}>{hospital.city} · Super Admin View</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost text-sm">✕ Close</button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 flex gap-2 border-b" style={{ borderColor:'var(--color-border)' }}>
          {['doctors','staff'].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className="px-4 py-2 text-sm font-medium capitalize transition-all"
              style={{ color:tab===t?'var(--color-primary)':'var(--color-text-muted)', borderBottom:tab===t?'2px solid var(--color-primary)':'2px solid transparent' }}>
              {t} ({t==='doctors'?doctors.length:staff.length})
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* DOCTORS TAB */}
          {tab === 'doctors' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title">Doctors</h3>
                <button onClick={()=>setShowAddDoc(s=>!s)} className="btn-ghost text-sm">
                  {showAddDoc?'Cancel':'+ Add Doctor'}
                </button>
              </div>
              {showAddDoc && <QuickAddDoctor hospitalId={hospital._id} sym={sym} onClose={()=>setShowAddDoc(false)} onSaved={()=>{ setShowAddDoc(false); fetchAll(); }} />}
              {loading ? <div className="text-center py-8" style={{ color:'var(--color-text-muted)' }}>Loading…</div>
                : doctors.length === 0 ? <div className="text-center py-10" style={{ color:'var(--color-text-muted)' }}>No doctors yet</div>
                : (
                <div className="space-y-3">
                  {doctors.map(d => (
                    <div key={d._id} className="card">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0"
                          style={{ background: d.isActive ? (hospital.theme?.primary||'var(--color-primary)') : '#475569' }}>
                          {(d.name||'D').replace('Dr. ','').charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white">{d.name}</p>
                          <p className="text-xs" style={{ color:'var(--color-primary)' }}>{d.specialization} · {d.room||'—'}</p>
                        </div>
                        <div className="text-right text-xs">
                          <p style={{ color:'#6366f1' }}>{sym} {(d.fees?.doctorFee||0).toLocaleString()}</p>
                          <p style={{ color:'var(--color-primary)' }}>{sym} {(d.fees?.hospitalCharge||0).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <a href={'/display/'+hospital._id+'/'+d._id} target="_blank" rel="noreferrer"
                            className="text-xs px-2 py-1 rounded" style={{ background:'rgba(var(--color-primary-rgb),0.1)',color:'var(--color-primary)' }}>
                            📺
                          </a>
                          <span className={`badge ${d.isActive?'badge-completed':'badge-absent'}`}>{d.isActive?'Active':'Off'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STAFF TAB */}
          {tab === 'staff' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title">Staff & Admins</h3>
                <button onClick={()=>setShowAddStaff(s=>!s)} className="btn-ghost text-sm">
                  {showAddStaff?'Cancel':'+ Add Staff'}
                </button>
              </div>
              {showAddStaff && <QuickAddStaff hospitalId={hospital._id} onClose={()=>setShowAddStaff(false)} onSaved={()=>{ setShowAddStaff(false); fetchAll(); }} />}
              {loading ? <div className="text-center py-8" style={{ color:'var(--color-text-muted)' }}>Loading…</div>
                : staff.length === 0 ? <div className="text-center py-10" style={{ color:'var(--color-text-muted)' }}>No staff yet</div>
                : (
                <div className="card overflow-hidden p-0">
                  <table className="w-full text-sm">
                    <thead><tr style={{ borderBottom:'1px solid var(--color-border)' }}>
                      {['Name','Email','Role','Status','Action'].map(h=><th key={h} className="table-header">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {staff.map(m=>(
                        <tr key={m._id} style={{ borderBottom:'1px solid var(--color-border)' }}>
                          <td className="table-cell">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                style={{ background: hospital.theme?.primary||'var(--color-primary)' }}>{m.name.charAt(0)}</div>
                              <span className="text-white">{m.name}</span>
                            </div>
                          </td>
                          <td className="table-cell" style={{ color:'var(--color-text-muted)' }}>{m.email}</td>
                          <td className="table-cell"><span className="badge badge-booked capitalize">{m.role}</span></td>
                          <td className="table-cell"><span className={`badge ${m.isActive?'badge-completed':'badge-absent'}`}>{m.isActive?'Active':'Off'}</span></td>
                          <td className="table-cell">
                            <button onClick={()=>toggleUser(m._id)} className="text-xs px-3 py-1 rounded-lg transition-all"
                              style={{ background:m.isActive?'rgba(239,68,68,0.1)':'rgba(16,185,129,0.1)', color:m.isActive?'#ef4444':'#10b981' }}>
                              {m.isActive?'Disable':'Enable'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
