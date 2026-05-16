import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { fUrl } from '../../utils/api';
import toast from 'react-hot-toast';

export default function KioskApp() {
  const { hospitalId } = useParams();
  const navigate = useNavigate();
  const [hospital, setHospital] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Kiosk Flow State
  const [step, setStep] = useState(1); // 1:Select Doc, 2:Select Session, 3:Details, 4:Payment, 5:Success
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', reason: '' });
  const [bookingRes, setBookingRes] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    api.get('/display/' + hospitalId)
      .then(({ data }) => {
        if (!data.success) return;
        setHospital(data.hospital);
        setDoctors(data.doctors || []);
      })
      .catch(() => toast.error('Failed to load kiosk data'))
      .finally(() => setLoading(false));
  }, [hospitalId]);

  useEffect(() => {
    if (!hospital?.theme) return;
    const t = hospital.theme, r = document.documentElement;
    r.style.setProperty('--color-primary', t.primary || '#0d9488');
    r.style.setProperty('--color-bg', t.background || '#0a0f1e');
  }, [hospital]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-white">Loading Kiosk...</div>;

  if (hospital && !['premium', 'enterprise'].includes(hospital.subscriptionPlan)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white text-center p-6">
        <div>
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold mb-2">Self-Service Kiosk Locked</h1>
          <p className="text-white/50">This feature requires a Premium or Enterprise subscription.</p>
        </div>
      </div>
    );
  }

  const handleDocSelect = (doc) => {
    setSelectedDoc(doc);
    setStep(2); // In a real app we'd fetch doctor sessions, but for kiosk let's assume default session or let them pick
    // Fetch doctor full details to get sessions and fees
    api.get(`/doctors/${doc._id}`).then(({ data }) => {
      if (data.success) {
        setSelectedDoc(data.doctor);
        if (!data.doctor.sessions || data.doctor.sessions.length === 0) {
          setSelectedSession({ _id: 'default', sessionName: 'Default Session' });
          setStep(3);
        } else if (data.doctor.sessions.length === 1) {
          setSelectedSession(data.doctor.sessions[0]);
          setStep(3);
        }
      }
    });
  };

  const handleBook = async () => {
    if (!form.name || !form.phone) return toast.error('Name and Phone are required');
    setBookingLoading(true);
    try {
      const payload = {
        doctorId: selectedDoc._id,
        appointmentDate: new Date().toISOString(),
        hospitalId,
        name: form.name,
        phone: form.phone,
        reason: form.reason,
        sessionId: selectedSession?._id,
        sessionLabel: selectedSession?.sessionName
      };
      const { data } = await api.post('/appointments/book', payload);
      if (data.success) {
        setBookingRes(data);
        setStep(4);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to book');
    } finally {
      setBookingLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedDoc(null);
    setSelectedSession(null);
    setForm({ name: '', phone: '', reason: '' });
    setBookingRes(null);
  };

  const printReceipt = () => {
    window.print();
    setTimeout(reset, 2000); // Auto reset after print
  };

  const bg = hospital?.theme?.background || '#0a0f1e';
  const primary = hospital?.theme?.primary || '#0d9488';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: bg, color: 'white' }}>
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-4">
          {hospital?.logo ? <img src={fUrl(hospital.logo)} className="h-12" alt="logo" /> : <div className="text-3xl">🏥</div>}
          <h1 className="text-2xl font-bold">{hospital?.name || 'Self-Service Kiosk'}</h1>
        </div>
        {step > 1 && step < 5 && (
          <button onClick={reset} className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 font-bold">
            Cancel Process
          </button>
        )}
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        
        {step === 1 && (
          <div className="w-full max-w-5xl animate-fade-in">
            <h2 className="text-4xl font-bold text-center mb-10">Select a Doctor</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {doctors.map(d => (
                <div key={d._id} onClick={() => handleDocSelect(d)}
                  className="rounded-2xl p-6 flex flex-col items-center text-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.05)', border: `2px solid ${primary}44` }}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mb-4" style={{ background: primary }}>
                    {d.name.charAt(4)}
                  </div>
                  <h3 className="text-xl font-bold mb-1">{d.name}</h3>
                  <p className="text-white/50 text-sm">{d.specialization}</p>
                  <p className="text-white/30 text-xs mt-2">{d.room}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && selectedDoc && (
          <div className="w-full max-w-2xl animate-fade-in text-center">
            <h2 className="text-4xl font-bold mb-10">Select Session for {selectedDoc.name}</h2>
            <div className="grid gap-4">
              {selectedDoc.sessions?.map(s => (
                <button key={s._id} onClick={() => { setSelectedSession(s); setStep(3); }}
                  className="p-6 rounded-2xl text-2xl font-bold transition-transform hover:scale-105 active:scale-95"
                  style={{ background: 'rgba(255,255,255,0.05)', border: `2px solid ${primary}44` }}>
                  {s.sessionName || s.label} <span className="text-white/50 text-lg block mt-2">{s.startTime} - {s.endTime}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="w-full max-w-xl animate-fade-in">
            <h2 className="text-4xl font-bold text-center mb-8">Patient Details</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-white/50 mb-2 text-lg">Full Name *</label>
                <input type="text" className="w-full p-4 rounded-xl text-xl bg-white/10 text-white border-0 outline-none focus:ring-2 focus:ring-teal-500"
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. John Doe" />
              </div>
              <div>
                <label className="block text-white/50 mb-2 text-lg">Phone Number *</label>
                <input type="tel" className="w-full p-4 rounded-xl text-xl bg-white/10 text-white border-0 outline-none focus:ring-2 focus:ring-teal-500"
                  value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="e.g. 0771234567" />
              </div>
              <div>
                <label className="block text-white/50 mb-2 text-lg">Reason for Visit (Optional)</label>
                <input type="text" className="w-full p-4 rounded-xl text-xl bg-white/10 text-white border-0 outline-none focus:ring-2 focus:ring-teal-500"
                  value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="e.g. Checkup" />
              </div>
              <button onClick={handleBook} disabled={bookingLoading || !form.name || !form.phone}
                className="w-full py-5 rounded-xl text-2xl font-bold transition-all"
                style={{ background: primary, color: 'white', opacity: (bookingLoading || !form.name || !form.phone) ? 0.5 : 1 }}>
                {bookingLoading ? 'Processing...' : 'Continue to Payment'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && bookingRes && (
          <div className="w-full max-w-2xl animate-fade-in text-center">
            <h2 className="text-4xl font-bold mb-4">Payment Required</h2>
            <div className="p-8 rounded-3xl mb-8" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="text-6xl mb-6">💳</div>
              <p className="text-2xl text-white/70 mb-2">Total Amount</p>
              <p className="text-6xl font-bold" style={{ color: primary }}>{hospital.payment?.currencySymbol || 'Rs.'} {bookingRes.fees?.totalAmount}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setStep(5)} className="p-6 rounded-2xl bg-white text-black font-bold text-xl hover:bg-gray-200 active:scale-95 transition-all">
                Card Payment (Simulator)
              </button>
              <button onClick={() => setStep(5)} className="p-6 rounded-2xl bg-white/10 text-white font-bold text-xl hover:bg-white/20 active:scale-95 transition-all border border-white/20">
                Pay at Counter
              </button>
            </div>
          </div>
        )}

        {step === 5 && bookingRes && (
          <div className="w-full max-w-xl animate-fade-in text-center">
            <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl mx-auto mb-6 bg-green-500/20 text-green-500 border-4 border-green-500">
              ✓
            </div>
            <h2 className="text-4xl font-bold mb-2">Booking Confirmed!</h2>
            <p className="text-xl text-white/50 mb-8">Please take your receipt.</p>
            
            <div className="p-8 rounded-2xl bg-white text-black text-left mx-auto max-w-sm mb-8 relative" id="receipt">
              <h3 className="font-bold text-2xl text-center mb-2">{hospital.name}</h3>
              <p className="text-center text-sm text-gray-500 mb-6 border-b pb-4">Queue Ticket</p>
              
              <div className="text-center mb-6">
                <p className="text-sm text-gray-500 uppercase">Token Number</p>
                <p className="text-6xl font-bold">{bookingRes.queueNumber}</p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Doctor</span><span className="font-bold">{selectedDoc.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Patient</span><span className="font-bold">{form.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Wait Time</span><span className="font-bold">~{bookingRes.estimatedWaitMinutes} mins</span></div>
              </div>
            </div>

            <div className="flex gap-4 justify-center print:hidden">
              <button onClick={printReceipt} className="px-8 py-4 rounded-xl font-bold text-xl text-white" style={{ background: primary }}>
                🖨 Print Receipt
              </button>
              <button onClick={reset} className="px-8 py-4 rounded-xl font-bold text-xl bg-white/10 hover:bg-white/20">
                Done
              </button>
            </div>
            
            {/* CSS for printing */}
            <style>{`
              @media print {
                body * { visibility: hidden; }
                #receipt, #receipt * { visibility: visible; }
                #receipt { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; }
              }
            `}</style>
          </div>
        )}

      </div>
    </div>
  );
}
