import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { fDate, fMoney } from '../../utils/helpers';

export default function StaffRefund() {
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  const searchPatients = async (e) => {
    if (e) e.preventDefault();
    if (!search.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/patients/search?query=${search}`);
      setPatients(data.patients || []);
      if (data.patients?.length === 0) toast.error('No patients found');
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async (patientId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/appointments/patient/${patientId}`);
      // Only show paid appointments for refund
      setAppointments(data.appointments || []);
    } catch (err) {
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRefund = async (aptId, reason) => {
    if (!reason) return toast.error('Please provide a reason for the refund');
    setProcessing(true);
    try {
      await api.post(`/appointments/${aptId}/refund/request`, { reason });
      toast.success('Refund request sent to doctor');
      loadAppointments(selectedPatient._id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Refund Management</h1>
        <p className="text-sm text-white/50">Issue and track patient refunds (Doctor fees only)</p>
      </div>

      {!selectedPatient ? (
        <div className="card max-w-2xl">
          <form onSubmit={searchPatients} className="space-y-4">
            <label className="label">Search Patient (Name, Phone, or ID)</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                className="input" 
                placeholder="Enter patient details..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button type="submit" disabled={loading} className="btn-primary px-8">
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {patients.length > 0 && (
            <div className="mt-6 divide-y divide-white/5 border-t border-white/5">
              {patients.map(p => (
                <div key={p._id} className="py-3 flex items-center justify-between hover:bg-white/5 px-2 rounded-lg transition-all">
                  <div>
                    <p className="font-bold text-white">{p.name}</p>
                    <p className="text-xs text-white/40">{p.phone} · {p.nic || 'No NIC'}</p>
                  </div>
                  <button onClick={() => { setSelectedPatient(p); loadAppointments(p._id); }} className="btn-ghost text-xs">
                    Select Patient →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 p-4 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-xl">👤</div>
              <div>
                <p className="font-bold text-white text-lg">{selectedPatient.name}</p>
                <p className="text-sm text-white/50">{selectedPatient.phone} · {selectedPatient.email || 'No email'}</p>
              </div>
            </div>
            <button onClick={() => { setSelectedPatient(null); setAppointments([]); setPatients([]); }} className="btn-ghost text-xs">
              ✕ Switch Patient
            </button>
          </div>

          <div className="grid gap-4">
            <h3 className="section-title">Payment History</h3>
            {loading ? (
              <div className="card animate-pulse h-32" />
            ) : appointments.filter(a => a.paymentStatus === 'paid' || a.paymentStatus === 'refunded').length === 0 ? (
              <div className="card text-center p-10 text-white/30 italic">
                No refundable (paid) appointments found for this patient.
              </div>
            ) : (
              appointments.filter(a => a.paymentStatus === 'paid' || a.paymentStatus === 'refunded').map(apt => (
                <div key={apt._id} className="card flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/60">Q#{apt.queueNumber}</span>
                      <p className="font-bold text-white">{fDate(apt.appointmentDate)}</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                        apt.paymentStatus === 'refunded' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                      }`}>
                        {apt.paymentStatus}
                      </span>
                    </div>
                    <p className="text-sm text-white/50">Doctor: <span className="text-white/80">{apt.doctor?.name}</span></p>
                    <div className="mt-2 flex gap-4 text-xs">
                      <p>Doctor Fee: <span className="text-white">{fMoney(apt.fees?.doctorFee)}</span></p>
                      <p>Hospital Charge: <span className="text-white/40 line-through">{fMoney(apt.fees?.hospitalCharge)} (Non-refundable)</span></p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[200px]">
                    {apt.paymentStatus === 'refunded' ? (
                      <div className="text-right">
                        <p className="text-xs text-green-400 font-bold">Successfully Refunded</p>
                        <p className="text-[10px] text-white/40">{fDate(apt.refund?.completedAt)}</p>
                      </div>
                    ) : apt.refund?.status === 'requested' ? (
                      <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg text-center">
                        <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Pending Doctor Approval</p>
                      </div>
                    ) : apt.refund?.status === 'doctor_approved' ? (
                      <button 
                        onClick={async () => {
                          if(!window.confirm('Doctor has approved. Process refund now?')) return;
                          setProcessing(true);
                          try {
                            await api.put(`/appointments/${apt._id}/refund/complete`);
                            toast.success('Refund completed!');
                            loadAppointments(selectedPatient._id);
                          } catch(e) { toast.error('Refund failed'); }
                          finally { setProcessing(false); }
                        }}
                        disabled={processing}
                        className="btn-primary text-xs py-2"
                      >
                        ✓ Complete Refund
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          const reason = window.prompt('Enter reason for refund:');
                          if(reason) handleRequestRefund(apt._id, reason);
                        }}
                        disabled={processing}
                        className="btn-ghost text-xs border border-white/10 hover:bg-red-500/10 hover:text-red-400"
                      >
                        Request Refund
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
