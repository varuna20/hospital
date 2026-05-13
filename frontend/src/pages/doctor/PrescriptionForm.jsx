import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { fDate, todayISO } from '../../utils/helpers';

const emptyDrug = () => ({ name:'', dosage:'', frequency:'', duration:'', route:'Oral', instructions:'', quantity:'' });
const FREQ = ['Once daily','Twice daily','3 times daily','4 times daily','Every 6h','Every 8h','As needed','At bedtime','With food'];
const ROUTES = ['Oral','Topical','IV','IM','Sublingual','Inhaled','Eye drops','Ear drops','Nasal'];


// Drug library autocomplete input
function DrugSearch({ value, onChange, onSelect }) {
  const [results, setResults] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef(null);
  const [dropPos, setDropPos] = React.useState({ top:0, left:0, width:0 });

  React.useEffect(() => {
    if (value.length < 1) { setResults([]); setOpen(false); return; }
    const t = setTimeout(() => {
      api.get('/drugs?q=' + value + '&limit=10').then(({ data }) => {
        setResults(data.drugs || []);
        if (data.drugs?.length > 0 && inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          setDropPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: Math.max(rect.width, 320) });
          setOpen(true);
        }
      }).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [value]);

  React.useEffect(() => {
    const close = (e) => { if (!e.target.closest('[data-drugsearch]')) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" data-drugsearch>
      <input ref={inputRef} className="input text-xs" placeholder="Type drug name…" value={value}
        onChange={e => onChange(e.target.value)} autoComplete="off" />
      {open && results.length > 0 && (
        <div style={{
          position: 'fixed',
          top: dropPos.top,
          left: dropPos.left,
          width: dropPos.width,
          zIndex: 9999,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-primary)',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          maxHeight: 320,
          overflowY: 'auto',
        }}>
          {results.map(drug => (
            <button key={drug._id} type="button"
              onMouseDown={e => { e.preventDefault(); onSelect(drug); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', background: 'transparent', border: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--color-primary-rgb),0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <p style={{ color:'white', fontWeight:600, fontSize:13, margin:0 }}>{drug.name}</p>
              <p style={{ color:'var(--color-text-muted)', fontSize:11, margin:'2px 0 0' }}>
                {[drug.defaultDosage, drug.defaultFrequency, drug.defaultRoute].filter(Boolean).join(' · ')}
                {drug.category && <span style={{ color:'var(--color-primary)', marginLeft:6 }}>({drug.category.split('/')[0].trim()})</span>}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DrugRow({ d, i, onChange, onRemove }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td className="px-2 py-2 text-center font-bold text-xs w-8" style={{ color:'var(--color-text-muted)' }}>{i+1}</td>
      <td className="px-2 py-2">
        <DrugSearch value={d.name} onChange={v=>onChange(i,'name',v)}
          onSelect={drug=>{
            onChange(i,'name',drug.name);
            if(drug.defaultDosage) onChange(i,'dosage',drug.defaultDosage);
            if(drug.defaultFrequency) onChange(i,'frequency',drug.defaultFrequency);
            if(drug.defaultDuration) onChange(i,'duration',drug.defaultDuration);
            if(drug.defaultRoute) onChange(i,'route',drug.defaultRoute);
            if(drug.defaultInstructions) onChange(i,'instructions',drug.defaultInstructions);
          }} />
      </td>
      <td className="px-2 py-2"><input className="input text-xs" placeholder="500mg" value={d.dosage} onChange={e=>onChange(i,'dosage',e.target.value)} /></td>
      <td className="px-2 py-2">
        <select className="input text-xs" value={d.frequency} onChange={e=>onChange(i,'frequency',e.target.value)}>
          <option value="">Select…</option>
          {FREQ.map(f=><option key={f}>{f}</option>)}
        </select>
      </td>
      <td className="px-2 py-2"><input className="input text-xs" placeholder="7 days" value={d.duration} onChange={e=>onChange(i,'duration',e.target.value)} /></td>
      <td className="px-2 py-2">
        <select className="input text-xs" value={d.route} onChange={e=>onChange(i,'route',e.target.value)}>
          {ROUTES.map(r=><option key={r}>{r}</option>)}
        </select>
      </td>
      <td className="px-2 py-2"><input className="input text-xs" placeholder="After food" value={d.instructions} onChange={e=>onChange(i,'instructions',e.target.value)} /></td>
      <td className="px-2 py-2"><input className="input text-xs" placeholder="21 tabs" value={d.quantity} onChange={e=>onChange(i,'quantity',e.target.value)} /></td>
      <td className="px-2 py-2">
        <button onClick={()=>onRemove(i)} className="text-xs px-2 py-1 rounded" style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444' }}>✕</button>
      </td>
    </tr>
  );
}

function PatientPicker({ selected, onSelect }) {
  const { hospital } = useAuth();
  const [q, setQ] = useState(selected?.name||'');
  const [results, setResults] = useState([]);
  useEffect(()=>{ if(selected) setQ(selected.name); },[selected]);
  useEffect(()=>{
    if(q.length<2||(selected&&q===selected.name)){setResults([]);return;}
    const t=setTimeout(()=>{
      api.get('/patients/search?q='+q+'&hospitalId='+(hospital?._id||'')).then(({data})=>setResults(data.patients||[]));
    },300);
    return()=>clearTimeout(t);
  },[q,selected,hospital]);
  return (
    <div className="relative">
      <label className="label">Patient *</label>
      <input className="input" placeholder="Search by name or phone…" value={q} onChange={e=>{setQ(e.target.value);if(selected)onSelect(null);}} />
      {results.length>0&&(
        <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl overflow-hidden shadow-2xl border" style={{ background:'var(--color-surface)',borderColor:'var(--color-border)' }}>
          {results.map(p=>(
            <button key={p._id} type="button" onClick={()=>{onSelect(p);setQ(p.name);setResults([]);}}
              className="w-full text-left px-4 py-2.5 text-sm hover:opacity-80" style={{ borderBottom:'1px solid var(--color-border)' }}>
              <p className="text-white font-medium">{p.name}</p>
              <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{p.phone}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PrescriptionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hospital } = useAuth();
  const isEdit = !!id;
  const [patient, setPatient] = useState(null);
  const [drugs, setDrugs] = useState([emptyDrug()]);
  const [prevRx, setPrevRx] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ visitDate:todayISO(), chiefComplaint:'', diagnosis:'', notes:'', followUpDate:'', followUpNotes:'' });
  const [vitals, setVitals] = useState({ bloodPressure:'', pulse:'', temperature:'', weight:'', height:'', spo2:'' });
  const [lh, setLh] = useState({
    hospitalName:hospital?.name||'', hospitalAddress:hospital?.address||'', hospitalPhone:hospital?.phone||'',
    hospitalLogo:hospital?.logo||'', doctorName:user?.name||'', doctorDegree:'', doctorSpecialty:'', doctorRegNo:'', showLogo:true, footerText:''
  });

  // Auto-fill letterhead from user profile on mount
  useEffect(()=>{
    api.get('/auth/me').then(({data})=>{
      if(!data.success) return;
      const u=data.user, h=u.hospital, dp=u.doctorProfile;
      setLh(prev=>({
        ...prev,
        hospitalName: h?.name||prev.hospitalName,
        hospitalAddress: h?.address||prev.hospitalAddress,
        hospitalPhone: h?.phone||prev.hospitalPhone,
        hospitalLogo: h?.logo||prev.hospitalLogo,
        doctorName: u.name||prev.doctorName,
        doctorDegree: (dp?.qualifications||[]).join(', ')||prev.doctorDegree,
        doctorSpecialty: dp?.specialization||prev.doctorSpecialty,
      }));
    }).catch(()=>{});
  },[]);

  useEffect(()=>{
    if(!isEdit) return;
    api.get('/prescriptions/'+id).then(({data})=>{
      if(!data.success) return;
      const rx=data.prescription;
      setPatient(rx.patient);
      setDrugs(rx.drugs?.length?rx.drugs:[emptyDrug()]);
      setForm({ visitDate:rx.visitDate?.split('T')[0]||todayISO(), chiefComplaint:rx.chiefComplaint||'', diagnosis:rx.diagnosis||'', notes:rx.notes||'', followUpDate:rx.followUpDate?.split('T')[0]||'', followUpNotes:rx.followUpNotes||'' });
      setVitals(rx.vitals||{bloodPressure:'',pulse:'',temperature:'',weight:'',height:'',spo2:''});
      if(rx.letterhead) setLh(rx.letterhead);
    }).catch(()=>toast.error('Failed to load'));
  },[isEdit,id]);

  useEffect(()=>{
    if(!patient?._id){setPrevRx([]);return;}
    api.get('/prescriptions/patient/'+patient._id).then(({data})=>setPrevRx((data.prescriptions||[]).slice(0,3))).catch(()=>{});
  },[patient]);

  const setDrug=(i,k,v)=>setDrugs(ds=>{const n=[...ds];n[i]={...n[i],[k]:v};return n;});
  const setV=(k,v)=>setVitals(p=>({...p,[k]:v}));
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));
  const setL=(k,v)=>setLh(p=>({...p,[k]:v}));

  const save=async()=>{
    if(!patient){toast.error('Select a patient');return;}
    setLoading(true);
    try{
      const payload={patientId:patient._id,...form,drugs,vitals,letterhead:lh};
      isEdit?await api.put('/prescriptions/'+id,payload):await api.post('/prescriptions',payload);
      toast.success(isEdit?'Updated!':'Prescription saved!');
      navigate('/doctor/prescriptions');
    }catch(err){toast.error(err.response?.data?.message||'Failed to save');}
    finally{setLoading(false);}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="page-title">{isEdit?'Edit Prescription':'New Prescription'}</h1>
          <p className="text-xs" style={{ color:'#f87171' }}>🔒 Confidential — Protected Patient Health Information</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isEdit&&<a href={'/prescription/print/'+id} target="_blank" rel="noreferrer" className="btn-ghost text-sm">🖨 Print</a>}
          <button onClick={()=>navigate(-1)} className="btn-ghost text-sm">← Back</button>
          <button onClick={save} disabled={loading} className="btn-primary">{loading?'Saving…':isEdit?'✓ Update':'✓ Save'}</button>
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-5">
        {/* MAIN FORM */}
        <div className="xl:col-span-2 space-y-4">

          {/* Patient */}
          <div className="card">
            <h3 className="section-title mb-4">Patient</h3>
            <PatientPicker selected={patient} onSelect={setPatient} />
            {patient&&(
              <div className="mt-3 rounded-xl p-3 flex items-center gap-3" style={{ background:'rgba(var(--color-primary-rgb),0.08)',border:'1px solid rgba(var(--color-primary-rgb),0.25)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white" style={{ background:'var(--color-primary)' }}>{patient.name.charAt(0)}</div>
                <div><p className="text-white font-medium text-sm">{patient.name}</p>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{patient.phone}</p></div>
              </div>
            )}
            {prevRx.length>0&&(
              <div className="mt-3 p-3 rounded-xl" style={{ background:'var(--color-surface2)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color:'var(--color-text-muted)' }}>📋 PREVIOUS VISITS</p>
                {prevRx.map(r=>(
                  <div key={r._id} className="text-xs mb-1 flex flex-wrap gap-2">
                    <span style={{ color:'var(--color-text-muted)' }}>{fDate(r.visitDate)}</span>
                    {r.diagnosis&&<span className="text-white">· {r.diagnosis}</span>}
                    {r.drugs?.length>0&&<span style={{ color:'var(--color-primary)' }}>· {r.drugs.slice(0,3).map(d=>d.name).join(', ')}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clinical */}
          <div className="card">
            <h3 className="section-title mb-4">Clinical Details</h3>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div><label className="label">Visit Date</label><input type="date" className="input" value={form.visitDate} onChange={e=>setF('visitDate',e.target.value)} /></div>
              <div><label className="label">Diagnosis</label><input className="input" value={form.diagnosis} onChange={e=>setF('diagnosis',e.target.value)} /></div>
              <div className="md:col-span-2"><label className="label">Chief Complaint</label><input className="input" placeholder="Presenting symptoms…" value={form.chiefComplaint} onChange={e=>setF('chiefComplaint',e.target.value)} /></div>
            </div>
            <p className="label mb-3">Vitals (optional)</p>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
              {[['bloodPressure','BP','120/80'],['pulse','Pulse','72 bpm'],['temperature','Temp','37°C'],['weight','Weight','65 kg'],['height','Height','170 cm'],['spo2','SpO₂','98%']].map(([k,l,ph])=>(
                <div key={k}><label className="label">{l}</label><input className="input" placeholder={ph} value={vitals[k]||''} onChange={e=>setV(k,e.target.value)} /></div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="label">Doctor's Notes (private)</label><textarea className="input resize-none" rows={3} value={form.notes} onChange={e=>setF('notes',e.target.value)} /></div>
              <div className="space-y-3">
                <div><label className="label">Follow-up Date</label><input type="date" className="input" value={form.followUpDate} onChange={e=>setF('followUpDate',e.target.value)} /></div>
                <div><label className="label">Follow-up Notes</label><textarea className="input resize-none" rows={2} value={form.followUpNotes} onChange={e=>setF('followUpNotes',e.target.value)} /></div>
              </div>
            </div>
          </div>

          {/* Drugs table */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Drugs / Prescription</h3>
              <button onClick={()=>setDrugs(d=>[...d,emptyDrug()])} className="btn-ghost text-sm">+ Add Drug</button>
            </div>
            <div className="overflow-x-auto -mx-5 px-0">
              <table className="w-full min-w-[850px]">
                <thead><tr style={{ background:'var(--color-surface2)' }}>
                  {['#','Drug Name *','Dosage','Frequency','Duration','Route','Instructions','Qty',''].map(h=>(
                    <th key={h} className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--color-text-muted)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {drugs.map((d,i)=><DrugRow key={i} d={d} i={i} onChange={setDrug} onRemove={j=>setDrugs(ds=>ds.filter((_,k)=>k!==j))} />)}
                </tbody>
              </table>
            </div>
            <button onClick={()=>setDrugs(d=>[...d,emptyDrug()])}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-medium"
              style={{ background:'rgba(var(--color-primary-rgb),0.06)',border:'1px dashed rgba(var(--color-primary-rgb),0.25)',color:'var(--color-primary)' }}>
              + Add Another Drug
            </button>
          </div>
        </div>

        {/* LETTERHEAD */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-title mb-1">Letterhead</h3>
            <p className="text-xs mb-4" style={{ color:'var(--color-text-muted)' }}>Customize the printed prescription header</p>
            <div className="space-y-2.5">
              {[['hospitalName','Hospital Name'],['hospitalAddress','Address'],['hospitalPhone','Phone'],
                ['doctorName','Doctor Name'],['doctorDegree','Qualifications (MBBS, MD…)'],
                ['doctorSpecialty','Specialty'],['doctorRegNo','Reg. No.'],['footerText','Footer Text']].map(([k,l])=>(
                <div key={k}><label className="label">{l}</label><input className="input text-xs" value={lh[k]||''} onChange={e=>setL(k,e.target.value)} /></div>
              ))}
              <label className="flex items-center gap-3 cursor-pointer pt-2">
                <div onClick={()=>setL('showLogo',!lh.showLogo)} className="relative w-10 h-6 rounded-full transition-colors"
                  style={{ background:lh.showLogo?'var(--color-primary)':'var(--color-surface2)' }}>
                  <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
                    style={{ transform:lh.showLogo?'translateX(18px)':'translateX(4px)' }} />
                </div>
                <span className="text-sm text-white">Show Logo</span>
              </label>
              {lh.hospitalLogo&&(
                <div><label className="label">Logo Preview</label>
                  <img src={lh.hospitalLogo} alt="logo" className="h-12 rounded object-contain" onError={e=>e.target.style.display='none'} /></div>
              )}
            </div>
          </div>
          <button onClick={save} disabled={loading} className="btn-primary w-full py-3">
            {loading?'Saving…':isEdit?'✓ Update':'✓ Save Prescription'}
          </button>
          {isEdit&&(
            <a href={'/prescription/print/'+id} target="_blank" rel="noreferrer"
              className="block w-full py-3 rounded-xl text-center text-sm font-medium transition-all"
              style={{ background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',color:'#10b981' }}>
              🖨 Print Prescription
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
