import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api, { fUrl } from '../../utils/api';
import { fDate } from '../../utils/helpers';

export default function PrescriptionPrint() {
  const { id } = useParams();
  const [rx, setRx] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/prescriptions/' + id)
      .then(({ data }) => { if (data.success) setRx(data.prescription); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (rx) document.title = 'Rx — ' + (rx.patient?.name || '') + ' — ' + fDate(rx.visitDate);
  }, [rx]);

  if (loading) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Arial' }}>Loading prescription…</div>;
  if (!rx) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Arial',color:'red' }}>Prescription not found.</div>;

  const lh = rx.letterhead || {};

  return (
    <>
      <style>{`
        * { box-sizing:border-box; }
        @media print { .noprint{display:none!important} body{background:white!important} @page{margin:12mm;size:A4} }
        body { margin:0; font-family:Arial,Helvetica,sans-serif; font-size:13px; background:#f0f0f0; color:#111; }
        .page { background:white; max-width:210mm; margin:0 auto; padding:18mm; min-height:297mm; position:relative; box-shadow:0 0 20px rgba(0,0,0,.1); }
        .wm { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-45deg); font-size:72px; font-weight:900; color:rgba(180,0,0,.04); pointer-events:none; white-space:nowrap; letter-spacing:8px; }
        .divider { border:none; border-top:1px solid #e0e0e0; margin:10px 0; }
        .drug-table { border-collapse:collapse; width:100%; margin-top:6px; }
        .drug-table th { background:#f0faf8; color:#065f46; font-size:10px; text-transform:uppercase; letter-spacing:.5px; padding:6px 8px; text-align:left; border:1px solid #d1fae5; }
        .drug-table td { padding:6px 8px; border:1px solid #e5e7eb; font-size:11.5px; vertical-align:top; }
        .drug-table tbody tr:nth-child(even) td { background:#fafafa; }
        .vbox { display:inline-block; border:1px solid #e0e0e0; border-radius:4px; padding:3px 9px; margin:2px; text-align:center; }
        .vval { font-weight:700; font-size:12px; }
        .vlbl { font-size:9px; color:#888; text-transform:uppercase; }
        .slabel { font-size:9.5px; text-transform:uppercase; letter-spacing:.6px; color:#666; font-weight:700; }
      `}</style>

      {/* Toolbar */}
      <div className="noprint" style={{ background:'#0f172a', padding:'10px 20px', display:'flex', gap:'10px', alignItems:'center', position:'sticky', top:0, zIndex:99 }}>
        <button onClick={() => window.print()} style={{ background:'#0d9488', color:'white', border:'none', padding:'8px 18px', borderRadius:'8px', cursor:'pointer', fontWeight:'600', fontSize:'13px' }}>
          🖨 Print / Save PDF
        </button>
        <button onClick={() => window.close()} style={{ background:'#1e293b', color:'white', border:'none', padding:'8px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
          ✕ Close
        </button>
        <span style={{ color:'#64748b', fontSize:'12px', marginLeft:'8px' }}>🔒 CONFIDENTIAL — Protected Health Information</span>
      </div>

      <div className="page">
        <div className="wm">CONFIDENTIAL</div>

        {/* ── HEADER ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'14px' }}>
          <div style={{ flex:1 }}>
            {lh.showLogo && lh.hospitalLogo && (
              <img src={fUrl(lh.hospitalLogo)} alt="logo" style={{ height:'52px', objectFit:'contain', marginBottom:'6px', display:'block' }} />
            )}
            <div style={{ fontSize:'20px', fontWeight:'800', color:'#111', lineHeight:1.1 }}>{lh.hospitalName || 'Hospital'}</div>
            {lh.hospitalAddress && <div style={{ fontSize:'11px', color:'#555', marginTop:'2px' }}>{lh.hospitalAddress}</div>}
            {lh.hospitalPhone   && <div style={{ fontSize:'11px', color:'#555' }}>Tel: {lh.hospitalPhone}</div>}
          </div>
          <div style={{ textAlign:'right', paddingLeft:'18px', borderLeft:'3px solid #0d9488' }}>
            <div style={{ fontSize:'16px', fontWeight:'700', color:'#0d9488' }}>{lh.doctorName}</div>
            {lh.doctorSpecialty && <div style={{ fontSize:'11.5px', color:'#444', marginTop:'2px' }}>{lh.doctorSpecialty}</div>}
            {lh.doctorDegree    && <div style={{ fontSize:'11px', color:'#666' }}>{lh.doctorDegree}</div>}
            {lh.doctorRegNo     && <div style={{ fontSize:'10px', color:'#888', marginTop:'2px' }}>Reg. No: {lh.doctorRegNo}</div>}
          </div>
        </div>
        <hr className="divider" />

        {/* ── PATIENT + DATE ── */}
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'10px' }}>
          <div>
            <div className="slabel" style={{ marginBottom:'3px' }}>Patient</div>
            <div style={{ fontSize:'15px', fontWeight:'700' }}>{rx.patient?.name}</div>
            <div style={{ fontSize:'11px', color:'#555' }}>{rx.patient?.phone}{rx.patient?.gender ? ' · ' + rx.patient.gender : ''}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div className="slabel" style={{ marginBottom:'3px' }}>Date</div>
            <div style={{ fontSize:'13px', fontWeight:'600' }}>{fDate(rx.visitDate)}</div>
            <div style={{ fontSize:'10px', color:'#999', marginTop:'2px' }}>Rx# {rx._id?.toString().slice(-8).toUpperCase()}</div>
          </div>
        </div>

        {/* ── CLINICAL ── */}
        {(rx.chiefComplaint || rx.diagnosis) && (
          <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'5px', padding:'9px 12px', marginBottom:'10px' }}>
            {rx.chiefComplaint && <div style={{ fontSize:'12px' }}><strong>C/C: </strong>{rx.chiefComplaint}</div>}
            {rx.diagnosis      && <div style={{ fontSize:'12px', marginTop:'3px' }}><strong>Dx: </strong>{rx.diagnosis}</div>}
          </div>
        )}

        {/* ── VITALS ── */}
        {rx.vitals && Object.values(rx.vitals).some(v => v) && (
          <div style={{ marginBottom:'10px' }}>
            <div className="slabel" style={{ marginBottom:'5px' }}>Vitals</div>
            {[['BP', rx.vitals.bloodPressure], ['Pulse', rx.vitals.pulse], ['Temp', rx.vitals.temperature],
              ['Wt', rx.vitals.weight], ['Ht', rx.vitals.height], ['SpO₂', rx.vitals.spo2]
            ].filter(([, v]) => v).map(([l, v]) => (
              <div key={l} className="vbox">
                <div className="vval">{v}</div>
                <div className="vlbl">{l}</div>
              </div>
            ))}
          </div>
        )}

        <hr className="divider" />

        {/* ── Rx DRUGS ── */}
        <div style={{ marginBottom:'14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
            <span style={{ fontSize:'26px', fontWeight:'900', color:'#0d9488', lineHeight:1 }}>℞</span>
            <span style={{ fontSize:'12px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'1.5px', color:'#333' }}>Prescription</span>
          </div>
          {rx.drugs?.length > 0 ? (
            <table className="drug-table">
              <thead><tr>
                {['#','Drug / Medicine','Dosage','Frequency','Duration','Route','Instructions','Qty'].map(h => <th key={h}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rx.drugs.map((d, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:'700', color:'#0d9488', textAlign:'center' }}>{i + 1}</td>
                    <td style={{ fontWeight:'600' }}>{d.name}</td>
                    <td>{d.dosage}</td>
                    <td>{d.frequency}</td>
                    <td>{d.duration}</td>
                    <td>{d.route}</td>
                    <td style={{ color:'#555', fontStyle: d.instructions ? 'normal' : 'italic' }}>{d.instructions || '—'}</td>
                    <td>{d.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color:'#aaa', fontStyle:'italic', fontSize:'12px' }}>No medications prescribed</p>
          )}
        </div>

        {/* ── NOTES ── */}
        {rx.notes && (
          <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'5px', padding:'9px 12px', marginBottom:'10px' }}>
            <div className="slabel" style={{ color:'#92400e', marginBottom:'3px' }}>Doctor's Notes</div>
            <div style={{ fontSize:'12px' }}>{rx.notes}</div>
          </div>
        )}

        {/* ── FOLLOW-UP ── */}
        {(rx.followUpDate || rx.followUpNotes) && (
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'5px', padding:'9px 12px', marginBottom:'14px' }}>
            <div className="slabel" style={{ color:'#1e40af', marginBottom:'3px' }}>Follow-up</div>
            {rx.followUpDate  && <div style={{ fontSize:'12px' }}>📅 {fDate(rx.followUpDate)}</div>}
            {rx.followUpNotes && <div style={{ fontSize:'12px', marginTop:'2px' }}>📝 {rx.followUpNotes}</div>}
          </div>
        )}

        <hr className="divider" />

        {/* ── SIGNATURE ── */}
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'20px' }}>
          <div style={{ textAlign:'center', minWidth:'150px' }}>
            <div style={{ borderBottom:'1px solid #333', marginBottom:'6px', height:'36px' }} />
            <div style={{ fontSize:'12px', fontWeight:'700' }}>{lh.doctorName}</div>
            {lh.doctorDegree && <div style={{ fontSize:'10px', color:'#555' }}>{lh.doctorDegree}</div>}
            {lh.doctorRegNo  && <div style={{ fontSize:'9px', color:'#888' }}>Reg: {lh.doctorRegNo}</div>}
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ marginTop:'20px', paddingTop:'10px', borderTop:'1px solid #eee', textAlign:'center' }}>
          <div style={{ fontSize:'9px', color:'#aaa' }}>{lh.footerText || ((lh.hospitalName || '') + (lh.hospitalPhone ? ' · ' + lh.hospitalPhone : ''))}</div>
          <div style={{ fontSize:'8px', color:'#ccc', marginTop:'3px' }}>
            🔒 CONFIDENTIAL — This document contains protected health information. Unauthorized use, disclosure or reproduction is strictly prohibited.
          </div>
        </div>
      </div>
    </>
  );
}
