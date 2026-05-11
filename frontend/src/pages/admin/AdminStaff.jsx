import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { fDate } from '../../utils/helpers';

// Password reset modal for staff
function ResetPasswordModal({ staff, onClose }) {
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = async () => {
    if (!pw || pw.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await api.put(`/hospitals/users/${staff._id}/reset-password`, { newPassword: pw });
      toast.success(`Password reset for ${staff.name}`);
      onClose();
    } catch(e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)' }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="card max-w-sm w-full">
        <h3 className="section-title mb-1">Reset Password</h3>
        <p className="text-sm mb-4" style={{ color:'var(--color-text-muted)' }}>
          {staff.name} · {staff.email}
        </p>
        <div className="mb-4">
          <label className="label">New Password (min 6 characters)</label>
          <input type="password" className="input" placeholder="Enter new password"
            value={pw} onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && reset()} />
        </div>
        <div className="flex gap-3">
          <button onClick={reset} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Resetting…' : '🔑 Reset Password'}
          </button>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// Add staff modal
function AddStaffModal({ hospitalId, onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', email:'', password:'Staff@123', phone:'', role:'staff' });
  const [loading, setLoading] = useState(false);

  const add = async () => {
    if (!form.name || !form.email) { toast.error('Name and email required'); return; }
    setLoading(true);
    try {
      await api.post(`/hospitals/${hospitalId}/staff`, form);
      toast.success('Staff member added!');
      onSaved();
      onClose();
    } catch(e) { toast.error(e.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.7)' }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div className="card max-w-lg w-full">
        <h3 className="section-title mb-4">Add Staff Member</h3>
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          {[['name','Full Name *'],['email','Email *'],['phone','Phone'],['password','Password']].map(([k,l])=>(
            <div key={k}>
              <label className="label">{l}</label>
              <input type={k==='password'?'password':'text'} className="input"
                value={form[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} />
            </div>
          ))}
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))}>
              <option value="staff">Staff (Reception)</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={add} disabled={loading} className="btn-primary flex-1">{loading?'Adding…':'+ Add Staff'}</button>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminStaff() {
  const { hospital } = useAuth();
  const hid = hospital?._id || hospital?.id;
  const [staff, setStaff] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [resetStaff, setResetStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = () => {
    setLoading(true);
    api.get(`/hospitals/${hid}/staff`)
      .then(({ data }) => setStaff(data.staff || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (hid) fetch(); }, [hid]);

  const toggle = async (id) => {
    try { await api.put(`/hospitals/users/${id}/toggle`); fetch(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div>
      {resetStaff && <ResetPasswordModal staff={resetStaff} onClose={() => setResetStaff(null)} />}
      {showAdd && <AddStaffModal hospitalId={hid} onClose={() => setShowAdd(false)} onSaved={fetch} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Staff</h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>{staff.length} members</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">+ Add Staff</button>
      </div>

      {loading ? (
        <div className="card animate-pulse h-40" />
      ) : staff.length === 0 ? (
        <div className="card text-center py-12" style={{ color:'var(--color-text-muted)' }}>
          <div className="text-4xl mb-2">👥</div>
          <p>No staff yet. Add your first staff member.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom:'1px solid var(--color-border)', background:'var(--color-surface2)' }}>
                {['Name','Email','Role','Added','Status','Actions'].map(h=>(
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(m => (
                <tr key={m._id} style={{ borderBottom:'1px solid var(--color-border)' }}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white flex-shrink-0"
                        style={{ background:'var(--color-primary)' }}>
                        {m.name?.charAt(0) || '?'}
                      </div>
                      <span className="text-white font-medium">{m.name}</span>
                    </div>
                  </td>
                  <td className="table-cell" style={{ color:'var(--color-text-muted)' }}>{m.email}</td>
                  <td className="table-cell">
                    <span className="badge badge-booked capitalize">{m.role}</span>
                  </td>
                  <td className="table-cell" style={{ color:'var(--color-text-muted)' }}>{fDate(m.createdAt)}</td>
                  <td className="table-cell">
                    <span className={m.isActive ? 'badge badge-completed' : 'badge badge-absent'}>
                      {m.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button onClick={() => setResetStaff(m)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-all"
                        style={{ background:'rgba(245,158,11,0.1)', color:'#f59e0b' }}
                        title="Reset password">
                        🔑 Reset Password
                      </button>
                      <button onClick={() => toggle(m._id)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-all"
                        style={{ background: m.isActive?'rgba(239,68,68,0.1)':'rgba(16,185,129,0.1)', color: m.isActive?'#ef4444':'#10b981' }}>
                        {m.isActive ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
