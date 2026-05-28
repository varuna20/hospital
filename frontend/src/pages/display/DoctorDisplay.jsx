/**
 * DOCTOR DISPLAY SCREEN v3 — CHEVARA FUTURISTIC 3D DESIGN
 * =========================================================
 * Layout (18-inch optimized, 1920×1080 / 1366×768):
 *
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  HEADER: Hospital logo + name + Doctor + Clock          │
 *  ├──────────────────┬──────────────────┬──────────────────┤
 *  │                  │                  │                  │
 *  │  NOW SERVING     │  PORTRAIT        │  STATS +         │
 *  │  (animated 3D    │  SLIDESHOW       │  NEXT UP         │
 *  │   number)        │  (img/video)     │  indicator       │
 *  │                  │                  │                  │
 *  │                  │  [Session Info]  │                  │
 *  ├──────────────────┴──────────────────┴──────────────────┤
 *  │  RIBBON: ──○─○─○─○─○─○─○─○─○─○─○─○──  (waiting list) │
 *  ├─────────────────────────────────────────────────────────┤
 *  │  TICKER: scrolling announcement                         │
 *  └─────────────────────────────────────────────────────────┘
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import api, { fUrl } from '../../utils/api';
import Slideshow from '../../components/Slideshow';
import ChevFooter from '../../components/ChevFooter';

// ══════════════════════════════════════════════════════════════════
//  GLOBAL STYLES
// ══════════════════════════════════════════════════════════════════
const getCSS = (primary, bg, accent) => {
  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  };
  const primaryRgb = hexToRgb(primary);
  
  return `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Sora:wght@300;400;600;700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
  html, body { width:100%; height:100%; overflow:hidden; background:${bg}; }

  :root {
    --primary: ${primary};
    --primary-rgb: ${primaryRgb};
    --accent: ${accent};
    --bg: ${bg};
    --teal: ${primary};
    --teal2: ${primary}dd;
    --coral: ${accent};
    --gold: #ffd700;
    --green: #00e676;
    --glass: rgba(${primaryRgb}, 0.06);
    --border: rgba(${primaryRgb}, 0.18);
  }

  @keyframes numFlip3d {
    0%   { opacity:0; transform: perspective(400px) rotateX(-90deg) scale(0.7); }
    50%  { opacity:1; transform: perspective(400px) rotateX(10deg) scale(1.06); }
    100% { transform: perspective(400px) rotateX(0deg) scale(1); }
  }
  @keyframes glowPulse {
    0%,100% { text-shadow: 0 0 30px var(--teal), 0 0 60px rgba(${primaryRgb},0.4); }
    50%      { text-shadow: 0 0 60px var(--teal), 0 0 120px rgba(${primaryRgb},0.7), 0 0 200px rgba(${primaryRgb},0.3); }
  }
  @keyframes ribbonIn { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
  @keyframes ticker { from{transform:translateX(100vw)} to{transform:translateX(-100%)} }
  @keyframes breathe { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.8;transform:scale(0.97)} }
  @keyframes slideFadeIn { from{opacity:0;transform:scale(1.04)} to{opacity:1;transform:scale(1)} }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes scan { 0% { top: -4px; } 100%{ top: 100%; } }

  .num-flip     { animation: numFlip3d 0.55s cubic-bezier(0.4,0,0.2,1) both; }
  .glow-num     { animation: glowPulse 2.5s ease-in-out infinite; }
  .ribbon-in    { animation: ribbonIn 0.4s ease-out both; }
  .slide-fade   { animation: slideFadeIn 0.8s ease-out both; }
  .breathe      { animation: breathe 3s ease-in-out infinite; }
  .float-anim   { animation: float 4s ease-in-out infinite; }
  .ticker       { animation: ticker 30s linear infinite; white-space:nowrap; display:inline-block; }
  
  /* Burn-in protection: slowly shift content by a few pixels */
  @keyframes pixelShift {
    0%   { transform: translate(0, 0); }
    25%  { transform: translate(2px, 2px); }
    50%  { transform: translate(-1px, 3px); }
    75%  { transform: translate(-2px, -1px); }
    100% { transform: translate(0, 0); }
  }
  .pixel-shifter { animation: pixelShift 120s linear infinite; }

  /* Dynamic background to keep pixels active */
  @keyframes aurora {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .aurora-bg {
    background: linear-gradient(-45deg, ${bg}, #050a18, #020614, ${bg});
    background-size: 400% 400%;
    animation: aurora 15s ease infinite;
  }

  .card-3d {
    background: linear-gradient(145deg, rgba(${primaryRgb},0.08) 0%, rgba(${primaryRgb},0.04) 50%, rgba(2,4,10,0.6) 100%);
    border: 1px solid rgba(${primaryRgb},0.2);
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    border-radius: 20px;
    position: relative;
    overflow: hidden;
  }
  .card-3d::after {
    content:''; position:absolute; left:0; right:0; height:2px;
    background: linear-gradient(90deg, transparent, rgba(${primaryRgb},0.6), transparent);
    animation: scan 4s linear infinite; pointer-events:none;
  }
  .orbit-ring { position:absolute; border-radius:50%; border: 1px solid rgba(${primaryRgb},0.12); }
`;
};

// ══════════════════════════════════════════════════════════════════
//  COMPONENTS
// ══════════════════════════════════════════════════════════════════

function speakNext(number, roomName) {
  if (!('speechSynthesis' in window)) return;
  const room = roomName ? ` to ${roomName}` : '';
  const text = `Patient Number ${number}${room}. Patient Number ${number}${room}.`;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.88; u.pitch = 1.0; u.volume = 1; u.lang = 'en-US';
  setTimeout(() => window.speechSynthesis.speak(u), 300);
}



function DisplayMedia({ hospital, isArrived }) {
  const vid = hospital?.waitingVideo;
  if (vid?.enabled && vid?.url) {
    return (
      <video src={fUrl(vid.url)} style={{ width:'100%', height:'100%', objectFit:'cover' }} autoPlay muted loop playsInline />
    );
  }
  return <Slideshow items={hospital?.slideshow || []} />;
}

function Clock({ fs }) {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  const hh = String(t.getHours() % 12 || 12).padStart(2,'0');
  const mm = String(t.getMinutes()).padStart(2,'0');
  const ap = t.getHours() >= 12 ? 'PM' : 'AM';
  return (
    <div style={{ textAlign:'right' }}>
      <div style={{ fontFamily:'Oswald', fontWeight:700, fontSize:fs, color:'white', letterSpacing:2, lineHeight:1 }}>
        {hh}:{mm} <span style={{ fontSize:fs*0.5, color:'var(--teal)' }}>{ap}</span>
      </div>
      <div style={{ fontSize:fs*0.35, color:'rgba(255,255,255,0.3)', fontFamily:'DM Sans', marginTop:2 }}>
        {t.toLocaleDateString('en-US',{weekday:'short',day:'numeric',month:'short'})}
      </div>
    </div>
  );
}

function NowServing({ number, patientName, showName, roomName, sessionLabel, fs }) {
  const prev = useRef(number);
  useEffect(() => {
    if (prev.current !== number && number) {
      speakNext(number, roomName);
      prev.current = number;
    }
  }, [number, roomName]);

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', position:'relative' }}>
      {[180,240,300].map((s,i) => ( <div key={i} className="orbit-ring breathe" style={{ width:s, height:s, animationDuration:`${5+i*2}s` }} /> ))}
      <div style={{ fontFamily:'Oswald', fontSize:fs*0.22, fontWeight:800, color:'rgba(0,229,196,1)', letterSpacing:fs*0.08, textTransform:'uppercase', marginBottom:fs*0.1 }}>NOW SERVING</div>
      <div className="num-flip glow-num" style={{ fontFamily:'Oswald', fontWeight:900, fontSize:fs*1.2, color:'var(--teal)', lineHeight:1 }}>{number || '—'}</div>
      {showName && patientName && <div style={{ fontFamily:'DM Sans', fontSize:fs*0.25, fontWeight:800, color:'white', marginTop:fs*0.08 }}>{patientName}</div>}
      {sessionLabel && <div style={{ fontSize:fs*0.18, color:'var(--coral)', fontFamily:'Sora', fontWeight:900, marginTop:12, textTransform:'uppercase', letterSpacing:2 }}>{sessionLabel}</div>}
    </div>
  );
}

function RibbonTimeline({ patients, fs, showName }) {
  if (!patients.length) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'rgba(255,255,255,0.2)' }}>No patients in queue</div>;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:20, height:'100%', overflowX:'auto', padding:'0 30px' }}>
      {patients.map((p, i) => (
        <div key={p.queueNumber} className="ribbon-in" style={{ animationDelay:`${i*0.04}s`, display:'flex', flexDirection:'column', alignItems:'center', gap:8, flexShrink:0, padding:'0 25px' }}>
          <div style={{
            width: i===0?fs*3.0:fs*2.6, height: i===0?fs*3.0:fs*2.6, borderRadius:'50%',
            background: i===0?'#ff6b35':p.isEmergency?'rgba(255,71,87,0.2)':'rgba(255,255,255,0.1)',
            display:'flex', alignItems:'center', justifyContent:'center', border: i===0?'4px solid #ff6b35':'2px solid rgba(255,255,255,0.2)'
          }}>
            <span style={{ fontFamily:'Oswald', fontWeight:900, fontSize: i===0?fs*1.5:fs*1.2, color: i===0?'white':'rgba(255,255,255,0.9)' }}>{p.queueNumber}</span>
          </div>
          <div style={{ fontSize:fs*0.8, color: i===0?'#ff6b35':'white', fontWeight:900, letterSpacing: 1 }}>
            {i===0 ? `NEXT${showName && p.name && p.name !== '—' ? ': ' + p.name.split(' ')[0] : ''}` : (showName && p.name && p.name !== '—' ? p.name.split(' ')[0] : (p.sessionLabel || 'Waiting'))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
const SCALES = [0.85, 1.0, 1.2];

export default function DoctorDisplay() {
  const { hospitalId, doctorId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const selSession = searchParams.get('sessionId') || '';
  const { socket } = useSocket();
  const [data, setData] = useState(null);
  const [scaleIdx, setScaleIdx] = useState(1);
  const scale = SCALES[scaleIdx];

  const FS = {
    headerH: Math.round(22 * scale),
    doctorN: Math.round(24 * scale),
    bigNum:  Math.round(160 * scale),
    status:  Math.round(16 * scale),
    ticker:  Math.round(18 * scale),
  };

  const fetchData = useCallback(async () => {
    try {
      let url = `/display/${hospitalId}/${doctorId}`;
      if (selSession) url += `?sessionId=${selSession}`;
      const { data: d } = await api.get(url);
      if (d.success) setData(d);
    } catch (err) { console.error('Fetch error:', err); }
  }, [hospitalId, doctorId, selSession]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10000);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join_display', { hospitalId, doctorId });
    ['next_called','appointment_updated','appointment_booked','doctor_arrival','session_updated','announcement_updated'].forEach(e => socket.on(e, fetchData));
    return () => ['next_called','appointment_updated','appointment_booked','doctor_arrival','session_updated','announcement_updated'].forEach(e => socket.off(e, fetchData));
  }, [socket, hospitalId, doctorId, fetchData]);

  const [started, setStarted] = useState(false);

  if (!data) return <div className="min-h-screen flex items-center justify-center bg-[#02040a] text-white">Initializing Display…</div>;

  const { hospital, doctor, waitingList, currentNumber, currentPatient, totalInQueue } = data;
  const primary = hospital?.theme?.primary || '#00e5c4';
  const bg      = hospital?.theme?.background || '#02040a';
  const accent  = hospital?.theme?.accent || '#ff6b35';
  let tickerText = data.announcement || hospital?.announcement || `Welcome to ${hospital.name}`;
  if (!doctor?.isArrived && doctor?.expectedArrivalTime) {
    tickerText = `🔔 DOCTOR DELAYED - EXPECTED ARRIVAL: ${doctor.expectedArrivalTime} • ${tickerText}`;
  } else if (doctor?.sessionNotes) {
    tickerText = `💬 UPDATE: ${doctor.sessionNotes} • ${tickerText}`;
  }
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
    <div className="aurora-bg" style={{ width:'100vw', height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', fontFamily:'DM Sans', position:'relative', background: bg }}>
      <style>{getCSS(primary, bg, accent)}</style>

      {/* Main Content with Pixel Shifter */}
      <div className="pixel-shifter" style={{ display:'flex', flexDirection:'column', width:'100%', height:'100%' }}>

      {/* Header */}
      <div 
        onClick={() => { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{}); }}
        style={{ height:FS.headerH*4, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 40px', borderBottom:'1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
        title="Click to enter fullscreen"
      >
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          {hospital.logo && <img src={fUrl(hospital.logo)} style={{ height:FS.headerH*2.5 }} alt="logo" />}
          <div>
            <div style={{ fontFamily:'Sora', fontWeight:800, color:'white', fontSize:FS.doctorN }}>{hospital.name}</div>
            <div style={{ color:'rgba(255,255,255,0.4)', fontSize:FS.status }}>{doctor?.name} · {doctor?.specialization} · <span style={{ color:primary }}>{doctor?.room}</span></div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap: 30 }}>
          <button className="px-3 py-1.5 rounded-lg border text-white/50 hover:bg-white/10 transition-colors"
                  style={{ fontSize: FS.status*0.8, borderColor: 'rgba(255,255,255,0.1)' }}>
            ⛶ Fullscreen
          </button>
          <Clock fs={FS.headerH*2} />
        </div>
      </div>

      {/* Session/Arrival Banner */}
      <div style={{ height:FS.status*2.5, flexShrink:0, display:'flex', alignItems:'center', padding:'0 40px', background: doctor?.isArrived?'rgba(0,230,118,0.08)':'rgba(255,171,64,0.08)', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:doctor?.isArrived?'#00e676':'#ffab40', marginRight:15, boxShadow:`0 0 10px ${doctor?.isArrived?'#00e676':'#ffab40'}` }} />
        <span style={{ color:'white', fontWeight:700, marginRight:10 }}>{doctor?.isArrived ? 'DOCTOR IN SESSION' : 'EXPECTING DOCTOR'}</span>
        <span style={{ color:doctor?.isArrived?'#00e676':'#ffab40', marginRight: 20 }}>
          {doctor?.isArrived 
            ? `✓ Consultation Started ${doctor.arrivalTime ? `(Arrived at ${doctor.arrivalTime})` : ''}` 
            : `⏳ Patient arrivals in progress ${doctor?.expectedArrivalTime ? `(Expected at ${doctor.expectedArrivalTime})` : ''}`}
        </span>
        {doctor?.sessionNotes && (
          <span style={{ color:'#818cf8', fontSize:FS.status*0.8, background:'rgba(99,102,241,0.15)', padding:'4px 10px', borderRadius:8 }}>
            💬 {doctor.sessionNotes}
          </span>
        )}
        
        {/* Session selector for staff (hidden but clickable) */}
        {doctor?.sessions?.length > 1 && (
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            <button onClick={() => setSearchParams({})} className={`px-3 py-1 rounded text-[10px] font-bold ${!selSession?'bg-white text-black':'bg-white/10 text-white/50'}`}>OVERALL</button>
            {doctor.sessions.filter(s => s.dayOfWeek === new Date().getDay() && s.isActive).map(s => (
              <button key={s._id} onClick={() => setSearchParams({ sessionId: s._id })} 
                className={`px-3 py-1 rounded text-[10px] font-bold ${selSession === s._id?'bg-white text-black':'bg-white/10 text-white/50'}`}>
                {s.label || s.sessionName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conditional Layouts */}
      {hospital.displayLayout === 'classic_list' ? (
        <div style={{ flex:1, display:'flex', padding:20, gap:20, overflow:'hidden' }}>
          {/* List Section */}
          <div style={{ flex:1.5, background:'rgba(255,255,255,0.03)', borderRadius:24, border:'1px solid rgba(255,255,255,0.1)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'20px 30px', background:'rgba(255,255,255,0.05)', borderBottom:'1px solid rgba(255,255,255,0.1)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h2 style={{ fontFamily:'Sora', color:'white', fontSize:24 }}>Waiting Queue</h2>
              <span style={{ color:primary, fontWeight:800 }}>{waitingList.length} PATIENTS WAITING</span>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:20 }}>
              <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:'0 10px' }}>
                <thead>
                  <tr style={{ color:'rgba(255,255,255,0.3)', fontSize:12, textTransform:'uppercase', letterSpacing:1 }}>
                    <th style={{ textAlign:'left', padding:'0 20px' }}>Order</th>
                    <th style={{ textAlign:'left' }}>Token Number</th>
                    <th style={{ textAlign:'left' }}>Patient Name</th>
                    <th style={{ textAlign:'right', padding:'0 20px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {waitingList.map((p, idx) => (
                    <tr key={p._id} style={{ background:'rgba(255,255,255,0.02)', borderRadius:12 }}>
                      <td style={{ padding:'15px 20px', color:'rgba(255,255,255,0.3)', fontWeight:700 }}>{idx + 1}</td>
                      <td style={{ color:primary, fontWeight:800, fontSize:20 }}>#{p.queueNumber}</td>
                      <td style={{ color:'white' }}>{hospital.showPatientName ? p.patientName : '********'}</td>
                      <td style={{ textAlign:'right', padding:'0 20px' }}>
                        <span style={{ padding:'4px 12px', borderRadius:20, fontSize:10, fontWeight:800, background: idx===0?'#ff6b35':'rgba(255,255,255,0.1)', color:idx===0?'white':'rgba(255,255,255,0.5)' }}>
                          {idx === 0 ? 'UP NEXT' : 'WAITING'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Current / Slideshow Section */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:20 }}>
            <div className="card-3d" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:30 }}>
              <p style={{ color:'rgba(255,255,255,0.4)', fontSize:14, fontWeight:800, letterSpacing:2, marginBottom:10 }}>NOW SERVING</p>
              <h2 style={{ fontSize:100, fontFamily:'Oswald', color:primary, lineHeight:1, marginBottom:10 }}>{currentNumber || '—'}</h2>
              <p style={{ color:'white', fontSize:20, fontWeight:600 }}>{hospital.showPatientName ? currentPatient?.name : ''}</p>
            </div>
            <div style={{ flex:1.5, borderRadius:24, overflow:'hidden', border:'1px solid rgba(255,255,255,0.1)' }}>
              <DisplayMedia hospital={hospital} isArrived={doctor?.isArrived} />
            </div>
          </div>
        </div>
      ) : hospital.displayLayout === 'split_view' ? (
        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
          <div style={{ flex:1, borderRight:'1px solid rgba(255,255,255,0.1)' }}>
            <DisplayMedia hospital={hospital} isArrived={doctor?.isArrived} />
          </div>
          <div style={{ flex:1, display:'flex', flexDirection:'column', padding:30, gap:30 }}>
            <div className="card-3d" style={{ flex:1, display:'flex', flexDir:'column', alignItems:'center', justifyContent:'center' }}>
              <NowServing number={currentNumber} patientName={currentPatient?.name} showName={hospital.showPatientName} roomName={doctor?.room} fs={FS.bigNum*0.8} />
            </div>
            <div className="card-3d" style={{ flex:1, padding:20 }}>
              <h3 style={{ color:primary, fontFamily:'Sora', marginBottom:15 }}>Next in Queue</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:15 }}>
                {waitingList.slice(0,6).map(p => (
                  <div key={p._id} style={{ display:'flex', alignItems:'center', gap:10, padding:10, borderRadius:12, background:'rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize:24, fontWeight:800, color:primary }}>#{p.queueNumber}</span>
                    <span style={{ fontSize:12, color:'white' }}>{hospital.showPatientName ? p.patientName : '***'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : hospital.displayLayout === 'grid_compact' ? (
        <div style={{ flex:1, padding:25, display:'flex', gap:25 }}>
          <div style={{ flex:1.2, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:15 }}>
            <div className="card-3d" style={{ gridColumn:'span 3', padding:20, display:'flex', alignItems:'center', justifyContent:'around' }}>
               <div>
                  <p style={{ color:'rgba(255,255,255,0.4)', fontSize:12 }}>NOW SERVING</p>
                  <p style={{ fontSize:60, fontFamily:'Oswald', color:primary }}>#{currentNumber||'--'}</p>
               </div>
               <div style={{ borderLeft:'1px solid rgba(255,255,255,0.1)', paddingLeft:30 }}>
                  <p style={{ color:'rgba(255,255,255,0.4)', fontSize:12 }}>WAITING</p>
                  <p style={{ fontSize:60, fontFamily:'Oswald', color:'white' }}>{waitingList.length}</p>
               </div>
            </div>
            {waitingList.map(p => (
              <div key={p._id} className="card-3d" style={{ padding:15, textAlign:'center' }}>
                <p style={{ fontSize:32, fontFamily:'Oswald', color:primary }}>#{p.queueNumber}</p>
                <p style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:4 }}>{hospital.showPatientName ? p.patientName : '***'}</p>
              </div>
            ))}
          </div>
          <div className="card-3d" style={{ flex:0.8 }}>
            <DisplayMedia hospital={hospital} isArrived={doctor?.isArrived} />
          </div>
        </div>
      ) : (
        /* Original Futuristic Layout */
        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1.2fr 0.8fr', gap:15, padding:15, overflow:'hidden' }}>
          <div className="card-3d"><NowServing number={currentNumber} patientName={currentPatient?.name} showName={hospital.showPatientName} roomName={doctor?.room} sessionLabel={currentPatient?.sessionLabel} fs={FS.bigNum} /></div>
          <div className="card-3d" style={{ padding:10 }}><DisplayMedia hospital={hospital} isArrived={doctor?.isArrived} /></div>
          <div style={{ display:'flex', flexDirection:'column', gap:15 }}>
            <div className="card-3d" style={{ padding:20, flex:1, textAlign:'center', display:'flex', flexDirection:'column', justifyContent:'center' }}>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:700, letterSpacing:2 }}>TOTAL BOOKED</div>
                <div style={{ fontSize:FS.bigNum*0.4, fontFamily:'Oswald', color:primary, lineHeight:1 }}>{totalInQueue}</div>
                <div style={{ fontSize:14, color:'rgba(255,255,255,0.2)', marginTop:10 }}>{waitingList.length} waiting</div>
            </div>
            {waitingList[0] && (
              <div className="card-3d" style={{ padding:20, background:'linear-gradient(135deg, rgba(255,107,53,0.1), transparent)', borderColor:'rgba(255,107,53,0.3)' }}>
                <div style={{ fontSize:12, color:'#ff6b35', fontWeight:800, letterSpacing:2 }}>UP NEXT</div>
                <div style={{ fontSize:FS.bigNum*0.45, fontFamily:'Oswald', color:'#ff6b35', lineHeight:1 }}>{waitingList[0].queueNumber}</div>
                <div style={{ fontSize:14, color:'rgba(255,255,255,0.4)' }}>{waitingList[0].sessionLabel}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ribbon */}
      <div style={{ height:FS.headerH*6, flexShrink:0, background:'rgba(0,0,0,0.6)', borderTop:'2px solid rgba(255,255,255,0.1)' }}>
        <RibbonTimeline patients={waitingList} fs={FS.headerH*1.3} showName={hospital.showPatientName} />
      </div>

      {/* Ticker */}
      <div style={{ height:FS.ticker*4, flexShrink:0, background:primary+'33', display:'flex', alignItems:'center', borderTop:'2px solid rgba(255,255,255,0.1)' }}>
        <div className="ticker" style={{ fontFamily:'Oswald', fontSize:FS.ticker*1.8, fontWeight:900, color:'white', letterSpacing:3, textShadow:'2px 2px 4px rgba(0,0,0,0.5)' }}>
          &nbsp;&nbsp;&nbsp;&nbsp;{tickerText}&nbsp;&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;&nbsp;{tickerText}&nbsp;&nbsp;&nbsp;&nbsp;
        </div>
      </div>
      <div style={{ padding: '4px 20px', background: 'rgba(0,0,0,0.8)' }}>
        <ChevFooter minimal={true} />
      </div>
      </div>
    </div>
  );
}
