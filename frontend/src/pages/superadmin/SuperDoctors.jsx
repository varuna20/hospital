import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { DAYS } from '../../utils/helpers';

// ─── Session schedule editor for Doctors (Fully Responsive) ───────
function SessionEditor({ sessions, onChange }) {
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
    
    const otherDays = sessions.filter(s => s.dayOfWeek !== dayIdx);
    onChange([...otherDays, ...daySessions]);
  };

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
      {DAYS.map((dayName, dayIdx) => (
        <div key={dayIdx} className="rounded-2xl p-4 border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-white uppercase tracking-wider">{dayName}</span>
            <button 
              type="button"
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
                  type="button"
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

// ─── SuperAdmin Doctor Add/Edit Form Component ───────────────────
function DoctorForm({ doctor: editDoc, hospitals, onSave, onCancel }) {
  const isEdit = !!editDoc;
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'schedule'

  const [form, setForm] = useState({
    name: editDoc?.name || '',
    email: editDoc?.email || '',
    phone: editDoc?.phone || '',
    password: '',
    specialization: editDoc?.specialization || '',
    qualifications: Array.isArray(editDoc?.qualifications) ? editDoc.qualifications.join(', ') : (editDoc?.qualifications || ''),
    experience: editDoc?.experience || 0,
    bio: editDoc?.bio || '',
    room: editDoc?.room || '',
    language: editDoc?.language || '',
    hospitalId: editDoc?.hospitalId?._id || editDoc?.hospitalId || '',
    hospitalIds: editDoc?.hospitalIds?.map(h => h._id || h) || (editDoc?.hospitalId ? [editDoc.hospitalId?._id || editDoc.hospitalId] : []),
    fees: {
      doctorFee: editDoc?.fees?.doctorFee || 0,
      hospitalCharge: editDoc?.fees?.hospitalCharge || 0
    },
    sessions: editDoc?.sessions || []
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.specialization) {
      toast.error('Name, Email, and Specialization are required');
      return;
    }

    if (!form.hospitalIds || form.hospitalIds.length === 0) {
      toast.error('Please select at least one consulting hospital');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/doctors/${editDoc._id}`, form);
        toast.success('Doctor profile updated successfully!');
      } else {
        await api.post('/doctors', form);
        toast.success('Doctor profile and user account created successfully!');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save doctor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="card border-2 mb-6" style={{ borderColor: 'var(--color-primary)' }}>
      <div className="flex items-center justify-between mb-4 pb-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="section-title">{isEdit ? `Edit Dr. ${editDoc.name}` : 'Add New Doctor Profile'}</h3>
        <button type="button" onClick={onCancel} className="btn-ghost text-sm">✕</button>
      </div>

      {/* Tabs Selector for Mobile/Desktop layout */}
      <div className="flex gap-2 mb-4 border-b pb-2" style={{ borderColor: 'var(--color-border)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('basic')}
          className="text-sm px-4 py-2 rounded-xl transition-all"
          style={{
            background: activeTab === 'basic' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'basic' ? 'white' : 'var(--color-text-muted)'
          }}
        >
          Basic Information
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className="text-sm px-4 py-2 rounded-xl transition-all"
          style={{
            background: activeTab === 'schedule' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'schedule' ? 'white' : 'var(--color-text-muted)'
          }}
        >
          Consultation Sessions
        </button>
      </div>

      {activeTab === 'basic' && (
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="label">Assigned Consulting Hospitals *</label>
            <p className="text-xs text-white/50 mb-2">Select all hospitals where this doctor conducts consultations.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {hospitals.map(h => {
                const isChecked = form.hospitalIds.includes(h._id);
                return (
                  <label key={h._id} className="flex items-center gap-2.5 p-3 rounded-xl cursor-pointer border transition-all hover:bg-white/5"
                    style={{
                      borderColor: isChecked ? 'var(--color-primary)' : 'var(--color-border)',
                      background: isChecked ? 'rgba(var(--color-primary-rgb),0.06)' : 'var(--color-surface2)'
                    }}
                  >
                    <input
                      type="checkbox"
                      className="rounded accent-primary w-4 h-4 cursor-pointer"
                      checked={isChecked}
                      onChange={() => {
                        let newIds = [...form.hospitalIds];
                        if (newIds.includes(h._id)) {
                          newIds = newIds.filter(id => id !== h._id);
                        } else {
                          newIds.push(h._id);
                        }
                        setForm(p => ({ ...p, hospitalIds: newIds, hospitalId: newIds[0] || '' }));
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{h.name}</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{h.city}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Full Name *</label>
            <input
              type="text"
              className="input"
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label">Email Address *</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label">Phone Number</label>
            <input
              type="text"
              className="input"
              value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            />
          </div>

          {!isEdit && (
            <div>
              <label className="label">Account Password</label>
              <input
                type="password"
                className="input"
                placeholder="Default: Doctor@123"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              />
            </div>
          )}

          <div>
            <label className="label">Specialization *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Cardiologist"
              value={form.specialization}
              onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label">Qualifications (Comma separated)</label>
            <input
              type="text"
              className="input"
              placeholder="MBBS, MD, FRCS"
              value={form.qualifications}
              onChange={e => setForm(p => ({ ...p, qualifications: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Years of Experience</label>
            <input
              type="number"
              className="input"
              value={form.experience}
              onChange={e => setForm(p => ({ ...p, experience: Number(e.target.value) }))}
            />
          </div>

          <div>
            <label className="label">Consulting Room</label>
            <input
              type="text"
              className="input"
              placeholder="Room A-102"
              value={form.room}
              onChange={e => setForm(p => ({ ...p, room: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Languages Spoken</label>
            <input
              type="text"
              className="input"
              placeholder="English, Sinhala"
              value={form.language}
              onChange={e => setForm(p => ({ ...p, language: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Doctor Fee (Rs.)</label>
            <input
              type="number"
              className="input"
              value={form.fees.doctorFee}
              onChange={e => setForm(p => ({ ...p, fees: { ...p.fees, doctorFee: Number(e.target.value) } }))}
            />
          </div>

          <div>
            <label className="label">Hospital Charge (Rs.)</label>
            <input
              type="number"
              className="input"
              value={form.fees.hospitalCharge}
              onChange={e => setForm(p => ({ ...p, fees: { ...p.fees, hospitalCharge: Number(e.target.value) } }))}
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">Short Biography</label>
            <textarea
              className="input min-h-[80px]"
              value={form.bio}
              onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
            />
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="mb-4">
          <p className="text-xs text-white/50 mb-3">Define recurrent consulting sessions for this doctor.</p>
          <SessionEditor
            sessions={form.sessions}
            onChange={updatedSessions => setForm(p => ({ ...p, sessions: updatedSessions }))}
          />
        </div>
      )}

      <div className="flex gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button type="submit" disabled={loading} className="btn-primary flex-1 sm:flex-none">
          {loading ? 'Saving…' : '✓ Save Doctor Profile'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1 sm:flex-none">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main SuperAdmin Doctors Page ─────────────────────────────────
export default function SuperDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  
  // Search & filter state
  const [search, setSearch] = useState('');
  const [selHospitalId, setSelHospitalId] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [hospRes, docRes] = await Promise.all([
        api.get('/superadmin/hospitals'),
        api.get('/doctors')
      ]);
      setHospitals(hospRes.data.hospitals || []);
      setDoctors(docRes.data.doctors || []);
    } catch (err) {
      toast.error('Failed to load doctors and hospitals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you absolutely sure you want to permanently delete Dr. ${name}? This will also delete their login account.`)) {
      return;
    }

    try {
      await api.delete(`/doctors/${id}`);
      toast.success(`Dr. ${name} was permanently removed`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete doctor');
    }
  };

  // Filter list dynamically
  const filteredDoctors = doctors.filter(doc => {
    const matchesSearch = 
      doc.name?.toLowerCase().includes(search.toLowerCase()) ||
      doc.specialization?.toLowerCase().includes(search.toLowerCase());
    
    const hospIdStr = doc.hospitalId?._id || doc.hospitalId;
    const listHospIds = doc.hospitalIds?.map(h => h._id || h) || [];

    const matchesHospital = !selHospitalId || 
                            hospIdStr === selHospitalId ||
                            listHospIds.includes(selHospitalId);

    return matchesSearch && matchesHospital;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Page header and Add button (Mobile-optimized wrapping) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="page-title">Doctor Management</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Manage profiles, hospital assignments, and schedules globally
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditDoc(null); }}
          className="btn-primary w-full sm:w-auto text-center py-2.5 rounded-xl font-bold"
        >
          + Add New Doctor
        </button>
      </div>

      {/* Form view */}
      {(showForm || editDoc) && (
        <DoctorForm
          doctor={editDoc}
          hospitals={hospitals}
          onSave={() => { setShowForm(false); setEditDoc(null); fetchData(); }}
          onCancel={() => { setShowForm(false); setEditDoc(null); }}
        />
      )}

      {/* Mobile-optimized Search and Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 p-4 rounded-2xl" style={{ background: 'var(--color-surface)' }}>
        <div>
          <label className="label">Search Doctor</label>
          <input
            type="text"
            className="input w-full"
            placeholder="Search by name or specialization..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Filter By Assigned Hospital</label>
          <select
            className="input w-full"
            value={selHospitalId}
            onChange={e => setSelHospitalId(e.target.value)}
          >
            <option value="">All Hospitals</option>
            {hospitals.map(h => (
              <option key={h._id} value={h._id}>{h.name} ({h.city})</option>
            ))}
          </select>
        </div>
      </div>

      {/* List / Cards Layout */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="card animate-pulse h-48 rounded-2xl" style={{ background: 'var(--color-surface)' }} />
          ))}
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="card text-center py-12" style={{ background: 'var(--color-surface)' }}>
          <p className="text-white/50 italic">No doctors matching search criteria found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDoctors.map(doc => {
            const docHospital = doc.hospitalId;
            const hospitalName = docHospital?.name || 'Unassigned Hospital';
            const hospitalCity = docHospital?.city || '';

            return (
              <div key={doc._id} className="card flex flex-col justify-between hover:scale-[1.01] transition-all duration-200">
                <div>
                  {/* Card top border colored by doctor spec */}
                  <div className="h-1.5 -mx-5 -mt-5 mb-4 rounded-t-xl" style={{ background: 'var(--color-primary)' }} />
                  
                  {/* Doctor Info Row */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0" style={{ background: 'rgba(var(--color-primary-rgb),0.15)', color: 'var(--color-primary)' }}>
                      🩺
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate text-base">Dr. {doc.name}</p>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>{doc.specialization}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Exp: {doc.experience} Years</p>
                    </div>
                  </div>

                  {/* Hospital Details Badge */}
                  <div className="p-3 rounded-xl mb-3 space-y-1.5" style={{ background: 'var(--color-surface2)' }}>
                    <div className="flex items-start gap-1.5">
                      <span className="text-xs mt-0.5">🏥</span>
                      <div className="min-w-0 flex-1">
                        {doc.hospitalIds && doc.hospitalIds.length > 0 ? (
                          doc.hospitalIds.map(h => (
                            <p key={h._id || h} className="text-xs font-bold text-white truncate mb-0.5">
                              {h.name} <span className="text-[10px] font-normal opacity-50">({h.city})</span>
                            </p>
                          ))
                        ) : (
                          <p className="text-xs font-bold text-white truncate">
                            {hospitalName} {hospitalCity && <span className="text-[10px] font-normal opacity-50">({hospitalCity})</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact / Bio details */}
                  <div className="space-y-1 text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                    <p className="truncate">📧 {doc.email}</p>
                    <p>📞 {doc.phone || 'N/A'}</p>
                    {doc.room && <p>🚪 Room: {doc.room}</p>}
                    <p>💰 Fee: Rs. {doc.fees?.doctorFee || 0} (+ Rs. {doc.fees?.hospitalCharge || 0} Hospital Fee)</p>
                  </div>
                </div>

                {/* Mobile-optimized action buttons bar */}
                <div className="flex gap-2 pt-3 border-t mt-auto" style={{ borderColor: 'var(--color-border)' }}>
                  <button
                    onClick={() => { setEditDoc(doc); setShowForm(false); window.scrollTo(0, 0); }}
                    className="btn-ghost flex-1 text-xs py-2 rounded-xl flex items-center justify-center gap-1 hover:bg-white/5"
                  >
                    ✏ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(doc._id, doc.name)}
                    className="flex-1 text-xs py-2 rounded-xl flex items-center justify-center gap-1 transition-all"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
