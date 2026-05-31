import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/api';
import { fMoney } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function DoctorSummaryGuest() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await api.get(`/doctors/guest-summary/${token}`);
        if (res.data.success) {
          setData(res.data.summary);
        } else {
          toast.error(res.data.message || 'Failed to load summary');
        }
      } catch (err) {
        toast.error(err.response?.data?.message || 'Invalid or expired link');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-center p-6">
        <h1 className="text-2xl font-bold text-white mb-2">Invalid Link</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>This summary link is invalid or has expired.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--color-primary)' }}>Today's Session Summary</p>
          <h1 className="text-2xl font-bold">Dr. {data.doctorName}</h1>
          <p className="text-sm opacity-60">{data.specialization}</p>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center backdrop-blur-sm shadow-xl">
            <span className="text-2xl mb-1">👥</span>
            <p className="text-3xl font-bold">{data.totalChecked} <span className="text-sm font-normal opacity-50">/ {data.totalBooked}</span></p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Patients Checked</p>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center backdrop-blur-sm shadow-xl">
            <span className="text-2xl mb-1">💰</span>
            <p className="text-2xl font-bold" style={{ color: '#10b981' }}>{fMoney(data.totalRevenue)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Total Revenue</p>
          </div>
        </div>

        <div className="h-px w-full bg-white/10 my-6"></div>

        {/* Hospitals Breakdown */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold px-1">Hospital Breakdown</h2>
          
          {data.hospitals.length === 0 ? (
            <div className="p-6 text-center bg-white/5 border border-white/10 rounded-2xl text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No appointments found for today.
            </div>
          ) : (
            data.hospitals.map((h, index) => (
              <div key={index} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden shadow-lg backdrop-blur-md">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    {h.hospital?.logoUrl ? (
                      <img src={h.hospital.logoUrl} alt="Logo" className="w-8 h-8 rounded-full object-cover bg-white/10" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">🏥</div>
                    )}
                    <div>
                      <h3 className="font-semibold text-sm">{h.hospital?.name || 'Unknown Hospital'}</h3>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{h.hospital?.city || 'Location N/A'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: '#10b981' }}>{h.hospital?.payment?.currencySymbol || 'Rs.'} {h.totalRevenue.toLocaleString()}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Revenue</p>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex justify-between items-center text-sm mb-4">
                    <span style={{ color: 'var(--color-text-muted)' }}>Checked Patients</span>
                    <span className="font-medium bg-white/10 px-2 py-0.5 rounded-full">{h.totalChecked} / {h.totalBooked}</span>
                  </div>

                  {h.appointments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Checked List</p>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                        {h.appointments.filter(a => a.status === 'completed').map((apt, i) => (
                          <div key={i} className="flex justify-between items-center text-sm p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                            <span className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] text-white/70">
                                {apt.queueNumber}
                              </span>
                              <span className="truncate max-w-[120px] sm:max-w-[180px]">{apt.patientName}</span>
                            </span>
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              +{h.hospital?.payment?.currencySymbol || 'Rs.'} {apt.fee.toLocaleString()}
                            </span>
                          </div>
                        ))}
                        {h.totalChecked === 0 && (
                          <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>No patients checked yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-8 pb-4 text-center">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            E-Channeling Hospital System
          </p>
        </div>

      </div>
    </div>
  );
}
