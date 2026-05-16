import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { fDate } from '../../utils/helpers';

export default function SuperPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editPatient, setEditPatient] = useState(null);
  const [saving, setSaving] = useState(false);
  const limit = 50;

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/superadmin/patients?search=${search}&page=${page}&limit=${limit}`);
      setPatients(data.patients || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchPatients();
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`⚠️ Are you sure you want to PERMANENTLY DELETE patient "${name}"?\n\nThis action cannot be undone and will remove all their records across the system.`)) return;
    
    try {
      toast.loading('Deleting patient...');
      await api.delete(`/superadmin/patients/${id}`);
      toast.dismiss();
      toast.success('Patient deleted');
      fetchPatients();
    } catch (err) {
      toast.dismiss();
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/superadmin/patients/${editPatient._id}`, editPatient);
      toast.success('Patient updated');
      setEditPatient(null);
      fetchPatients();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">All Patients</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {total} patients registered across all hospitals
          </p>
        </div>
        
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Search name, phone, email, NIC..." 
            className="input md:w-80"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-primary px-6">Search</button>
        </form>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead style={{ background: 'rgba(var(--color-primary-rgb), 0.05)' }}>
              <tr>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-white/50 border-b border-white/5">Patient Name</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-white/50 border-b border-white/5">Contact Info</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-white/50 border-b border-white/5">Identification</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-white/50 border-b border-white/5">Hospital</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-white/50 border-b border-white/5">Registered</th>
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-white/50 border-b border-white/5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="6" className="p-4"><div className="h-4 bg-white/5 rounded w-full"></div></td>
                  </tr>
                ))
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-white/40 italic">No patients found</td>
                </tr>
              ) : (
                patients.map(p => (
                  <tr key={p._id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-white">{p.name}</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-tighter">ID: {p._id.slice(-8)}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-white/80">{p.phone}</p>
                      <p className="text-xs text-white/40">{p.email || 'No email'}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-white/80 font-mono">{p.nic || 'N/A'}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                        {p.hospitalId?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-white/60">{fDate(p.createdAt)}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditPatient({...p})}
                          className="p-2 rounded-lg bg-white/5 hover:bg-primary/20 hover:text-primary transition-all text-white/60"
                          title="Edit Patient"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDelete(p._id, p.name)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-500 transition-all text-white/60"
                          title="Delete Patient"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className="p-4 flex items-center justify-between border-t border-white/5">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="btn-ghost text-xs disabled:opacity-30"
            >
              ← Previous
            </button>
            <span className="text-xs text-white/40">Page {page} of {Math.ceil(total / limit)}</span>
            <button 
              disabled={page >= Math.ceil(total / limit)} 
              onClick={() => setPage(p => p + 1)}
              className="btn-ghost text-xs disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editPatient && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-lg shadow-2xl border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="section-title">Edit Patient Details</h3>
              <button onClick={() => setEditPatient(null)} className="text-white/40 hover:text-white text-xl">✕</button>
            </div>
            
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Full Name</label>
                  <input 
                    className="input" 
                    value={editPatient.name || ''} 
                    onChange={e => setEditPatient({...editPatient, name: e.target.value})} 
                    required 
                  />
                </div>
                <div>
                  <label className="label">Phone Number</label>
                  <input 
                    className="input" 
                    value={editPatient.phone || ''} 
                    onChange={e => setEditPatient({...editPatient, phone: e.target.value})} 
                    required 
                  />
                </div>
                <div>
                  <label className="label">NIC / ID Number</label>
                  <input 
                    className="input" 
                    value={editPatient.nic || ''} 
                    onChange={e => setEditPatient({...editPatient, nic: e.target.value})} 
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Email Address</label>
                  <input 
                    type="email" 
                    className="input" 
                    value={editPatient.email || ''} 
                    onChange={e => setEditPatient({...editPatient, email: e.target.value})} 
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving Changes...' : 'Update Patient Data'}
                </button>
                <button type="button" onClick={() => setEditPatient(null)} className="btn-ghost px-6">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
