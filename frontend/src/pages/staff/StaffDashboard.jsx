// StaffDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function StaffDashboard() {
  const { hospital } = useAuth();
  const { socket } = useSocket();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [hospitalData, setHospitalData] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  const fetch = () => {
    api.get('/staff/dashboard').then(({data:d})=>setData(d.doctorStats||[])).catch(()=>{});
    if (hospital?._id) {
      api.get('/hospitals/mine?hospitalId=' + hospital._id).then(({data:d})=>{
        setHospitalData(d.hospital);
        setAnnouncement(d.hospital?.queueSettings?.announcement || '');
      }).catch(()=>{}).finally(()=>setLoading(false));
    } else {
      setLoading(false);
    }
  };

  useEffect(()=>{ fetch(); }, []);
  useEffect(()=>{
    if (!socket||!hospital?._id) return;
    socket.emit('join_hospital', hospital._id);
    socket.on('next_called', fetch); socket.on('appointment_booked', fetch);
    return ()=>{ socket.off('next_called',fetch); socket.off('appointment_booked',fetch); };
  }, [socket, hospital]);

  const toggleArrival = async (docId, isArrived) => {
    try { await api.put(`/doctors/${docId}/arrival`, { isArrived }); toast.success(isArrived?'Doctor marked arrived':'Status updated'); fetch(); }
    catch { toast.error('Failed'); }
  };

  const updateAnnouncement = async (msg) => {
    setSavingAnnouncement(true);
    try {
      await api.put(`/hospitals/${hospital._id}/announcement`, { announcement: msg });
      setAnnouncement(msg);
      toast.success(msg ? 'Display message updated' : 'Message cleared');
    } catch { toast.error('Failed to update message'); }
    finally { setSavingAnnouncement(false); }
  };

  const totals = data.reduce((a,d)=>({ total:a.total+d.stats.total, waiting:a.waiting+d.stats.waiting, completed:a.completed+d.stats.completed }), { total:0,waiting:0,completed:0 });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <div><h1 className="page-title">Reception Desk</h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>Live queue overview — {hospital?.name}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-xl border border-white/10 hidden md:flex">
            <div className="flex items-center pl-2 text-xs text-white/50 whitespace-nowrap">
              🔗 Booking Link:
            </div>
            <input readOnly value={`${window.location.origin}/book/${hospital?.slug}`} 
                   className="bg-transparent border-none text-xs text-primary font-bold outline-none w-[180px] px-2 truncate selection:bg-primary/30" 
                   onClick={e => e.target.select()} />
            <button onClick={() => {
              const url = `${window.location.origin}/book/${hospital?.slug}`;
              navigator.clipboard.writeText(url);
              toast.success('Booking link copied!');
            }} className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap">
              Copy
            </button>
          </div>
          <button onClick={() => {
            const url = `${window.location.origin}/book/${hospital?.slug}`;
            navigator.clipboard.writeText(url);
            toast.success('Patient booking link copied!');
          }} className="btn-ghost text-xs px-3 font-bold border border-white/10 flex items-center gap-2 md:hidden">
            <span>🔗</span> Copy Link
          </button>
          <Link to="/staff/booking" className="btn-primary">+ New Booking</Link>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[{ l:'Total Today',v:totals.total,c:'var(--color-text)' },
          { l:'Waiting',v:totals.waiting,c:'var(--color-warning)' },
          { l:'Completed',v:totals.completed,c:'var(--color-success)' }].map(({l,v,c})=>(
          <div key={l} className="stat-card"><p className="stat-value" style={{ color:c }}>{loading?'—':v}</p><p className="stat-label">{l}</p></div>
        ))}
      </div>

      {/* Quick Announcement Tools */}
      <div className="card mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center bg-blue-50/5 border-blue-500/20">
        <div>
          <h3 className="font-bold text-sm text-white mb-1">📢 Display Scrolling Message</h3>
          <p className="text-xs text-white/50">Current: {announcement ? <span className="text-white italic">"{announcement}"</span> : <span className="italic opacity-50">None</span>}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(hospitalData?.queueSettings?.announcementTemplates || []).map((t, i) => (
            <button key={i} onClick={() => updateAnnouncement(t.message)} disabled={savingAnnouncement}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 transition-all">
              {t.title}
            </button>
          ))}
          <button onClick={() => updateAnnouncement('')} disabled={!announcement || savingAnnouncement}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
            ✕ Clear Message
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? Array(3).fill(0).map((_,i)=><div key={i} className="card animate-pulse h-44"/>)
          : data.map(({doctor:d,stats:s})=>(
          <div key={d._id} className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white" style={{ background:'var(--color-primary)' }}>{d.name.charAt(4)||'D'}</div>
                <div><p className="font-semibold text-white text-sm">{d.name}</p>
                  <p className="text-xs" style={{ color:'var(--color-primary)' }}>{d.specialization}</p></div>
              </div>
              <button onClick={() => {
                if (d.todayStatus?.isArrived && !window.confirm(`Mark Dr. ${d.name} as Left? This will send them a session summary.`)) return;
                toggleArrival(d._id, !d.todayStatus?.isArrived);
              }}
                className="text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
                style={{ 
                  background: d.todayStatus?.isArrived ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', 
                  color: d.todayStatus?.isArrived ? '#ef4444' : '#f59e0b',
                  border: `1px solid ${d.todayStatus?.isArrived ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`
                }}>
                {d.todayStatus?.isArrived ? '🚪 Doctor Left' : 'Mark Arrived'}
              </button>
            </div>
            {/* Session times */}
            {(d.todayStatus?.sessionStart||d.sessions?.[0]?.startTime) && (
              <p className="text-xs mb-2" style={{ color:'var(--color-text-muted)' }}>
                🕐 {d.todayStatus?.sessionStart||d.sessions?.[0]?.startTime} — {d.todayStatus?.sessionEnd||d.sessions?.[0]?.endTime}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[['Waiting',s.waiting,'var(--color-warning)'],['Done',s.completed,'var(--color-success)'],['#',s.currentNumber,'var(--color-text)']].map(([l,v,c])=>(
                <div key={l} className="text-center py-2 rounded-lg" style={{ background:'var(--color-surface2)' }}>
                  <p className="font-bold" style={{ color:c }}>{v}</p>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{l}</p>
                </div>
              ))}
            </div>
            <Link to={`/staff/queue?doctor=${d._id}`} className="w-full btn-ghost text-xs text-center block">Manage Queue →</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
