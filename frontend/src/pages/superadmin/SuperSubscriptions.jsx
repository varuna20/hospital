import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const FEATURES=[['maxDoctors','Max Doctors','number'],['maxPatients','Max Patients','number'],['whatsappNotify','WhatsApp','toggle'],['smsNotify','SMS','toggle'],['prescriptions','Prescriptions','toggle'],['revenueReports','Revenue Reports','toggle'],['displayScreen','Display Screen','toggle'],['videoWaitingRoom','Video Room','toggle'],['customTheme','Custom Theme','toggle'],['advancedReports','Advanced Reports','toggle'],['emailNotify','Email Notify','toggle'],['backupRestore','Backup & Restore','toggle']];

function PlanForm({ plan, onSave, onCancel }) {
  const isEdit=!!plan;
  const [form,setForm]=useState({ name:plan?.name||'', code:plan?.code||'', description:plan?.description||'', price:plan?.price||0, currency:plan?.currency||'LKR', commissionPercent:plan?.commissionPercent||0, features:plan?.features||{maxDoctors:5,maxPatients:1000,whatsappNotify:false,smsNotify:false,prescriptions:true,revenueReports:true,displayScreen:true,videoWaitingRoom:false,customTheme:true,advancedReports:false,emailNotify:false,backupRestore:false}, isActive:plan?.isActive!==false });
  const [loading,setLoading]=useState(false);
  const save=async()=>{
    if(!form.name||!form.code){toast.error('Name and code required');return;}
    setLoading(true);
    try{ isEdit?await api.put('/subscriptions/'+plan._id,form):await api.post('/subscriptions',form); toast.success(isEdit?'Updated!':'Created!'); onSave(); }
    catch(e){toast.error(e.response?.data?.message||'Error');} finally{setLoading(false);}
  };
  const setF=(k,v)=>setForm(p=>({...p,features:{...p.features,[k]:v}}));
  const tog=(k)=>setForm(p=>({...p,[k]:!p[k]}));
  return (
    <div className="card border-2 mb-5" style={{ borderColor:'var(--color-primary)' }}>
      <div className="flex items-center justify-between mb-4"><h3 className="section-title">{isEdit?'Edit: '+plan.name:'New Plan'}</h3><button onClick={onCancel} className="btn-ghost text-sm">✕</button></div>
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div><label className="label">Plan Name *</label><input className="input" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} /></div>
        <div><label className="label">Code *</label><input className="input" placeholder="premium" value={form.code} onChange={e=>setForm(p=>({...p,code:e.target.value.toLowerCase().replace(/\s/g,'-')}))} /></div>
        <div><label className="label">Monthly Price (Rs.)</label><input type="number" className="input" value={form.price} onChange={e=>setForm(p=>({...p,price:Number(e.target.value)}))} /></div>
        <div><label className="label">Commission % per booking: {form.commissionPercent}%</label>
          <input type="range" min={0} max={30} step={0.5} value={form.commissionPercent} onChange={e=>setForm(p=>({...p,commissionPercent:Number(e.target.value)}))} className="w-full mt-2" /></div>
        <div className="md:col-span-2"><label className="label">Description</label><input className="input" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} /></div>
      </div>
      <h4 className="section-title mb-3">Features</h4>
      <div className="grid md:grid-cols-2 gap-2 mb-4">
        {FEATURES.map(([k,l,type])=>(
          <div key={k} className="flex items-center justify-between rounded-lg p-2.5" style={{ background:'var(--color-surface2)' }}>
            <span className="text-sm text-white">{l}</span>
            {type==='toggle'?(
              <div onClick={()=>setF(k,!form.features[k])} className="w-9 h-5 rounded-full relative cursor-pointer" style={{ background:form.features[k]?'var(--color-primary)':'rgba(255,255,255,0.1)' }}>
                <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform:form.features[k]?'translateX(17px)':'translateX(3px)' }} />
              </div>
            ):(
              <input type="number" value={form.features[k]||0} onChange={e=>setF(k,Number(e.target.value))} className="w-16 text-right rounded px-2 py-0.5 text-sm" style={{ background:'rgba(255,255,255,0.08)',border:'1px solid var(--color-border)',color:'white' }} />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button onClick={save} disabled={loading} className="btn-primary">{loading?'Saving…':isEdit?'✓ Update':'+ Create'}</button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

export default function SuperSubscriptions() {
  const [plans,setPlans]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [editPlan,setEditPlan]=useState(null);
  const fetch=()=>{ api.get('/subscriptions').then(({data})=>setPlans(data.plans||[])).catch(()=>{}).finally(()=>setLoading(false)); };
  useEffect(()=>{ fetch(); },[]);
  const del=async(id)=>{ if(!window.confirm('Delete?'))return; try{await api.delete('/subscriptions/'+id);fetch();toast.success('Deleted');}catch{toast.error('Cannot delete plan in use');} };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <div><h1 className="page-title">Subscription Plans</h1><p className="text-sm" style={{ color:'var(--color-text-muted)' }}>Manage feature sets and per-booking commissions</p></div>
        <button onClick={()=>{setShowForm(true);setEditPlan(null);}} className="btn-primary">+ New Plan</button>
      </div>
      {(showForm||editPlan)&&<PlanForm plan={editPlan} onSave={()=>{setShowForm(false);setEditPlan(null);fetch();}} onCancel={()=>{setShowForm(false);setEditPlan(null);}} />}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading?Array(3).fill(0).map((_,i)=><div key={i} className="card animate-pulse h-52"/>)
          :plans.map(p=>(
          <div key={p._id} className="card">
            <div className="flex items-start justify-between mb-3">
              <div><p className="font-bold text-white text-lg">{p.name}</p><p className="text-xs font-mono" style={{ color:'var(--color-primary)' }}>{p.code}</p>{p.description&&<p className="text-xs mt-1" style={{ color:'var(--color-text-muted)' }}>{p.description}</p>}</div>
              <div className="text-right"><p className="font-bold text-white">Rs.{(p.price||0).toLocaleString()}<span className="text-xs" style={{ color:'var(--color-text-muted)' }}>/mo</span></p>{p.commissionPercent>0&&<p className="text-xs" style={{ color:'#f59e0b' }}>{p.commissionPercent}% per booking</p>}</div>
            </div>
            <div className="flex flex-wrap gap-1 mb-4">
              {FEATURES.filter(([k])=>p.features?.[k]===true).map(([k,l])=>(
                <span key={k} className="text-xs px-2 py-0.5 rounded-full" style={{ background:'rgba(var(--color-primary-rgb),0.12)',color:'var(--color-primary)' }}>{l}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{setEditPlan(p);setShowForm(false);}} className="btn-ghost text-xs flex-1">✏ Edit</button>
              <span className={`badge ${p.isActive?'badge-completed':'badge-absent'}`}>{p.isActive?'Active':'Off'}</span>
              <button onClick={()=>del(p._id)} className="text-xs px-3 py-1.5 rounded-xl" style={{ background:'rgba(239,68,68,0.1)',color:'#ef4444' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
