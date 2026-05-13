/**
 * DOCTOR PRESCRIPTIONS PAGE
 * ==========================
 * Doctors see ONLY their own patients' prescriptions.
 * Search by patient name or phone number.
 * Patient history accessible per patient.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { fDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

// Confidential banner
function ConfidentialBanner() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl mb-4 text-xs font-semibold"
      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
      🔒 CONFIDENTIAL — This page contains protected patient health information. Unauthorized access or disclosure is prohibited.
    </div>
  );
}

// Patient history drawer
function PatientHistory({ patient, prescriptions, onClose }) {
  if (!patient) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="h-full overflow-y-auto w-full max-w-2xl shadow-2xl"
        style={{ background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)' }}>
        <div className="sticky top-0 px-6 py-4 border-b flex items-center justify-between"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div>
            <h3 className="font-bold text-white text-lg">{patient.name}</h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{patient.phone} · {patient.gender || '—'}</p>
          </div>
          <button onClick={onClose} className="btn-ghost text-sm">✕ Close</button>
        </div>
        <div className="p-6">
          <ConfidentialBanner />
          {prescriptions.length === 0 ? (
            <p className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>No prescriptions found</p>
          ) : prescriptions.map(rx => (
            <div key={rx._id} className="card mb-3">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-white">{fDate(rx.visitDate)}</p>
                  {rx.diagnosis && <p className="text-sm mt-0.5" style={{ color: 'var(--color-primary)' }}>Dx: {rx.diagnosis}</p>}
                  {rx.chiefComplaint && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>CC: {rx.chiefComplaint}</p>}
                </div>
                <div className="flex gap-2">
                  <Link to={'/doctor/prescriptions/' + rx._id} className="btn-ghost text-xs">Edit</Link>
                  <a href={'/prescription/print/' + rx._id} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded-xl" style={{ background: 'rgba(var(--color-primary-rgb),0.15)', color: 'var(--color-primary)' }}>
                    🖨 Print
                  </a>
                </div>
              </div>
              {rx.drugs?.length > 0 && (
                <div className="space-y-1.5">
                  {rx.drugs.map((d, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm rounded-lg p-2" style={{ background: 'var(--color-surface2)' }}>
                      <span className="text-white font-medium min-w-0 flex-1">{d.name}</span>
                      <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>{d.dosage} · {d.frequency} · {d.duration}</span>
                    </div>
                  ))}
                </div>
              )}
              {rx.notes && (
                <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: 'var(--color-surface2)', color: 'var(--color-text-muted)' }}>
                  📝 {rx.notes}
                </p>
              )}
              {rx.followUpDate && (
                <p className="text-xs mt-2" style={{ color: '#f59e0b' }}>📅 Follow-up: {fDate(rx.followUpDate)}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DoctorPrescriptions() {
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [historyPatient, setHistoryPatient] = useState(null);
  const [historyRx, setHistoryRx] = useState([]);

  const fetchPrescriptions = useCallback(() => {
    setLoading(true);
    api.get('/prescriptions?page=' + page + '&limit=20')
      .then(({ data }) => { setPrescriptions(data.prescriptions || []); setTotal(data.total || 0); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

  // Search
  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get('/prescriptions/search?q=' + search);
        setSearchResults(data.results || []);
      } catch {} finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const openHistory = async (patient) => {
    try {
      const { data } = await api.get('/prescriptions/patient/' + patient._id);
      setHistoryPatient(data.patient || patient);
      setHistoryRx(data.prescriptions || []);
    } catch { toast.error('Failed to load history'); }
  };

  const displayed = search.length >= 2 ? searchResults : prescriptions;

  return (
    <div>
      {historyPatient && <PatientHistory patient={historyPatient} prescriptions={historyRx} onClose={() => setHistoryPatient(null)} />}

      <div className="flex flex-wrap items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="page-title">Prescriptions</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>My patients only · Doctor-scoped view</p>
        </div>
        <Link to="/doctor/prescriptions/new" className="btn-primary">+ New Prescription</Link>
      </div>

      <ConfidentialBanner />

      {/* Search */}
      <div className="relative mb-5">
        <label className="label">Search Patients (name or phone)</label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input className="input" placeholder="Enter patient name or mobile number…" value={search}
              onChange={e => setSearch(e.target.value)} />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)' }} />
            )}
          </div>
          {search && <button onClick={() => setSearch('')} className="btn-ghost">Clear</button>}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[['Total Prescriptions', total, 'var(--color-text)'], ['This Page', displayed.length, 'var(--color-primary)'], ['Searches', search.length >= 2 ? searchResults.length : 0, '#6366f1']].map(([l, v, c]) => (
          <div key={l} className="stat-card py-3"><p className="stat-value text-2xl" style={{ color: c }}>{v}</p><p className="stat-label">{l}</p></div>
        ))}
      </div>

      {/* Prescription list */}
      {loading ? (
        <div className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="card text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
          <div className="text-4xl mb-2">💊</div>
          <p>{search.length >= 2 ? 'No prescriptions found for "' + search + '"' : 'No prescriptions yet. Click "+ New Prescription" to start.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(rx => (
            <div key={rx._id} className="card">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0"
                  style={{ background: 'var(--color-primary)' }}>{rx.patient?.name?.charAt(0) || 'P'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-bold text-white">{rx.patient?.name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{rx.patient?.phone}</p>
                    {rx.isConfidential && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>🔒 Confidential</span>}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-primary)' }}>
                    {rx.diagnosis || 'No diagnosis'} · {fDate(rx.visitDate)}
                  </p>
                  {rx.drugs?.length > 0 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      💊 {rx.drugs.map(d => d.name).join(', ')}
                    </p>
                  )}
                  {rx.followUpDate && (
                    <p className="text-xs mt-1" style={{ color: '#f59e0b' }}>📅 Follow-up: {fDate(rx.followUpDate)}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openHistory(rx.patient)} className="text-xs px-3 py-1.5 rounded-xl transition-all"
                    style={{ background: 'rgba(var(--color-primary-rgb),0.1)', color: 'var(--color-primary)' }}>
                    📋 History
                  </button>
                  <Link to={'/doctor/prescriptions/' + rx._id} className="btn-ghost text-xs">Edit</Link>
                  <a href={'/prescription/print/' + rx._id} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded-xl" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                    🖨 Print
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && search.length < 2 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost text-xs">← Prev</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total} className="btn-ghost text-xs">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
