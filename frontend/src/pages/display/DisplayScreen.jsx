/**
 * HOSPITAL DISPLAY SCREEN
 * ========================
 * URL: /display/:hospitalId
 * Shows all active doctors or lets you switch between them.
 * Reuses the DoctorDisplay for each doctor.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { fUrl } from '../../utils/api';
import { useSocket } from '../../context/SocketContext';

function Slideshow({ items }) {
  const [idx, setIdx] = useState(0);
  const active = useMemo(() => items?.filter(i => i.isActive) || [], [items]);
  const cur = active[idx];
  const timerRef = useRef(null);

  const next = useCallback(() => {
    if (active.length > 0) {
      setIdx(prev => (prev + 1) % active.length);
    }
  }, [active.length]);

  // Pre-cache media only when active items change
  useEffect(() => {
    active.forEach(item => {
      const formattedUrl = fUrl(item.url);
      if (item.type !== 'video') { const img = new Image(); img.src = formattedUrl; }
      else { const v = document.createElement('video'); v.src = formattedUrl; v.preload = 'auto'; }
    });
  }, [active]);

  // Handle auto-advance
  useEffect(() => {
    if (!active.length) return;
    if (cur?.type === 'video') return; 
    const d = Number(cur?.duration) || 10;
    timerRef.current = setTimeout(next, d * 1000);
    return () => clearTimeout(timerRef.current);
  }, [idx, cur, active.length, next]);

  if (!active.length) return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.4)', borderRadius:16 }}>
      <div style={{ fontSize:48, marginBottom:12, opacity:0.3 }}>🖼</div>
      <p style={{ color:'rgba(255,255,255,0.2)', fontSize:14 }}>No media content</p>
    </div>
  );

  return (
    <div style={{ width:'100%', height:'100%', position:'relative', borderRadius:16, overflow:'hidden' }}>
      <style>{`
        @keyframes slideFadeIn { from{opacity:0;transform:scale(1.04)} to{opacity:1;transform:scale(1)} }
        .slide-fade { animation: slideFadeIn 0.8s ease-out both; }
      `}</style>
      <div key={cur?._id || idx} className="slide-fade" style={{ width:'100%', height:'100%' }}>
        {cur?.type === 'video' ? (
          <video src={fUrl(cur.url)} style={{ width:'100%', height:'100%', objectFit:'cover' }} autoPlay muted playsInline onEnded={next} />
        ) : (
          <img src={fUrl(cur?.url)} style={{ width:'100%', height:'100%', objectFit:'cover' }} alt="Slide" />
        )}
      </div>
    </div>
  );
}

function DisplayMedia({ hospital, doctors }) {
  const vid = hospital?.waitingVideo;
  const anyArrived = doctors?.some(d => d.todayStatus?.isArrived);
  if (!anyArrived && vid?.enabled && vid?.url) {
    return (
      <video src={fUrl(vid.url)} style={{ width:'100%', height:'100%', objectFit:'cover' }} autoPlay muted loop playsInline />
    );
  }
  return <Slideshow items={hospital?.slideshow || []} />;
}

export default function DisplayScreen() {
  const { hospitalId } = useParams();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [hospital, setHospital] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    api.get('/display/' + hospitalId)
      .then(({ data }) => {
        if (!data.success) return;
        setHospital(data.hospital);
        const docs = data.doctors || [];
        setDoctors(docs);
        if (docs.length === 1) {
          navigate('/display/' + hospitalId + '/' + docs[0]._id, { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hospitalId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket listener for live updates
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    socket.emit('join_display', { hospitalId });
    const refresh = () => fetchData();
    ['doctor_arrival', 'appointment_booked', 'appointment_updated', 'announcement_updated'].forEach(e => socket.on(e, refresh));
    return () => ['doctor_arrival', 'appointment_booked', 'appointment_updated', 'announcement_updated'].forEach(e => socket.off(e, refresh));
  }, [socket, hospitalId, fetchData]);

  // Apply theme
  useEffect(() => {
    if (!hospital?.theme) return;
    const t = hospital.theme, r = document.documentElement;
    r.style.setProperty('--color-primary', t.primary || '#0d9488');
    r.style.setProperty('--color-bg', t.background || '#0a0f1e');
  }, [hospital]);

  const bg = hospital?.theme?.background || '#0a0f1e';
  const primary = hospital?.theme?.primary || '#0d9488';

  const [started, setStarted] = useState(false);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: primary }} />
    </div>
  );

  if (!started) return (
    <div className="min-h-screen flex flex-col items-center justify-center cursor-pointer" 
         style={{ background: bg }}
         onClick={() => {
           if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
           setStarted(true);
         }}>
      <div className="text-white text-center animate-pulse">
        <div className="text-6xl mb-4">📺</div>
        <h2 className="text-3xl font-bold font-signage">Click anywhere to start display</h2>
        <p className="text-white/50 mt-2">Will automatically enter fullscreen mode</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col aurora-bg" style={{ background: bg, overflow: 'hidden' }}>
      <style>{`
        @keyframes pixelShift {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(2px, 2px); }
          50%  { transform: translate(-1px, 3px); }
          75%  { transform: translate(-2px, -1px); }
          100% { transform: translate(0, 0); }
        }
        .pixel-shifter { animation: pixelShift 120s linear infinite; }
        @keyframes aurora {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .aurora-bg {
          background: linear-gradient(-45deg, #02040a, #050a18, #020614, #02040a);
          background-size: 400% 400%;
          animation: aurora 15s ease infinite;
        }
      `}</style>

      <div className="pixel-shifter flex-1 flex flex-col">
        {/* Header */}
        <header 
          onClick={() => { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{}); }}
          className="flex items-center justify-between px-8 py-5 border-b cursor-pointer" style={{ borderColor: primary + '33' }}
          title="Click to enter fullscreen"
        >
          <div className="flex items-center gap-4">
            {hospital?.logo ? (
              <img src={fUrl(hospital.logo)} alt="logo" className="h-12 object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-xl" style={{ background: primary }}>
                {(hospital?.name || 'H').charAt(0)}
              </div>
            )}
            <div>
              <h1 className="font-signage text-2xl font-bold text-white">{hospital?.name || 'Hospital Queue System'}</h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Sans,sans-serif' }}>Select a Doctor to View Queue</p>
            </div>
          </div>
          <button className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:bg-white/10 transition-colors">
            ⛶ Fullscreen
          </button>
        </header>

        {/* Content based on Layout */}
        {hospital?.displayLayout === 'classic_list' ? (
          <div className="flex-1 p-8 overflow-hidden flex gap-8">
            <div className="card-3d flex-[2] flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="px-6 py-4 border-b flex justify-between items-center" style={{ borderColor: primary + '33' }}>
                <h2 className="font-signage text-xl text-white">Today's Scheduled Doctors</h2>
                <span className="text-xs font-bold" style={{ color: primary }}>{doctors.length} DOCTORS ACTIVE</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <table className="w-full text-left border-separate" style={{ borderSpacing: '0 8px' }}>
                  <thead>
                    <tr className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      <th className="px-4 py-3">Doctor</th>
                      <th className="px-4 py-3">Specialization</th>
                      <th className="px-4 py-3">Room</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doctors.map(d => (
                      <tr key={d._id} className="transition-colors hover:bg-white/5">
                        <td className="px-4 py-4 rounded-l-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm" style={{ background: primary }}>{d.name.charAt(4)}</div>
                            <span className="font-bold text-white text-lg">{d.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <span className="text-md font-bold" style={{ color: primary }}>{d.specialization}</span>
                        </td>
                        <td className="px-4 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <span className="text-md font-bold text-white/80">{d.room}</span>
                        </td>
                        <td className="px-4 py-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: d.todayStatus?.isArrived ? '#10b981' : '#f59e0b' }} />
                            <span className="text-sm font-bold text-white/60">{d.todayStatus?.isArrived ? 'Available' : 'Expected'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 rounded-r-xl text-right" style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <a href={'/display/' + hospitalId + '/' + d._id} className="text-[12px] font-bold px-4 py-2 rounded-lg transition-all" style={{ background: primary + '22', color: primary, border: `1px solid ${primary}44` }}>VIEW QUEUE →</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col gap-6">
              <div className="flex-1 rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <DisplayMedia hospital={hospital} doctors={doctors} />
              </div>
            </div>
          </div>
        ) : (
          /* Default Grid Layout */
          <div className="flex-1 p-8 flex gap-8">
            <div className="flex-[2] grid grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
              {doctors.map(d => (
                <a key={d._id} href={'/display/' + hospitalId + '/' + d._id}
                  className="rounded-2xl p-6 flex flex-col items-center text-center transition-all hover:scale-105 cursor-pointer h-[260px]"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="w-24 h-24 rounded-2xl flex items-center justify-center font-bold text-white text-4xl mb-4"
                    style={{ background: primary }}>{d.name.charAt(4) || 'D'}</div>
                  <p className="font-signage text-2xl font-bold text-white line-clamp-1">{d.name}</p>
                  <p className="text-md font-bold mt-2 line-clamp-1" style={{ color: primary }}>{d.specialization}</p>
                  <p className="text-sm font-bold mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>{d.room}</p>
                  <div className="flex items-center gap-2 mt-auto pt-4">
                    <div className="w-3 h-3 rounded-full" style={{ background: d.todayStatus?.isArrived ? '#10b981' : '#f59e0b' }} />
                    <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {d.todayStatus?.isArrived ? 'Available' : 'Expected'}
                    </span>
                  </div>
                </a>
              ))}

              {doctors.length === 0 && (
                <div className="col-span-3 text-center py-20">
                  <div className="text-6xl mb-4 opacity-20">🏥</div>
                  <p className="font-signage text-xl" style={{ color: 'rgba(255,255,255,0.3)' }}>No doctors scheduled today</p>
                </div>
              )}
            </div>
            
            <div className="flex-1 rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <DisplayMedia hospital={hospital} doctors={doctors} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
