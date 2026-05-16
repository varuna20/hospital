import HospitalManager from './HospitalManager';
import React, { useState, useEffect } from 'react';
import api, { fUrl } from '../../utils/api';
import toast from 'react-hot-toast';

const COLORS = ['#0d9488','#6366f1','#ec4899','#f59e0b','#10b981','#0ea5e9','#ef4444','#8b5cf6','#f97316','#06b6d4'];

function ColorPick({ label, value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        <input type="color" value={value||'#0d9488'} onChange={e=>onChange(e.target.value)} className="w-9 h-9 rounded-lg cursor-pointer border-0" />
        {COLORS.map(c=>(
          <button key={c} type="button" onClick={()=>onChange(c)} className="w-6 h-6 rounded-full border-2 transition-all"
            style={{ background:c, borderColor: value===c?'white':'transparent' }} />
        ))}
        <span className="text-xs font-mono" style={{ color:'var(--color-text-muted)' }}>{value}</span>
      </div>
    </div>
  );
}

function HospitalForm({ hospital: editH, onSave, onCancel }) {
  const isEdit = !!editH;
  const [step, setStep] = useState(0);
  const [savedId, setSavedId] = useState(editH?._id||null);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState({ name:editH?.name||'', shortName:editH?.shortName||'', slug:editH?.slug||'', city:editH?.city||'', phone:editH?.phone||'', email:editH?.email||'', address:editH?.address||'', subscriptionPlan:editH?.subscriptionPlan||'trial', payment:{ defaultHospitalCharge:editH?.payment?.defaultHospitalCharge||500, currencySymbol:editH?.payment?.currencySymbol||'Rs.' } });
  const [theme, setTheme] = useState({ primary:editH?.theme?.primary||'#0d9488', secondary:editH?.theme?.secondary||'#0f172a', accent:editH?.theme?.accent||'#f59e0b', background:editH?.theme?.background||'#0f172a', surface:editH?.theme?.surface||'#1e293b', text:editH?.theme?.text||'#e2e8f0' });
  const [adminForm, setAdminForm] = useState({ name:'', email:'', password:'Admin@123', phone:'' });

  useEffect(()=>{
    if(!isEdit&&info.name&&!info.slug)
      setInfo(i=>({...i,slug:info.name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')}));
  },[info.name]);

  const saveInfo = async () => {
    if(!info.name||!info.slug){toast.error('Name and slug required');return;}
    setLoading(true);
    try {
      let res;
      if(savedId){
        res = await api.put('/superadmin/hospitals/'+savedId,{...info,theme});
        toast.success('Updated!');
        if(isEdit){onSave();return;}
      } else {
        res = await api.post('/superadmin/hospitals',{...info,theme});
        setSavedId(res.data.hospital._id);
        toast.success('Hospital created!');
      }
      setStep(1);
    } catch(e){ toast.error(e.response?.data?.message||'Error'); }
    finally{setLoading(false);}
  };

  const saveTheme = async () => {
    if(!savedId){toast.error('Save info first');return;}
    setLoading(true);
    try {
      await api.put('/superadmin/hospitals/'+savedId,{theme});
      toast.success('Theme saved!');
      setStep(2); // ← THIS IS THE FIX: correctly advances to step 2
    } catch(e){ toast.error(e.response?.data?.message||'Error saving theme'); }
    finally{setLoading(false);}
  };

  const saveAdmin = async () => {
    if(!adminForm.name||!adminForm.email||!adminForm.password){toast.error('Name, email & password required');return;}
    setLoading(true);
    try {
      await api.post('/superadmin/hospitals/'+savedId+'/admin',adminForm);
      toast.success('Hospital & admin created successfully!');
      onSave();
    } catch(e){ toast.error(e.response?.data?.message||'Error'); }
    finally{setLoading(false);}
  };

  const stepLabels = ['Basic Info','Theme','Admin Account'];

  return (
    <div className="card border-2 mb-5" style={{ borderColor:'var(--color-primary)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">{isEdit?'Edit — '+editH.name:'New Hospital'}</h3>
        <button onClick={onCancel} className="btn-ghost text-sm">✕</button>
      </div>

      {!isEdit&&(
        <div className="flex items-center gap-2 mb-5">
          {stepLabels.map((s,i)=>(
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background:i<step?'var(--color-primary)':i===step?'rgba(var(--color-primary-rgb),0.2)':'var(--color-surface2)',
                           color:i<=step?'var(--color-primary)':'var(--color-text-muted)',
                           border:i===step?'2px solid var(--color-primary)':'none' }}>
                  {i<step?'✓':i+1}
                </div>
                <span className="text-xs hidden sm:block" style={{ color:i===step?'var(--color-text)':'var(--color-text-muted)' }}>{s}</span>
              </div>
              {i<stepLabels.length-1&&<div className="w-6 h-px" style={{ background:i<step?'var(--color-primary)':'var(--color-border)' }} />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* STEP 0 - INFO */}
      {step===0&&(
        <div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {[['name','Hospital Name *'],['shortName','Short Name'],['slug','URL Slug *'],['city','City'],['phone','Phone'],['email','Email'],['address','Address']].map(([k,l])=>(
              <div key={k}><label className="label">{l}</label>
                <input className="input" value={info[k]||''} onChange={e=>setInfo(p=>({...p,[k]:e.target.value}))} /></div>
            ))}
            <div><label className="label">Subscription Plan</label>
              <select className="input" value={info.subscriptionPlan} onChange={e=>setInfo(p=>({...p,subscriptionPlan:e.target.value}))}>
                {['trial','basic','premium','enterprise'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="label">Default Hospital Charge</label>
              <input type="number" className="input" value={info.payment?.defaultHospitalCharge||0} onChange={e=>setInfo(p=>({...p,payment:{...p.payment,defaultHospitalCharge:Number(e.target.value)}}))} /></div>
            <div><label className="label">Currency Symbol</label>
              <input className="input" value={info.payment?.currencySymbol||'Rs.'} onChange={e=>setInfo(p=>({...p,payment:{...p.payment,currencySymbol:e.target.value}}))} /></div>
            
            <div className="md:col-span-2">
              <label className="label">Hospital Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center overflow-hidden bg-white/5">
                  {editH?.logo ? <img src={fUrl(editH.logo)} className="w-full h-full object-cover" /> : <span className="text-2xl opacity-20">🏥</span>}
                </div>
                <input type="file" accept="image/*" className="text-xs text-white/50 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" 
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if(!file || !savedId) { 
                      if(!savedId) toast.error('Save hospital info first before uploading logo');
                      return; 
                    }
                    const formData = new FormData();
                    formData.append('logo', file);
                    try {
                      toast.loading('Uploading logo...');
                      await api.put(`/superadmin/hospitals/${savedId}/logo`, formData);
                      toast.dismiss();
                      toast.success('Logo uploaded!');
                      onSave(); // Refresh
                    } catch(err) {
                      toast.dismiss();
                      toast.error('Logo upload failed');
                    }
                  }}
                />
              </div>
            </div>
          </div>
          {isEdit&&(
            <div className="mt-4 pt-4 border-t space-y-4" style={{ borderColor:'var(--color-border)' }}>
              <h4 className="section-title">Color Theme</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <ColorPick label="Primary Color" value={theme.primary} onChange={v=>setTheme(t=>({...t,primary:v}))} />
                <ColorPick label="Accent Color" value={theme.accent} onChange={v=>setTheme(t=>({...t,accent:v}))} />
              </div>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button onClick={saveInfo} disabled={loading} className="btn-primary">{loading?'Saving…':isEdit?'✓ Save':'Next: Choose Theme →'}</button>
            <button onClick={onCancel} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* STEP 1 - THEME */}
      {step===1&&!isEdit&&(
        <div>
          <div className="rounded-xl p-4 flex items-center gap-4 mb-5 transition-all" style={{ background:theme.secondary }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white" style={{ background:theme.primary }}>{info.name?.charAt(0)||'H'}</div>
            <div>
              <p className="font-bold text-white">{info.name||'Hospital'}</p>
              <p className="text-xs" style={{ color:theme.primary }}>Live Theme Preview</p>
            </div>
            <div className="ml-auto flex gap-2">
              {['primary','accent'].map(k=><div key={k} className="w-7 h-7 rounded-full border-2 border-white/20" style={{ background:theme[k] }} />)}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <ColorPick label="Primary Color" value={theme.primary} onChange={v=>setTheme(t=>({...t,primary:v}))} />
            <ColorPick label="Accent Color" value={theme.accent} onChange={v=>setTheme(t=>({...t,accent:v}))} />
          </div>
          <div className="flex gap-3">
            <button onClick={()=>setStep(0)} className="btn-ghost">← Back</button>
            <button onClick={saveTheme} disabled={loading} className="btn-primary">
              {loading?'Saving Theme…':'Save Theme & Next: Create Admin →'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 - ADMIN */}
      {step===2&&!isEdit&&(
        <div>
          <div className="p-4 rounded-xl mb-4" style={{ background:'rgba(var(--color-primary-rgb),0.08)', border:'1px solid rgba(var(--color-primary-rgb),0.25)' }}>
            <p className="text-sm text-white font-medium">Hospital created: <strong>{info.name}</strong></p>
            <p className="text-xs mt-0.5" style={{ color:'var(--color-text-muted)' }}>Now create the admin account for this hospital.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {[['name','Admin Name *'],['email','Admin Email *'],['phone','Phone']].map(([k,l])=>(
              <div key={k}><label className="label">{l}</label>
                <input className="input" value={adminForm[k]||''} onChange={e=>setAdminForm(p=>({...p,[k]:e.target.value}))} /></div>
            ))}
            <div><label className="label">Password *</label>
              <input type="password" className="input" value={adminForm.password||''} onChange={e=>setAdminForm(p=>({...p,password:e.target.value}))} /></div>
          </div>
          <div className="flex gap-3">
            <button onClick={()=>setStep(1)} className="btn-ghost">← Back</button>
            <button onClick={saveAdmin} disabled={loading} className="btn-primary">{loading?'Creating…':'✓ Create Hospital & Admin'}</button>
            <button onClick={()=>{toast('Hospital saved. Add admin later from hospital card.',{icon:'ℹ️'});onSave();}} className="btn-ghost text-sm">Skip for now</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddAdminModal({ hospital, onDone }) {
  const [form, setForm] = useState({ name:'', email:'', password:'Admin@123', phone:'' });
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    try { await api.post('/superadmin/hospitals/'+hospital._id+'/admin',form); toast.success('Admin added!'); onDone(); }
    catch(e){ toast.error(e.response?.data?.message||'Failed'); } finally{setLoading(false);}
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.7)' }}>
      <div className="card max-w-md w-full mx-4">
        <h3 className="section-title mb-3">Add Admin — {hospital?.name}</h3>
        <div className="space-y-3 mb-4">
          {[['name','Name *'],['email','Email *'],['phone','Phone'],['password','Password *']].map(([k,l])=>(
            <div key={k}><label className="label">{l}</label>
              <input type={k==='password'?'password':'text'} className="input" value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} /></div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={loading} className="btn-primary">{loading?'Adding…':'+ Add Admin'}</button>
          <button onClick={onDone} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function SuperHospitals() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editH, setEditH] = useState(null);
  const [addAdminH, setAddAdminH] = useState(null);
  const [manageH, setManageH] = useState(null);
  const [showAdmins, setShowAdmins] = useState({});
  const [adminsData, setAdminsData] = useState({});

  const fetch = async () => {
    try { const { data } = await api.get('/superadmin/hospitals'); setHospitals(data.hospitals||[]); }
    catch { toast.error('Failed to load'); } finally { setLoading(false); }
  };
  useEffect(()=>{ fetch(); },[]);

  const toggle = async (id) => { try { await api.put('/superadmin/hospitals/'+id+'/toggle'); fetch(); } catch { toast.error('Failed'); } };

  const loadAdmins = async (id) => {
    if(showAdmins[id]){setShowAdmins(s=>({...s,[id]:false}));return;}
    try {
      const { data } = await api.get('/superadmin/hospitals/'+id+'/admins');
      setAdminsData(d=>({...d,[id]:data.admins||[]}));
      setShowAdmins(s=>({...s,[id]:true}));
    } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="page-title">Hospitals</h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>{hospitals.length} registered</p>
        </div>
        <button onClick={()=>{ setShowForm(true); setEditH(null); }} className="btn-primary">+ New Hospital</button>
      </div>

      {(showForm||editH)&&(
        <HospitalForm hospital={editH}
          onSave={()=>{ setShowForm(false); setEditH(null); fetch(); }}
          onCancel={()=>{ setShowForm(false); setEditH(null); }}
        />
      )}

      {manageH&&<HospitalManager hospital={manageH} onClose={()=>setManageH(null)} />}
      {addAdminH&&<AddAdminModal hospital={addAdminH} onDone={()=>{ setAddAdminH(null); fetch(); }} />}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading?Array(4).fill(0).map((_,i)=><div key={i} className="card animate-pulse h-48"/>)
          :hospitals.map(h=>(
          <div key={h._id} className="card overflow-hidden">
            <div className="h-1.5 -mx-5 -mt-5 mb-4 rounded-t-xl" style={{ background:h.theme?.primary||'#0d9488' }} />
            <div className="flex items-start gap-3 mb-3">
              {h.logo ? (
                <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                  <img src={fUrl(h.logo)} alt={h.name} className="w-full h-full object-cover" onError={(e)=>{e.target.style.display='none'; e.target.parentElement.innerHTML=`<div class="w-full h-full flex items-center justify-center font-bold text-white" style="background:${h.theme?.primary||'#0d9488'}">${h.name.charAt(0)}</div>`}} />
                </div>
              ) : (
                <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0" style={{ background:h.theme?.primary||'#0d9488' }}>{h.name.charAt(0)}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white truncate">{h.name}</p>
                <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{h.city} · <span className="capitalize">{h.subscriptionPlan}</span></p>
                <p className="text-xs font-mono" style={{ color:h.theme?.primary||'var(--color-primary)' }}>/{h.slug}</p>
              </div>
              <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ background:h.isActive?'#10b981':'#ef4444' }} />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[['Doctors',h._counts?.doctors||0],['Patients',h._counts?.patients||0],['Today',h._counts?.todayApts||0]].map(([l,v])=>(
                <div key={l} className="text-center py-2 rounded-lg" style={{ background:'var(--color-surface2)' }}>
                  <p className="font-bold text-white">{v}</p>
                  <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{l}</p>
                </div>
              ))}
            </div>
            {showAdmins[h._id]&&(
              <div className="mb-3 p-2 rounded-xl" style={{ background:'var(--color-surface2)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color:'var(--color-text-muted)' }}>ADMINS</p>
                {(adminsData[h._id]||[]).length===0?<p className="text-xs" style={{ color:'var(--color-text-muted)' }}>None yet</p>
                  :(adminsData[h._id]||[]).map(a=><p key={a._id} className="text-xs text-white">{a.name} · {a.email}</p>)}
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <button onClick={()=>{ setEditH(h); setShowForm(false); window.scrollTo(0,0); }} className="btn-ghost text-xs flex-1">✏ Edit</button>
              <button onClick={()=>loadAdmins(h._id)} className="text-xs px-3 py-1.5 rounded-xl" style={{ background:'rgba(var(--color-primary-rgb),0.1)',color:'var(--color-primary)' }}>
                👤 {showAdmins[h._id]?'Hide':'Admins'}
              </button>
              <button onClick={()=>setAddAdminH(h)} className="text-xs px-3 py-1.5 rounded-xl" style={{ background:'rgba(var(--color-primary-rgb),0.08)',color:'var(--color-primary)' }}>+ Admin</button>
              <button onClick={()=>setManageH(h)} className="text-xs px-3 py-1.5 rounded-xl" style={{ background:'rgba(99,102,241,0.1)',color:'#818cf8' }}>Manage</button>
              <button onClick={()=>toggle(h._id)} className="text-xs px-3 py-1.5 rounded-xl"
                style={{ background:h.isActive?'rgba(239,68,68,0.1)':'rgba(16,185,129,0.1)',color:h.isActive?'#ef4444':'#10b981' }}>
                {h.isActive?'Disable':'Enable'}
              </button>
              <a href={'/display/'+h._id} target="_blank" rel="noreferrer" className="text-xs px-2 py-1.5 rounded-xl" style={{ background:'var(--color-surface2)',color:'var(--color-text-muted)' }}>📺</a>
              <button onClick={()=>{ navigator.clipboard.writeText(window.location.origin+'/login/'+h.slug); import('react-hot-toast').then(({default:toast})=>toast.success('Login URL copied!')); }}
                className="text-xs px-2 py-1.5 rounded-xl" style={{ background:'rgba(108,43,217,0.15)',color:'#a78bfa' }} title="Copy staff login URL">🔗</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
