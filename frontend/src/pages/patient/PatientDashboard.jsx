import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import ChevFooter from '../../components/ChevFooter';
import { fUrl } from '../../utils/api';
import { fDate } from '../../utils/helpers';

export default function PatientDashboard() {
  const { user, login, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile'); // profile | family | history | prescriptions
  const [loading, setLoading] = useState(true);

  // Profile State
  const [profile, setProfile] = useState({ name: '', phone: '', address: '', avatar: '' });

  // History State
  const [history, setHistory] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  // Family Members State
  const [showAddDashboardForm, setShowAddDashboardForm] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({ name: '', relationship: 'Spouse', phone: '' });
  const [addingFamily, setAddingFamily] = useState(false);

  useEffect(() => {
    if (tab !== 'family') {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'profile') {
        const { data } = await api.get('/auth/me'); // Gets current user (patient)
        if (data.success) {
          setProfile({
            name: data.user.name || '',
            phone: data.user.phone || '',
            address: data.user.address || '',
            avatar: data.user.avatar || ''
          });
        }
      } else if (tab === 'history') {
        const { data } = await api.get('/appointments/patient-history'); // We need to create this route
        if (data.success) setHistory(data.appointments);
      } else if (tab === 'prescriptions') {
        const { data } = await api.get('/prescriptions/my-prescriptions'); // We need to create this route
        if (data.success) setPrescriptions(data.prescriptions);
      }
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put('/auth/profile', profile);
      if (data.success) {
        toast.success('Profile updated');
        login(localStorage.getItem('token'), { ...user, ...profile });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    }
  };

  const downloadPrescription = async (id) => {
    try {
      const response = await api.get(`/prescriptions/${id}/download-watermarked`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Prescription_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      toast.error('Failed to download prescription');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
    toast.success('Logged out');
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col text-white font-sans">
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/profile" className="relative group">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[var(--color-primary)] bg-white/5 group-hover:scale-105 transition-all">
              {user?.avatar ? (
                <img src={fUrl(user.avatar)} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold">
                  {(user?.name || 'P')[0]}
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[var(--color-primary)] rounded-full flex items-center justify-center text-[10px] text-black border-2 border-[var(--color-bg)]">
              ⚙️
            </div>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-sora">{user?.name}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Patient Portal</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const slug = user?.hospitalId?.slug;
                navigate(slug ? `/booking/${slug}` : '/');
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
              style={{
                background: 'rgba(var(--color-primary-rgb),0.12)',
                color: 'var(--color-primary)',
                border: '1.5px solid rgba(var(--color-primary-rgb),0.35)',
                cursor: 'pointer'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.25)';
                e.currentTarget.style.borderColor = 'var(--color-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.12)';
                e.currentTarget.style.borderColor = 'rgba(var(--color-primary-rgb),0.35)';
              }}
            >
              📅 Book Appointment
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
            >
              <span>⏻</span> Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-[var(--color-surface)] p-1 rounded-xl">
          {['profile', 'family', 'history', 'prescriptions'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold capitalize transition-colors ${tab === t ? 'bg-[var(--color-primary)] text-black' : 'text-[var(--color-text-muted)] hover:text-white'}`}
            >
              {t === 'family' ? '👥 Family Members' : t}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="card">
            {tab === 'profile' && (
              <form onSubmit={updateProfile} className="space-y-4">
                <h2 className="text-lg font-bold mb-4">Edit Profile</h2>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Full Name</label>
                  <input type="text" className="input w-full" value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Mobile Number</label>
                  <input type="text" className="input w-full" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Home Address</label>
                  <textarea className="input w-full" rows="3" value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})}></textarea>
                </div>
                <div className="pt-4 text-right">
                  <button type="submit" className="btn-primary">Save Changes</button>
                </div>
              </form>
            )}

            {tab === 'family' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-bold">Family Members</h2>
                    <p className="text-xs text-[var(--color-text-muted)]">Manage family members linked to your login for instant adjacent bookings.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddDashboardForm(!showAddDashboardForm)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    style={{
                      background: 'rgba(var(--color-primary-rgb),0.12)',
                      color: 'var(--color-primary)',
                      border: '1.5px solid rgba(var(--color-primary-rgb),0.3)',
                    }}
                  >
                    {showAddDashboardForm ? '✕ Close Form' : '➕ Add Family Member'}
                  </button>
                </div>

                {showAddDashboardForm && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setAddingFamily(true);
                      try {
                        const { data } = await api.post('/auth/family', newMemberForm);
                        if (data.success) {
                          toast.success('Family member added successfully!');
                          updateUser({ familyMembers: data.familyMembers });
                          setNewMemberForm({ name: '', relationship: 'Spouse', phone: '' });
                          setShowAddDashboardForm(false);
                        }
                      } catch (err) {
                        toast.error(err.response?.data?.message || 'Failed to add family member');
                      } finally {
                        setAddingFamily(false);
                      }
                    }}
                    className="p-4 bg-[var(--color-surface2)] rounded-xl border border-[var(--color-border)] mb-6 space-y-4"
                  >
                    <h3 className="text-sm font-bold text-white">New Family Member Details</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Shanthi Fernando"
                          className="input w-full"
                          value={newMemberForm.name}
                          onChange={e => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Relationship</label>
                        <select
                          className="input w-full"
                          value={newMemberForm.relationship}
                          onChange={e => setNewMemberForm({ ...newMemberForm, relationship: e.target.value })}
                          style={{ height: '42px', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                        >
                          {['Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Other'].map(r => (
                            <option key={r} value={r} style={{ background: '#0c0f17', color: 'white' }}>{r}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Mobile Number (Optional)</label>
                        <input
                          type="tel"
                          placeholder="e.g. +94 77..."
                          className="input w-full"
                          value={newMemberForm.phone}
                          onChange={e => setNewMemberForm({ ...newMemberForm, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <button type="submit" disabled={addingFamily} className="btn-primary">
                        {addingFamily ? 'Saving...' : 'Add Family Member'}
                      </button>
                    </div>
                  </form>
                )}

                {(!user?.familyMembers || user.familyMembers.length === 0) ? (
                  <div className="p-8 bg-[var(--color-surface2)] rounded-lg text-center border border-dashed border-[var(--color-border)]">
                    <p className="text-[var(--color-text-muted)] text-sm mb-2">No family members linked to your profile yet.</p>
                    <p className="text-xs text-[var(--color-text-muted)]/60">Add family members to easily book adjacent slots for them.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {user.familyMembers.map(m => (
                      <div key={m._id} className="p-4 bg-[var(--color-surface2)] rounded-xl border border-[var(--color-border)] flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-lg">
                            👥
                          </div>
                          <div>
                            <p className="font-bold text-white">{m.name}</p>
                            <div className="flex gap-2 items-center mt-1">
                              <span className="px-2 py-0.5 rounded bg-[var(--color-primary)]/10 text-[10px] text-[var(--color-primary)] font-bold uppercase tracking-wider">
                                {m.relationship}
                              </span>
                              {m.phone && (
                                <span className="text-[11px] text-[var(--color-text-muted)]">
                                  📞 {m.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to remove ${m.name}?`)) {
                              try {
                                const { data } = await api.delete(`/auth/family/${m._id}`);
                                if (data.success) {
                                  toast.success('Family member removed successfully');
                                  updateUser({ familyMembers: data.familyMembers });
                                }
                              } catch (err) {
                                toast.error('Failed to remove family member');
                              }
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 hover:text-red-300 transition-all cursor-pointer border border-transparent hover:border-red-500/20 hover:bg-red-500/5"
                        >
                          🗑️ Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'history' && (
              <div>
                <h2 className="text-lg font-bold mb-4">My Visit History</h2>
                {history.length === 0 ? <p className="text-[var(--color-text-muted)]">No previous visits found.</p> : (
                  <div className="space-y-4">
                    {history.map(h => {
                      const patientName = h.patient?.name || 'Myself';
                      const isFamily = patientName.trim().toLowerCase() !== user?.name?.trim().toLowerCase();
                      
                      return (
                        <div key={h._id} className="p-4 bg-[var(--color-surface2)] rounded-lg border border-[var(--color-border)] flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-[var(--color-primary)]">{fDate(h.appointmentDate)}</p>
                              {isFamily ? (
                                <span className="px-2 py-0.5 rounded bg-[var(--color-primary)]/10 text-[9px] text-[var(--color-primary)] font-bold uppercase tracking-wider">
                                  👥 {patientName}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-white/5 text-[9px] text-white/50 font-bold uppercase tracking-wider">
                                  👤 Myself
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-white/80">Dr. {h.doctor?.name} <span className="text-white/40 text-xs">({h.doctor?.specialization})</span></p>
                            {h.queueNumber && (
                              <p className="text-xs text-[var(--color-text-muted)] mt-1">Ticket: #{h.queueNumber}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="px-2 py-1 rounded bg-black/30 text-xs text-[var(--color-text-muted)] uppercase">{h.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'prescriptions' && (
              <div>
                <h2 className="text-lg font-bold mb-4">My Prescriptions</h2>
                <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mb-4 text-xs text-red-200">
                  ⚠️ Note: Screenshots are disabled for digital prescriptions. Please download the watermarked PDF copy for pharmacy use.
                </div>
                
                {prescriptions.length === 0 ? <p className="text-[var(--color-text-muted)]">No prescriptions found.</p> : (
                  <div className="space-y-4">
                    {prescriptions.map(p => (
                      <div key={p._id} className="p-4 bg-[var(--color-surface2)] rounded-lg border border-[var(--color-border)] select-none">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="font-bold text-[var(--color-primary)]">{fDate(p.visitDate)}</p>
                            <p className="text-sm text-[var(--color-text-muted)]">Dr. {p.doctor?.name}</p>
                          </div>
                          <button onClick={() => downloadPrescription(p._id)} className="btn-ghost text-xs border border-[var(--color-border)]">
                            ⬇️ Download Copy
                          </button>
                        </div>

                        {/* Prescription Preview (Anti-Screenshot Overlay) */}
                        <div className="relative p-4 bg-white text-black rounded" style={{ filter: 'contrast(0.9) brightness(0.9)' }}>
                          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none select-none overflow-hidden" style={{ transform: 'rotate(-30deg)' }}>
                            <span className="text-6xl font-black tracking-widest text-black/50">ONLINE COPY</span>
                          </div>
                          <h4 className="font-bold mb-2 border-b border-gray-300 pb-1">Rx</h4>
                          <ul className="list-disc pl-5 text-sm space-y-1 relative z-10">
                            {p.drugs?.map((d, i) => (
                              <li key={i}><strong>{d.name}</strong> - {d.dosage} ({d.frequency}) x {d.duration}</li>
                            ))}
                          </ul>
                          {p.notes && <p className="mt-4 text-xs text-gray-600 italic">Notes: {p.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <ChevFooter minimal />
    </div>
  );
}
