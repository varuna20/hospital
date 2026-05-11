/**
 * DRUG LIBRARY PAGE
 * =================
 * Accessible by: Admin, Doctor (read + add), Superadmin
 * Features:
 *  - Search drugs by name, generic name, category
 *  - Add drugs manually
 *  - Import from CSV (admin)
 *  - Edit / deactivate
 *  - Download CSV template
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const FREQ_OPTIONS = ['Once daily','Twice daily','3 times daily','4 times daily','Every 6 hours','Every 8 hours','As needed','At bedtime','With food'];
const ROUTE_OPTIONS = ['Oral','Topical','IV','IM','Sublingual','Inhaled','Eye drops','Ear drops','Nasal'];
const CATEGORIES = ['Analgesic/Antipyretic','Antibiotic','NSAID','Antihypertensive (CCB)','Antihypertensive (Beta blocker)','Antihypertensive (ACE inhibitor)','Antihypertensive (ARB)','Antihypertensive (Diuretic)','Antidiabetic (Biguanide)','Antidiabetic (Sulfonylurea)','Proton Pump Inhibitor','H2 Blocker','Antiemetic','Antiemetic/Prokinetic','Antispasmodic','Bronchodilator','Antihistamine','Corticosteroid (Topical)','Antifungal (Topical)','Antibiotic (Topical)','Statin/Cholesterol','Thyroid','Vitamin/Supplement','Antiprotozoal','Opioid Analgesic','Other'];

function DrugForm({ drug, onSave, onCancel }) {
  const isEdit = !!drug;
  const [form, setForm] = useState({
    name: drug?.name||'', genericName: drug?.genericName||'', brand: drug?.brand||'',
    category: drug?.category||'', defaultDosage: drug?.defaultDosage||'', defaultFrequency: drug?.defaultFrequency||'',
    defaultDuration: drug?.defaultDuration||'', defaultRoute: drug?.defaultRoute||'Oral',
    defaultInstructions: drug?.defaultInstructions||'',
    strengths: (drug?.strengths||[]).join(', '), forms: (drug?.forms||[]).join(', '),
    description: drug?.description||'', sideEffects: drug?.sideEffects||'',
  });
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const save = async () => {
    if (!form.name) { toast.error('Drug name is required'); return; }
    setLoading(true);
    try {
      const payload = {
        ...form,
        strengths: form.strengths.split(',').map(s=>s.trim()).filter(Boolean),
        forms: form.forms.split(',').map(s=>s.trim()).filter(Boolean),
      };
      isEdit ? await api.put('/drugs/'+drug._id, payload) : await api.post('/drugs', payload);
      toast.success(isEdit ? 'Drug updated!' : 'Drug added to library!');
      onSave();
    } catch(e) { toast.error(e.response?.data?.message||'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="card border-2 mb-5" style={{ borderColor:'var(--color-primary)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">{isEdit ? 'Edit Drug' : 'Add Drug to Library'}</h3>
        <button onClick={onCancel} className="btn-ghost text-sm">✕</button>
      </div>
      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div><label className="label">Drug Name *</label><input className="input" value={form.name} onChange={e=>set('name',e.target.value)} /></div>
        <div><label className="label">Generic Name</label><input className="input" value={form.genericName} onChange={e=>set('genericName',e.target.value)} /></div>
        <div><label className="label">Brand Name</label><input className="input" value={form.brand} onChange={e=>set('brand',e.target.value)} /></div>
        <div><label className="label">Category</label>
          <select className="input" value={form.category} onChange={e=>set('category',e.target.value)}>
            <option value="">Select…</option>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label className="label">Default Dosage</label><input className="input" placeholder="500mg" value={form.defaultDosage} onChange={e=>set('defaultDosage',e.target.value)} /></div>
        <div><label className="label">Default Frequency</label>
          <select className="input" value={form.defaultFrequency} onChange={e=>set('defaultFrequency',e.target.value)}>
            <option value="">Select…</option>
            {FREQ_OPTIONS.map(f=><option key={f}>{f}</option>)}
          </select>
        </div>
        <div><label className="label">Default Duration</label><input className="input" placeholder="7 days" value={form.defaultDuration} onChange={e=>set('defaultDuration',e.target.value)} /></div>
        <div><label className="label">Route</label>
          <select className="input" value={form.defaultRoute} onChange={e=>set('defaultRoute',e.target.value)}>
            {ROUTE_OPTIONS.map(r=><option key={r}>{r}</option>)}
          </select>
        </div>
        <div><label className="label">Instructions</label><input className="input" placeholder="Take after food" value={form.defaultInstructions} onChange={e=>set('defaultInstructions',e.target.value)} /></div>
        <div><label className="label">Available Strengths (comma separated)</label><input className="input" placeholder="250mg, 500mg, 1000mg" value={form.strengths} onChange={e=>set('strengths',e.target.value)} /></div>
        <div><label className="label">Forms (comma separated)</label><input className="input" placeholder="Tablet, Capsule, Syrup" value={form.forms} onChange={e=>set('forms',e.target.value)} /></div>
        <div><label className="label">Description / Notes</label><input className="input" value={form.description} onChange={e=>set('description',e.target.value)} /></div>
      </div>
      <div className="flex gap-3">
        <button onClick={save} disabled={loading} className="btn-primary">{loading?'Saving…':isEdit?'✓ Update':'+ Add Drug'}</button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

function CsvImport({ onDone }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const downloadTemplate = () => {
    const header = 'name,genericName,brand,category,defaultDosage,defaultFrequency,defaultDuration,defaultRoute,defaultInstructions,strengths,forms,description';
    const example = 'Amoxicillin,Amoxicillin,,Antibiotic,500mg,3 times daily,7 days,Oral,Complete full course,250mg;500mg,Capsule;Syrup,Common antibiotic';
    const csv = '\uFEFF' + header + '\n' + example;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'drug_import_template.csv'; a.click();
    toast.success('Template downloaded!');
  };

  const importCsv = async () => {
    if (!file) { toast.error('Select a CSV file'); return; }
    setLoading(true);
    try {
      const fd = new FormData(); fd.append('csv', file);
      const { data } = await api.post('/drugs/import-csv', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      toast.success(data.message); onDone();
    } catch(e) { toast.error(e.response?.data?.message||'Import failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="card border mb-5" style={{ borderColor:'rgba(var(--color-primary-rgb),0.3)' }}>
      <h3 className="section-title mb-2">Import from CSV</h3>
      <p className="text-xs mb-4" style={{ color:'var(--color-text-muted)' }}>
        Upload a CSV file with drug data. Columns: name, genericName, brand, category, defaultDosage, defaultFrequency, defaultDuration, defaultRoute, defaultInstructions, strengths (semicolon separated), forms (semicolon separated).
      </p>
      <div className="flex gap-3 flex-wrap">
        <button onClick={downloadTemplate} className="btn-ghost text-sm">⬇ Download Template</button>
        <input type="file" accept=".csv" onChange={e=>setFile(e.target.files[0])} className="text-sm cursor-pointer rounded-xl p-2"
          style={{ background:'var(--color-surface2)',color:'var(--color-text)',border:'1px solid var(--color-border)' }} />
        {file && <button onClick={importCsv} disabled={loading} className="btn-primary text-sm">{loading?'Importing…':'⬆ Import CSV'}</button>}
      </div>
    </div>
  );
}

export default function DrugLibrary() {
  const { user } = useAuth();
  const isAdmin = ['admin','superadmin'].includes(user?.role);
  const [drugs, setDrugs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [editDrug, setEditDrug] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchDrugs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 30 });
    if (search) params.set('q', search);
    if (category) params.set('category', category);
    api.get('/drugs?' + params.toString())
      .then(({ data }) => { setDrugs(data.drugs||[]); setTotal(data.total||0); })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, [search, category, page]);

  useEffect(()=>{ fetchDrugs(); },[fetchDrugs]);
  useEffect(()=>{
    api.get('/drugs/categories').then(({ data })=>setCategories(data.categories||[])).catch(()=>{});
  },[]);

  // Search debounce
  const [searchInput, setSearchInput] = useState('');
  useEffect(()=>{
    const t = setTimeout(()=>{ setSearch(searchInput); setPage(1); }, 350);
    return ()=>clearTimeout(t);
  },[searchInput]);

  const deactivate = async (id) => {
    try { await api.delete('/drugs/'+id); toast.success('Removed from library'); fetchDrugs(); }
    catch { toast.error('Failed'); }
  };

  const catColor = (cat) => {
    const map = { 'Antibiotic':'#10b981','Analgesic':'#f59e0b','Antihypertensive':'#6366f1','Antidiabetic':'#ec4899','Vitamin':'#0ea5e9' };
    for (const [k,v] of Object.entries(map)) if (cat?.includes(k)) return v;
    return 'var(--color-primary)';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Drug Library</h1>
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>{total} drugs · Shared across all prescriptions</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && <button onClick={()=>{ setShowCsv(s=>!s); setShowForm(false); setEditDrug(null); }} className="btn-ghost text-sm">📤 CSV Import</button>}
          <button onClick={()=>{ setShowForm(s=>!s); setEditDrug(null); setShowCsv(false); }} className="btn-primary text-sm">+ Add Drug</button>
        </div>
      </div>

      {showCsv && isAdmin && <CsvImport onDone={()=>{ setShowCsv(false); fetchDrugs(); }} />}
      {(showForm||editDrug) && <DrugForm drug={editDrug} onSave={()=>{ setShowForm(false); setEditDrug(null); fetchDrugs(); }} onCancel={()=>{ setShowForm(false); setEditDrug(null); }} />}

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-48">
          <input className="input" placeholder="Search drug name, generic, category…"
            value={searchInput} onChange={e=>setSearchInput(e.target.value)} />
        </div>
        <select className="input w-auto" value={category} onChange={e=>{ setCategory(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map(c=><option key={c}>{c}</option>)}
        </select>
        {(searchInput||category) && <button onClick={()=>{ setSearchInput(''); setCategory(''); setPage(1); }} className="btn-ghost text-sm">Clear</button>}
      </div>

      {/* Drug cards */}
      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{Array(6).fill(0).map((_,i)=><div key={i} className="card animate-pulse h-36"/>)}</div>
      ) : drugs.length===0 ? (
        <div className="card text-center py-14" style={{ color:'var(--color-text-muted)' }}>
          <div className="text-5xl mb-3">💊</div>
          <p>{search?`No drugs matching "${search}"`:'Drug library is empty. Add drugs manually or import from CSV.'}</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {drugs.map(d=>(
            <div key={d._id} className="card group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-white">{d.name}</p>
                    {d.isGlobal && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background:'rgba(var(--color-primary-rgb),0.1)',color:'var(--color-primary)' }}>Global</span>}
                  </div>
                  {d.genericName && <p className="text-xs" style={{ color:'var(--color-text-muted)' }}>{d.genericName}</p>}
                  {d.brand && <p className="text-xs italic" style={{ color:'var(--color-text-muted)' }}>{d.brand}</p>}
                </div>
                {d.category && (
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2"
                    style={{ background: catColor(d.category)+'18', color: catColor(d.category) }}>
                    {d.category.split('(')[0].trim().split('/')[0].trim()}
                  </span>
                )}
              </div>

              {/* Default Rx */}
              <div className="rounded-lg px-3 py-2 mb-3 text-xs space-y-0.5" style={{ background:'var(--color-surface2)' }}>
                {d.defaultDosage && <p><span style={{ color:'var(--color-text-muted)' }}>Dose: </span><span className="text-white">{d.defaultDosage}</span></p>}
                {d.defaultFrequency && <p><span style={{ color:'var(--color-text-muted)' }}>Freq: </span><span className="text-white">{d.defaultFrequency}</span></p>}
                {d.defaultDuration && <p><span style={{ color:'var(--color-text-muted)' }}>Duration: </span><span className="text-white">{d.defaultDuration}</span></p>}
                {d.defaultRoute && d.defaultRoute!=='Oral' && <p><span style={{ color:'var(--color-text-muted)' }}>Route: </span><span className="text-white">{d.defaultRoute}</span></p>}
                {d.defaultInstructions && <p className="italic" style={{ color:'var(--color-text-muted)' }}>{d.defaultInstructions}</p>}
              </div>

              {d.strengths?.length>0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {d.strengths.map(s=><span key={s} className="text-xs px-2 py-0.5 rounded-full" style={{ background:'rgba(var(--color-primary-rgb),0.08)',color:'var(--color-primary)' }}>{s}</span>)}
                </div>
              )}

              {isAdmin && (
                <div className="flex gap-2 mt-auto">
                  <button onClick={()=>{ setEditDrug(d); setShowForm(false); setShowCsv(false); window.scrollTo(0,0); }} className="btn-ghost text-xs flex-1">✏ Edit</button>
                  <button onClick={()=>{ if(window.confirm('Remove "'+d.name+'" from library?')) deactivate(d._id); }}
                    className="text-xs px-3 py-1.5 rounded-xl" style={{ background:'rgba(239,68,68,0.1)',color:'#ef4444' }}>Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 30 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-sm" style={{ color:'var(--color-text-muted)' }}>Showing {(page-1)*30+1}–{Math.min(page*30,total)} of {total}</p>
          <div className="flex gap-2">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-ghost text-xs">← Prev</button>
            <button onClick={()=>setPage(p=>p+1)} disabled={page*30>=total} className="btn-ghost text-xs">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
