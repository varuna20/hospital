/**
 * HOSPITAL LINKS PAGE — Super Admin
 * ====================================
 * Shows all hospital dedicated login URLs.
 * Super admin can copy or open any hospital's login page.
 */
import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function SuperHospitalLinks() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    api.get('/superadmin/hospitals')
      .then(({ data }) => setHospitals(data.hospitals || []))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const base = window.location.origin;

  const copy = (slug, name) => {
    const url = `${base}/login/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(slug);
      toast.success(`${name} login URL copied!`);
      setTimeout(() => setCopied(''), 2500);
    });
  };

  const copyAll = () => {
    const text = hospitals
      .filter(h => h.slug)
      .map(h => `${h.name}: ${base}/login/${h.slug}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast.success('All hospital URLs copied!');
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="page-title">Hospital Login Links</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Each hospital has a dedicated login URL. Share these with hospital staff only.
          </p>
        </div>
        <button onClick={copyAll} className="btn-ghost text-sm">📋 Copy All URLs</button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl p-4 mb-5 flex items-start gap-3"
        style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)' }}>
        <span className="text-xl flex-shrink-0">🔐</span>
        <div>
          <p className="text-sm font-semibold text-white mb-1">How dedicated login pages work</p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Each hospital gets a unique URL like <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,212,170,0.1)', color: 'var(--color-primary)' }}>{base}/login/hospital-name</code>.
            When staff visit that URL, they see only that hospital's branding and can only log in to that hospital.
            The main login page (<code className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,212,170,0.1)', color: 'var(--color-primary)' }}>{base}/login</code>) still works for super admin.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {Array(4).fill(0).map((_,i) => <div key={i} className="card animate-pulse h-32" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {hospitals.map(h => {
            const loginUrl = h.slug ? `${base}/login/${h.slug}` : null;
            const primary = h.theme?.primary || 'var(--color-primary)';
            return (
              <div key={h._id} className="card overflow-hidden">
                {/* Color strip */}
                <div className="h-1 -mx-5 -mt-5 mb-4 rounded-t-xl"
                  style={{ background: primary }} />

                <div className="flex items-center gap-3 mb-4">
                  {h.logo ? (
                    <img src={h.logo} alt="" className="h-10 object-contain rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0"
                      style={{ background: primary }}>
                      {h.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{h.name}</p>
                    <p className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>
                      {h.city || '—'} · {h.subscriptionPlan || 'trial'}
                      {!h.isActive && <span className="ml-2 text-red-400">· Inactive</span>}
                    </p>
                  </div>
                  <div className="ml-auto flex-shrink-0">
                    <span className={`badge ${h.isActive ? 'badge-completed' : 'badge-absent'}`}>
                      {h.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>

                {loginUrl ? (
                  <>
                    {/* URL display */}
                    <div className="rounded-xl p-3 mb-3 flex items-center gap-2 min-w-0"
                      style={{ background: 'var(--color-surface2)', border: '1px solid var(--color-border)' }}>
                      <span className="text-sm flex-shrink-0">🔗</span>
                      <code className="text-xs flex-1 truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {loginUrl}
                      </code>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => copy(h.slug, h.name)}
                        className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: copied === h.slug ? 'rgba(0,230,118,0.15)' : `${primary}18`,
                          color: copied === h.slug ? '#00e676' : primary,
                          border: `1px solid ${copied === h.slug ? 'rgba(0,230,118,0.3)' : primary + '30'}`,
                        }}>
                        {copied === h.slug ? '✓ Copied!' : '📋 Copy Login URL'}
                      </button>
                      <a
                        href={loginUrl} target="_blank" rel="noreferrer"
                        className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                        style={{ background: 'var(--color-surface2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                        Open ↗
                      </a>
                      <a
                        href={`/display/${h._id}`} target="_blank" rel="noreferrer"
                        className="px-3 py-2 rounded-xl text-sm transition-all"
                        style={{ background: 'var(--color-surface2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                        title="Open display screen">
                        📺
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl p-3 text-sm text-center"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    ⚠️ No URL slug set — edit hospital to add one
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* All URLs text box */}
      {hospitals.filter(h => h.slug).length > 0 && (
        <div className="card mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title">All Login URLs</h3>
            <button onClick={copyAll} className="btn-ghost text-xs">📋 Copy All</button>
          </div>
          <div className="rounded-xl p-4 font-mono text-xs leading-6 select-all"
            style={{ background: 'var(--color-surface2)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
            {hospitals.filter(h => h.slug).map(h => (
              <div key={h._id} className="flex items-center gap-2 mb-1">
                <span className="text-white font-semibold min-w-48 truncate">{h.name}:</span>
                <span style={{ color: 'var(--color-primary)' }}>{base}/login/{h.slug}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
