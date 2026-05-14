import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import ChevFooter from '../../components/ChevFooter';
import { fDate } from '../../utils/helpers';

export default function PatientDashboard() {
  const { user, login } = useAuth();
  const [tab, setTab] = useState('profile'); // profile | history | prescriptions
  const [loading, setLoading] = useState(true);

  // Profile State
  const [profile, setProfile] = useState({ name: '', phone: '', address: '', avatar: '' });

  // History State
  const [history, setHistory] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);

  useEffect(() => {
    fetchData();
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
      // Need to create this route
      const { data } = await api.put('/auth/patient/profile', profile);
      if (data.success) {
        toast.success('Profile updated');
        login(localStorage.getItem('token'), { ...user, ...profile });
      }
    } catch (err) {
      toast.error('Failed to update profile');
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

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col text-white font-sans">
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          {profile.avatar ? (
            <img src={profile.avatar} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-[var(--color-primary)] object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[var(--color-surface)] border-2 border-[var(--color-primary)] flex items-center justify-center text-2xl font-bold">
              {(user?.name || 'P')[0]}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold font-sora">{user?.name}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Patient Portal</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-[var(--color-surface)] p-1 rounded-xl">
          {['profile', 'history', 'prescriptions'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold capitalize transition-colors ${tab === t ? 'bg-[var(--color-primary)] text-black' : 'text-[var(--color-text-muted)] hover:text-white'}`}
            >
              {t}
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

            {tab === 'history' && (
              <div>
                <h2 className="text-lg font-bold mb-4">My Visit History</h2>
                {history.length === 0 ? <p className="text-[var(--color-text-muted)]">No previous visits found.</p> : (
                  <div className="space-y-4">
                    {history.map(h => (
                      <div key={h._id} className="p-4 bg-[var(--color-surface2)] rounded-lg border border-[var(--color-border)] flex justify-between items-center">
                        <div>
                          <p className="font-bold text-[var(--color-primary)]">{fDate(h.appointmentDate)}</p>
                          <p className="text-sm">Dr. {h.doctor?.name}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-1 rounded bg-black/30 text-xs text-[var(--color-text-muted)] uppercase">{h.status}</span>
                        </div>
                      </div>
                    ))}
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
