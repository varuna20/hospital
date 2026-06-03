import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api, { fUrl } from '../../utils/api';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    bloodGroup: user?.bloodGroup || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    notificationSettings: user?.doctorProfile?.notificationSettings || user?.notificationSettings || {}
  });
  const [avatar, setAvatar] = useState(null);
  const [preview, setPreview] = useState(user?.avatar || user?.doctorProfile?.profileImage || '');

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('phone', form.phone);
      if (form.email) formData.append('email', form.email);
      if (form.bloodGroup) formData.append('bloodGroup', form.bloodGroup);
      if (form.notificationSettings) formData.append('notificationSettings', JSON.stringify(form.notificationSettings));
      if (form.newPassword) {
        formData.append('currentPassword', form.currentPassword);
        formData.append('newPassword', form.newPassword);
      }
      if (avatar) formData.append('avatar', avatar);

      const { data } = await api.put('/auth/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Update context and storage
      const token = localStorage.getItem('token');
      login(token, data.user);
      
      toast.success('Profile updated successfully');
      setForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="page-title mb-6">Profile Settings</h1>
      
      <div className="card">
        <form onSubmit={save} className="space-y-6">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4 py-4 border-b border-white/5">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-white/5 border-2 border-primary/20 group-hover:border-primary transition-all">
                {preview ? (
                  <img src={preview.startsWith('blob') ? preview : fUrl(preview)} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-black text-white/10 uppercase">
                    {user?.name?.charAt(0)}
                  </div>
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:scale-110 transition-all border-2 border-[var(--color-bg)]">
                <span className="text-black text-xs">📷</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
              </label>
            </div>
            <p className="text-[10px] text-muted uppercase font-bold tracking-widest">Profile Picture</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required />
            </div>
            {user?.role === 'patient' && (
              <div>
                <label className="label">Blood Group <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span></label>
                <select
                  className="input"
                  value={form.bloodGroup}
                  onChange={e => setForm({...form, bloodGroup: e.target.value})}
                >
                  <option value="">— Select —</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {user?.role === 'doctor' && (
            <div className="pt-6 border-t border-white/5">
              <h3 className="text-sm font-bold text-white mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <p className="text-sm font-bold text-white">Rescheduling Alerts</p>
                    <p className="text-[10px] text-muted">Notify me when my sessions are moved</p>
                  </div>
                  <input type="checkbox" className="w-5 h-5 accent-primary" 
                    checked={form.notificationSettings?.notifyReschedule !== false} 
                    onChange={e => setForm({...form, notificationSettings: {...(form.notificationSettings||{}), notifyReschedule: e.target.checked}})} />
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <p className="text-sm font-bold text-white">Session Summary</p>
                    <p className="text-[10px] text-muted">Send patient count summary before session starts</p>
                  </div>
                  <input type="checkbox" className="w-5 h-5 accent-primary" 
                    checked={form.notificationSettings?.notifySessionSummary !== false} 
                    onChange={e => setForm({...form, notificationSettings: {...(form.notificationSettings||{}), notifySessionSummary: e.target.checked}})} />
                </div>
                {form.notificationSettings?.notifySessionSummary !== false && (
                  <div>
                    <label className="label text-[10px]">Summary Lead Time (minutes before start)</label>
                    <input type="number" className="input" 
                      value={form.notificationSettings?.summaryLeadTimeMinutes || 60} 
                      onChange={e => setForm({...form, notificationSettings: {...(form.notificationSettings||{}), summaryLeadTimeMinutes: parseInt(e.target.value)}})} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-white/5">
            <h3 className="text-sm font-bold text-white mb-4">Security</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <input className="input" type="password" placeholder="Leave blank to keep current" 
                  value={form.currentPassword} onChange={e => setForm({...form, currentPassword: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">New Password</label>
                  <input className="input" type="password" 
                    value={form.newPassword} onChange={e => setForm({...form, newPassword: e.target.value})} />
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <input className="input" type="password" 
                    value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm font-bold">
              {loading ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
