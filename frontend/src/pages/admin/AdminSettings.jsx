import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';

function Toggle({ value, onChange, label, desc }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>{desc}</p>}
      </div>
      <div onClick={()=>onChange(!value)} className="relative w-11 h-6 rounded-full cursor-pointer transition-colors flex-shrink-0"
        style={{ background: value?'var(--color-primary)':'var(--color-surface2)' }}>
        <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform:value?'translateX(22px)':'translateX(4px)' }} />
      </div>
    </div>
  );
}

const COLORS = [
  '#0d9488', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316',
  '#00d4aa', '#ff4757', '#2f3542', '#70a1ff', '#2ed573', '#ffa502', '#eccc68', '#ff7f50', '#a4b0be', '#57606f'
];

const THEME_PRESETS = [
  { name: 'Cyberpunk Teal', primary: '#00e5c4', background: '#02040a', surface: '#0a0f1e', accent: '#ff6b35' },
  { name: 'Midnight Indigo', primary: '#6366f1', background: '#0f172a', surface: '#1e293b', accent: '#f43f5e' },
  { name: 'Emerald Health', primary: '#10b981', background: '#061a14', surface: '#0c3026', accent: '#f59e0b' },
  { name: 'Hospital Classic', primary: '#0d9488', background: '#f8fafc', surface: '#ffffff', accent: '#6366f1', isDark: false },
  { name: 'Luxury Gold', primary: '#fbbf24', background: '#1c1917', surface: '#292524', accent: '#ffffff' },
  { name: 'Deep Ocean', primary: '#38bdf8', background: '#082f49', surface: '#0c4a6e', accent: '#fbbf24' },
  { name: 'Nordic Frost', primary: '#0ea5e9', background: '#f0f9ff', surface: '#ffffff', accent: '#6366f1', isDark: false },
  { name: 'Sunset Clinic', primary: '#f43f5e', background: '#450a0a', surface: '#7f1d1d', accent: '#fbbf24' },
  { name: 'Amethyst Night', primary: '#a855f7', background: '#1e1b4b', surface: '#312e81', accent: '#22d3ee' }
];

const LAYOUTS = [
  { id: 'futuristic_3d', name: 'Futuristic 3D', desc: 'Chevara Labs style with scanning lines and 3D effects', icon: '🚀' },
  { id: 'classic_list', name: 'Classic List', desc: 'Clean, professional table view for all doctors', icon: '📋' },
  { id: 'split_view', name: 'Split View', desc: 'Media on left, queue on right', icon: '🌓' },
  { id: 'grid_compact', name: 'Grid Compact', desc: 'Multi-doctor overview in a grid', icon: '🔲' }
];

const AUDIT_ACTIONS = [
  { id: '', label: 'All Actions' },
  { id: 'ADD_DRUG', label: 'Add Drug' },
  { id: 'UPDATE_DRUG', label: 'Update Drug' },
  { id: 'DELETE_DRUG', label: 'Delete Drug' },
  { id: 'IMPORT_DRUGS_CSV', label: 'Import CSV' },
  { id: 'UPDATE_DOCTOR_SCHEDULE', label: 'Schedule Edit' },
  { id: 'UPDATE_DOCTOR_SESSION', label: 'Session Edit' },
  { id: 'APPOINTMENT_BOOKED', label: 'New Booking' },
  { id: 'APPOINTMENT_STATUS_CHANGE', label: 'Queue Status' },
  { id: 'QUEUE_RESET', label: 'Queue Reset' },
  { id: 'REFUND_REQUESTED', label: 'Refund Requested' },
  { id: 'REFUND_DOCTOR_APPROVED', label: 'Refund Approved' },
  { id: 'REFUND_COMPLETED', label: 'Refund Completed' },
  { id: 'PRESCRIPTION_CREATED', label: 'Prescription' },
  { id: 'PRESCRIPTION_UPDATED', label: 'Rx Update' }
];

const TARGET_TYPES = [
  { id: '', label: 'All Targets' },
  { id: 'Drug', label: 'Drugs' },
  { id: 'Doctor', label: 'Doctors' },
  { id: 'Appointment', label: 'Bookings' },
  { id: 'Refund', label: 'Refunds' },
  { id: 'Queue', label: 'Queue' },
  { id: 'Prescription', label: 'Prescriptions' }
];

export default function AdminSettings() {
  const { hospital, updateHospital } = useAuth();
  const hid = hospital?._id;
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);
  const [tab, setTab] = useState('info');

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [auditFilter, setAuditFilter] = useState({ action: '', targetType: '' });

  useEffect(()=>{
    if(!hid) return;
    api.get('/hospitals/mine?hospitalId='+hid).then(({data})=>{ 
      if(data.success) setS(data.hospital); 
    }).catch(()=>toast.error('Load failed')).finally(()=>setLoading(false));
  },[hid]);

  const fetchLogs = () => {
    setLoadingLogs(true);
    let url = `/hospitals/${hid}/audit?`;
    if (auditFilter.action) url += `&action=${auditFilter.action}`;
    if (auditFilter.targetType) url += `&targetType=${auditFilter.targetType}`;

    api.get(url)
      .then(({data}) => setLogs(data.logs || []))
      .catch(() => toast.error('Failed to load logs'))
      .finally(() => setLoadingLogs(false));
  };

  useEffect(() => {
    if (tab === 'audit') fetchLogs();
  }, [tab, auditFilter]);

  const save = async()=>{
    setSaving(true);
    try{ 
      const { data } = await api.put('/hospitals/'+hid, s); 
      if (data.success) {
        setS(data.hospital);
        updateHospital(data.hospital); // Refresh global state for theme/branding
        toast.success('Saved!'); 
      }
    }
    catch{ toast.error('Save failed'); } finally{setSaving(false);}
  };

  const upd=(path,val)=>{
    setS(prev=>{
      const parts=path.split('.'), copy=JSON.parse(JSON.stringify(prev));
      let obj=copy;
      for(let i=0;i<parts.length-1;i++){if(!obj[parts[i]])obj[parts[i]]={};obj=obj[parts[i]];}
      obj[parts[parts.length-1]]=val; return copy;
    });
  };

  const testWA=async()=>{
    if(!testPhone){toast.error('Enter a phone number');return;}
    setTesting(true);
    try{ 
      const endpoint = tab === 'whatsapp' ? '/whatsapp/test' : '/hospitals/test-sms';
      const {data} = await api.post(endpoint, {testPhone, hospitalId:hid}); 
      toast[data.success?'success':'error'](data.message); 
    }
    catch(e){toast.error(e.response?.data?.message||'Failed');} finally{setTesting(false);}
  };

  if(loading) return <div className="text-center py-12" style={{ color:'var(--color-text-muted)' }}>Loading…</div>;
  if(!s) return null;

  const tabs=[
    {id:'info',l:'🏥 Info'},
    {id:'queue',l:'🔢 Queue'},
    {id:'whatsapp',l:'📱 WhatsApp'},
    {id:'theme',l:'🎨 Theme'},
    {id:'payment',l:'💳 Payment'},
    {id:'sms',l:'📱 SMS (text.lk)'},
    {id:'audit',l:'📋 Audit Logs'}
  ];

  const SMS_FIELDS = [
    { id:'booking', l:'Booking Confirmation', desc:'Sent when patient books a number', vars:['{patientName}', '{doctorName}', '{queueNumber}', '{date}', '{time}', '{fee}', '{trackUrl}'] },
    { id:'arrival', l:'Doctor Arrival', desc:'Sent when doctor session starts', vars:['{patientName}', '{doctorName}', '{arrivalTime}', '{queueNumber}', '{trackUrl}'] },
    { id:'late', l:'Doctor Late Alert', desc:'Notify if doctor is delayed', vars:['{patientName}', '{doctorName}', '{expectedTime}'] },
    { id:'change', l:'Appointment Update', desc:'Sent on booking changes', vars:['{patientName}', '{doctorName}', '{newDate}', '{newTime}'] },
    { id:'cancel', l:'Session Cancellation', desc:'Sent if doctor is absent', vars:['{patientName}', '{doctorName}', '{date}'] },
    { id:'turn',   l:'Turn Approaching', desc:'Sent when turn is near', vars:['{patientName}', '{queueNumber}', '{patientsAhead}'] },
    { id:'reminder', l:'Booking Reminder', desc:'Sent before appointment', vars:['{patientName}', '{doctorName}', '{date}', '{time}'] }
  ];

  const WA_FIELDS = [
    { id:'booking', l:'WhatsApp Booking', desc:'Sent on new booking', vars:['{patientName}', '{doctorName}', '{queueNumber}', '{date}', '{time}', '{fee}', '{address}'] },
    { id:'turn',    l:'WhatsApp Turn Alert', desc:'X people ahead alert', vars:['{patientName}', '{queueNumber}', '{peopleAhead}'] },
    { id:'arrival', l:'WhatsApp Doctor Arrival', desc:'Notify when session starts', vars:['{patientName}', '{doctorName}', '{room}'] },
    { id:'late',    l:'WhatsApp Delay Alert', desc:'Notify if delayed', vars:['{patientName}', '{doctorName}', '{expectedTime}'] },
    { id:'cancel',  l:'WhatsApp Cancellation', desc:'Sent if session cancelled', vars:['{patientName}', '{doctorName}', '{reason}'] },
    { id:'reminder',l:'WhatsApp Reminder', desc:'Appointment reminder', vars:['{patientName}', '{doctorName}', '{date}'] }
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="page-title">Settings</h1><p className="text-sm" style={{ color:'var(--color-text-muted)' }}>{s.name}</p></div>
        <button onClick={save} disabled={saving} className="btn-primary">{saving?'Saving…':'💾 Save All'}</button>
      </div>
      <div className="flex gap-1 mb-6 border-b flex-wrap" style={{ borderColor:'var(--color-border)' }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className="px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap"
            style={{ color:tab===t.id?'var(--color-primary)':'var(--color-text-muted)', borderBottom:tab===t.id?'2px solid var(--color-primary)':'2px solid transparent', marginBottom:'-1px' }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==='info'&&(
        <div className="card max-w-2xl">
          <h3 className="section-title mb-4">Hospital Information</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {[['name','Hospital Name'],['shortName','Short Name'],['phone','Phone'],['email','Email'],['website','Website'],['address','Address'],['city','City'],['country','Country']].map(([k,l])=>(
              <div key={k}><label className="label">{l}</label><input className="input" value={s[k]||''} onChange={e=>upd(k,e.target.value)} /></div>
            ))}
          </div>
          <h4 className="section-title text-sm mb-3">Clinic Hours</h4>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="label">Opening Time</label><input type="time" className="input" value={s.clinicHours?.open||'08:00'} onChange={e=>upd('clinicHours.open',e.target.value)} /></div>
            <div><label className="label">Closing Time</label><input type="time" className="input" value={s.clinicHours?.close||'20:00'} onChange={e=>upd('clinicHours.close',e.target.value)} /></div>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary w-full">{saving?'Saving…':'Save Info'}</button>
        </div>
      )}

      {tab==='queue'&&(
        <div className="card max-w-2xl">
          <h3 className="section-title mb-1">Queue Settings</h3>
          <p className="text-xs mb-4" style={{ color:'var(--color-text-muted)' }}>Controls queue behavior and display screen</p>
          <div className="divide-y mb-4" style={{ borderColor:'var(--color-border)' }}>
            <Toggle value={s.queueSettings?.autoResetAtMidnight} label="Auto-reset Queue at Midnight" desc="Start fresh each day automatically" onChange={v=>upd('queueSettings.autoResetAtMidnight',v)} />
            <Toggle value={s.queueSettings?.showPatientNameOnDisplay} label="Show Names on Display Screen" desc="Show patient names on the waiting room TV" onChange={v=>upd('queueSettings.showPatientNameOnDisplay',v)} />
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div><label className="label">Avg. Minutes Per Patient</label>
              <input type="number" min={5} max={120} className="input" value={s.queueSettings?.avgConsultMinutes||15} onChange={e=>upd('queueSettings.avgConsultMinutes',Number(e.target.value))} />
              <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>Used for wait time estimates</p></div>
            <div><label className="label">Alert When X People Ahead</label>
              <input type="number" min={1} max={10} className="input" value={s.queueSettings?.notifyWhenAhead||3} onChange={e=>upd('queueSettings.notifyWhenAhead',Number(e.target.value))} />
              <p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>Sends WhatsApp when this close</p></div>
          </div>
          <div><label className="label">Display Screen Announcement</label>
            <textarea className="input resize-none" rows={3} placeholder="Holiday notice, special hours, etc…" value={s.queueSettings?.announcement||''} onChange={e=>upd('queueSettings.announcement',e.target.value)} /></div>
          <button onClick={save} disabled={saving} className="btn-primary mt-4 w-full">{saving?'Saving…':'Save Queue Settings'}</button>
        </div>
      )}

      {tab==='whatsapp'&&(
        <div className="card max-w-2xl space-y-4">
          <div className="flex items-center gap-3 pb-1">
            <span className="text-3xl">📱</span>
            <div><h3 className="section-title">WhatsApp Notifications</h3>
              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Powered by Twilio WhatsApp API</p></div>
            <div className="ml-auto"><Toggle value={s.whatsapp?.enabled} onChange={v=>upd('whatsapp.enabled',v)} label="" /></div>
          </div>
          {s.whatsapp?.enabled ? (
            <>
              <div className="p-3 rounded-xl text-xs" style={{ background:'rgba(37,211,102,0.08)',border:'1px solid rgba(37,211,102,0.2)',color:'#86efac' }}>
                <strong>Setup:</strong> Get credentials at{' '}
                <a href="https://console.twilio.com" target="_blank" rel="noreferrer" style={{ color:'#4ade80',textDecoration:'underline' }}>console.twilio.com</a>
                {' '}→ Enable WhatsApp Sandbox.
              </div>
              <div className="grid gap-3">
                {[['whatsapp.twilioSid','Twilio Account SID','text','ACxxxxxxxxxx'],
                  ['whatsapp.twilioToken','Twilio Auth Token','password'],
                  ['whatsapp.fromNumber','From Number','text','whatsapp:+14155238886']].map(([k,l,t,ph])=>(
                  <div key={k}><label className="label">{l}</label>
                    <input type={t} className="input" placeholder={ph||''} value={s.whatsapp?.[k.split('.')[1]]||''} onChange={e=>upd(k,e.target.value)} /></div>
                ))}
              </div>
              <div className="border-t pt-3 divide-y" style={{ borderColor:'var(--color-border)' }}>
                <Toggle value={s.whatsapp?.notifyOnBook} onChange={v=>upd('whatsapp.notifyOnBook',v)} label="Booking Confirmation" desc="Send WhatsApp when patient books" />
                <Toggle value={s.whatsapp?.notifyOnTurn} onChange={v=>upd('whatsapp.notifyOnTurn',v)} label="Turn Alert" desc="Notify when patient's turn is near" />
                <Toggle value={s.whatsapp?.notifyDoctor} onChange={v=>upd('whatsapp.notifyDoctor',v)} label="Session Summary to Doctor" desc="Send bookings + patient list before session" />
              </div>
              <div className="p-3 rounded-xl flex items-end gap-3" style={{ background:'var(--color-surface2)' }}>
                <div className="flex-1"><label className="label">Test WhatsApp</label>
                  <input className="input" placeholder="+94771234567" value={testPhone} onChange={e=>setTestPhone(e.target.value)} /></div>
                <button onClick={testWA} disabled={testing||!testPhone} className="btn-primary flex-shrink-0">{testing?'Sending…':'Send Test'}</button>
              </div>

              <div className="border-t pt-4 mt-2">
                <h3 className="section-title text-sm mb-4">WhatsApp Templates</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {WA_FIELDS.map(f => (
                    <div key={f.id} className="space-y-1.5">
                      <label className="label font-bold text-[10px] uppercase tracking-wider">{f.l}</label>
                      <textarea className="input text-xs" rows={4} value={s.whatsapp?.templates?.[f.id] || ''} onChange={e => upd(`whatsapp.templates.${f.id}`, e.target.value)} />
                      <div className="flex flex-wrap gap-1">
                        {f.vars.map(v => (
                          <span key={v} className="text-[9px] px-1 rounded bg-white/5 text-white/40 border border-white/5">{v}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8" style={{ color:'var(--color-text-muted)' }}>
              <div className="text-4xl mb-3">📱</div>
              <p className="text-sm">Enable WhatsApp above to configure</p>
              <p className="text-xs mt-2">Requires a Twilio account with WhatsApp enabled</p>
            </div>
          )}
          <button onClick={save} disabled={saving} className="btn-primary w-full">{saving?'Saving…':'Save WhatsApp Settings'}</button>
        </div>
      )}

      {tab==='theme'&&(
        <div className="space-y-6">
          <div className="card max-w-2xl">
            <h3 className="section-title mb-4">Display Layout</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {LAYOUTS.map(l => (
                <div key={l.id} onClick={() => upd('displayLayout', l.id)}
                  className="p-4 rounded-2xl cursor-pointer border-2 transition-all flex items-start gap-4"
                  style={{ 
                    background: s.displayLayout === l.id ? 'rgba(var(--color-primary-rgb),0.1)' : 'var(--color-surface2)',
                    borderColor: s.displayLayout === l.id ? 'var(--color-primary)' : 'transparent'
                  }}>
                  <span className="text-3xl">{l.icon}</span>
                  <div>
                    <p className="font-bold text-white text-sm">{l.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{l.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card max-w-2xl space-y-6">
            <h3 className="section-title">Branding & Colors</h3>
            
            <div className="space-y-3">
              <label className="label">Theme Presets</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {THEME_PRESETS.map(p => (
                  <button key={p.name} onClick={() => {
                    upd('theme.primary', p.primary);
                    upd('theme.background', p.background);
                    upd('theme.surface', p.surface);
                    upd('theme.accent', p.accent);
                  }}
                  className="px-3 py-2 rounded-xl text-[10px] font-bold border transition-all text-left flex items-center gap-2"
                  style={{ background: 'var(--color-surface2)', borderColor: 'var(--color-border)' }}>
                    <div className="w-3 h-3 rounded-full" style={{ background: p.primary }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4 flex items-center gap-4 transition-all" style={{ background:s.theme?.background||'#0f172a', border:'1px solid var(--color-border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg" style={{ background:s.theme?.primary||'#0d9488' }}>{s.name?.charAt(0)||'H'}</div>
              <div><p className="font-bold text-white">{s.name}</p><p className="text-xs" style={{ color:s.theme?.primary||'#0d9488' }}>Live Theme Preview</p></div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                ['theme.primary', 'Primary Color', 'Main buttons, numbers'],
                ['theme.background', 'Background', 'Deep screen color'],
                ['theme.surface', 'Surface', 'Cards and panels'],
                ['theme.accent', 'Accent', 'Highlights, UP NEXT']
              ].map(([k, l, d]) => {
                const key = k.split('.')[1];
                return (
                  <div key={k} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <label className="label mb-0">{l}</label>
                    <p className="text-[10px] mb-3" style={{ color: 'var(--color-text-muted)' }}>{d}</p>
                    
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative">
                        <input type="color" value={s.theme?.[key]||'#0d9488'} onChange={e=>upd(k,e.target.value)} className="w-12 h-12 rounded-xl cursor-pointer border-2 border-white/20 p-0 bg-transparent" />
                      </div>
                      <input className="input text-xs font-mono py-1" value={s.theme?.[key]||''} onChange={e=>upd(k,e.target.value)} />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => upd(k, c)} 
                          className="w-6 h-6 rounded-full border border-white/10 transition-transform hover:scale-125"
                          style={{ background: c, boxShadow: s.theme?.[key] === c ? `0 0 0 2px white` : 'none' }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={save} disabled={saving} className="btn-primary w-full">{saving?'Saving…':'💾 Apply Theme Changes'}</button>
          </div>
        </div>
      )}


      {tab==='sms'&&(
        <div className="max-w-4xl space-y-6">
          <div className="card space-y-4">
            <h3 className="section-title">Gateway Settings (text.lk)</h3>
            <Toggle value={s.sms?.enabled} onChange={v=>upd('sms.enabled',v)} label="Enable SMS Notifications" desc="Send SMS via text.lk gateway" />
            {s.sms?.enabled&&(
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="label">text.lk API Key</label>
                  <input type="password" className="input" placeholder="Bearer Token"
                    value={s.sms?.textLkApiKey||''} onChange={e=>upd('sms.textLkApiKey',e.target.value)} /></div>
                <div><label className="label">Sender ID</label>
                  <input className="input" placeholder="CITYMEDI" maxLength={11}
                    value={s.sms?.senderId||''} onChange={e=>upd('sms.senderId',e.target.value.slice(0,11))} /></div>
                <div className="col-span-2 divide-y" style={{ borderColor:'var(--color-border)' }}>
                  <Toggle value={s.sms?.notifyOnBook} onChange={v=>upd('sms.notifyOnBook',v)} label="Booking Confirmation" />
                  <Toggle value={s.sms?.notifyOnTurn} onChange={v=>upd('sms.notifyOnTurn',v)} label="Turn Alert" />
                  <Toggle value={s.sms?.notifyArrival} onChange={v=>upd('sms.notifyArrival',v)} label="Doctor Arrival" />
                </div>
              </div>
            )}
            <div className="p-3 rounded-xl flex items-end gap-3" style={{ background:'var(--color-surface2)' }}>
              <div className="flex-1"><label className="label">Test SMS</label>
                <input className="input" placeholder="+94771234567" value={testPhone} onChange={e=>setTestPhone(e.target.value)} /></div>
              <button onClick={testWA} disabled={testing||!testPhone} className="btn-primary flex-shrink-0">{testing?'Sending…':'Send Test'}</button>
            </div>
            <button onClick={save} disabled={saving} className="btn-primary w-full">{saving?'Saving…':'Save SMS Configuration'}</button>
          </div>

          {s.sms?.enabled && (
            <div className="card space-y-4">
              <h3 className="section-title">Customize SMS Templates</h3>
              <div className="grid md:grid-cols-2 gap-6">
                {SMS_FIELDS.map(f => (
                  <div key={f.id} className="space-y-2">
                    <label className="label font-bold">{f.l}</label>
                    <textarea className="input text-sm" rows={4} value={s.sms?.templates?.[f.id] || ''} onChange={e => upd(`sms.templates.${f.id}`, e.target.value)} />
                    <div className="flex flex-wrap gap-1 mt-1">
                      {f.vars.map(v => (
                        <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">{v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={save} disabled={saving} className="btn-primary w-full mt-4">✓ Update All Templates</button>
            </div>
          )}
        </div>
      )}

      {tab==='audit'&&(
        <div className="card">
          <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
            <div>
              <h3 className="section-title">Audit Trail</h3>
              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>Complete history of system changes.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <select className="input text-xs h-9 py-1 w-auto" value={auditFilter.targetType} onChange={e=>setAuditFilter(p=>({...p, targetType: e.target.value}))}>
                {TARGET_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <select className="input text-xs h-9 py-1 w-auto" value={auditFilter.action} onChange={e=>setAuditFilter(p=>({...p, action: e.target.value}))}>
                {AUDIT_ACTIONS.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              <button onClick={fetchLogs} className="btn-ghost text-xs h-9">↻ Refresh</button>
            </div>
          </div>
          
          {loadingLogs ? (
            <div className="py-10 text-center opacity-30">Loading logs...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor:'var(--color-border)' }}>
                    <th className="py-3 font-semibold text-white/60">Time</th>
                    <th className="py-3 font-semibold text-white/60">User</th>
                    <th className="py-3 font-semibold text-white/60">Action</th>
                    <th className="py-3 font-semibold text-white/60">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor:'var(--color-border)' }}>
                  {logs.map(l => (
                    <tr key={l._id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 text-xs text-white/40">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="py-3">
                        <div className="text-white font-medium">{l.userName}</div>
                        <div className="text-[10px] text-white/40">{l.userRole}</div>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background:'rgba(var(--color-primary-rgb),0.1)', color:'var(--color-primary)' }}>
                          {l.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="text-white">{l.targetName}</div>
                        <div className="text-[10px] text-white/40">{l.targetType}</div>
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr><td colSpan="4" className="py-10 text-center text-white/20">No logs found for selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab==='payment'&&(
        <div className="card max-w-xl space-y-4">
          <h3 className="section-title">Payment Settings</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="label">Currency Symbol</label><input className="input" value={s.payment?.currencySymbol||'Rs.'} onChange={e=>upd('payment.currencySymbol',e.target.value)} /></div>
            <div><label className="label">Default Hospital Charge</label><input type="number" className="input" value={s.payment?.defaultHospitalCharge||0} onChange={e=>upd('payment.defaultHospitalCharge',Number(e.target.value))} /></div>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary w-full">{saving?'Saving…':'Save Payment Settings'}</button>
        </div>
      )}
    </div>
  );
}
