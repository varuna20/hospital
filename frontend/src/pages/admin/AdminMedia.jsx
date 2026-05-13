/**
 * ADMIN MEDIA PAGE
 * ================
 * Manage:
 *  1. Hospital logo
 *  2. Display slideshow (portrait images/videos)
 *  3. Waiting room video (legacy)
 *  4. Announcement text
 */
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api, { fUrl } from '../../utils/api';
import toast from 'react-hot-toast';

// ── Reusable toggle ────────────────────────────────────────────────
function Toggle({ value, onChange, label, desc }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {desc && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>}
      </div>
      <div onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full cursor-pointer transition-colors flex-shrink-0"
        style={{ background: value ? 'var(--color-primary)' : 'var(--color-surface2)' }}>
        <div className="absolute top-1 w-4 h-4 bg-white rounded-full transition-transform"
          style={{ transform: value ? 'translateX(22px)' : 'translateX(4px)' }} />
      </div>
    </div>
  );
}

// ── Slideshow item card ─────────────────────────────────────────────
function SlideCard({ item, onToggle, onDelete, onDurationChange, onCaptionChange }) {
  const [dur, setDur] = useState(item.duration || 10);
  const [cap, setCap] = useState(item.caption || '');
  const [editing, setEditing] = useState(false);

  return (
    <div className="card" style={{ padding: 12 }}>
      {/* Preview */}
      <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 10, height: 140, background: '#000', position: 'relative' }}>
        {item.type === 'video' ? (
          <video src={fUrl(item.url)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
        ) : (
          <img src={fUrl(item.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full capitalize"
          style={{ background: 'rgba(0,0,0,0.7)', color: item.type === 'video' ? '#00d4aa' : '#ffab40' }}>
          {item.type === 'video' ? '🎬 Video' : '🖼 Image'}
        </span>
        {!item.isActive && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <span className="text-white text-xs font-bold">HIDDEN</span>
          </div>
        )}
      </div>

      {/* Settings */}
      {editing ? (
        <div className="space-y-2 mb-2">
          {item.type === 'image' && (
            <div>
              <label className="label">Duration (seconds)</label>
              <input type="number" min={3} max={60} className="input" style={{ padding: '4px 8px', fontSize: 12 }}
                value={dur} onChange={e => setDur(Number(e.target.value))} />
            </div>
          )}
          <div>
            <label className="label">Caption (optional)</label>
            <input className="input" style={{ padding: '4px 8px', fontSize: 12 }}
              placeholder="Add a caption…" value={cap} onChange={e => setCap(e.target.value)} />
          </div>
          <button onClick={() => { onDurationChange(item._id, dur); onCaptionChange(item._id, cap); setEditing(false); }}
            className="btn-primary w-full" style={{ padding: '6px', fontSize: 12 }}>Save</button>
        </div>
      ) : (
        <div className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
          {item.type === 'image' && <span>⏱ {dur}s · </span>}
          {cap ? <span>📝 {cap}</span> : <span>No caption</span>}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5">
        <button onClick={() => setEditing(e => !e)}
          className="btn-ghost text-xs flex-1" style={{ padding: '5px 8px' }}>
          {editing ? '✕ Cancel' : '✏ Edit'}
        </button>
        <button onClick={() => onToggle(item._id, !item.isActive)}
          className="text-xs px-2.5 py-1 rounded-lg transition-all"
          style={{ background: item.isActive ? 'rgba(239,68,68,0.1)' : 'rgba(0,212,170,0.1)', color: item.isActive ? '#ef4444' : 'var(--color-primary)' }}>
          {item.isActive ? 'Hide' : 'Show'}
        </button>
        <button onClick={() => { if (window.confirm('Remove this slide?')) onDelete(item._id); }}
          className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>✕</button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────
export default function AdminMedia() {
  const { hospital } = useAuth();
  const hid = hospital?._id;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoFile, setLogoFile] = useState(null);
  const [slideFiles, setSlideFiles] = useState([]);
  const [uploading, setUploading] = useState({ logo: false, slides: false, video: false });
  const [videoFile, setVideoFile] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [templates, setTemplates] = useState([]);
  const [newTemplate, setNewTemplate] = useState({ title: '', message: '' });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [activeTab, setActiveTab] = useState('slideshow');
  const slideInput = useRef(null);

  const reload = () => {
    api.get('/hospitals/mine?hospitalId=' + hid)
      .then(({ data: d }) => {
        if (d.success) {
          setData(d.hospital);
          setAnnouncement(d.hospital?.queueSettings?.announcement || '');
          setTemplates(d.hospital?.queueSettings?.announcementTemplates || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (hid) reload(); }, [hid]);

  // ── Upload logo ────────────────────────────────────────────────
  const uploadLogo = async () => {
    if (!logoFile) { toast.error('Select an image'); return; }
    setUploading(u => ({ ...u, logo: true }));
    try {
      const fd = new FormData(); fd.append('logo', logoFile);
      await api.post(`/hospitals/${hid}/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Logo uploaded!'); setLogoFile(null); reload();
    } catch (e) { toast.error(e.response?.data?.message || 'Upload failed'); }
    finally { setUploading(u => ({ ...u, logo: false })); }
  };

  // ── Upload slides ──────────────────────────────────────────────
  const uploadSlides = async () => {
    if (!slideFiles.length) { toast.error('Select at least one image or video'); return; }
    setUploading(u => ({ ...u, slides: true }));
    let done = 0;
    try {
      for (const file of slideFiles) {
        const fd = new FormData();
        fd.append('media', file);
        fd.append('duration', '10');
        await api.post(`/hospitals/${hid}/slideshow`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        done++;
      }
      toast.success(`${done} slide(s) added!`);
      setSlideFiles([]);
      if (slideInput.current) slideInput.current.value = '';
      reload();
    } catch (e) { toast.error(e.response?.data?.message || 'Upload failed'); }
    finally { setUploading(u => ({ ...u, slides: false })); }
  };

  // ── Toggle/delete/update slide ─────────────────────────────────
  const toggleSlide = async (itemId, isActive) => {
    try {
      await api.put(`/hospitals/${hid}/slideshow/${itemId}`, { isActive });
      reload();
    } catch { toast.error('Failed'); }
  };

  const deleteSlide = async (itemId) => {
    try { await api.delete(`/hospitals/${hid}/slideshow/${itemId}`); toast.success('Slide removed'); reload(); }
    catch { toast.error('Failed'); }
  };

  const updateSlideDuration = async (itemId, duration) => {
    try { await api.put(`/hospitals/${hid}/slideshow/${itemId}`, { duration }); }
    catch { toast.error('Failed'); }
  };

  const updateSlideCaption = async (itemId, caption) => {
    try { await api.put(`/hospitals/${hid}/slideshow/${itemId}`, { caption }); }
    catch { toast.error('Failed'); }
  };

  // ── Upload waiting video ───────────────────────────────────────
  const uploadVideo = async () => {
    if (!videoFile) { toast.error('Select a video file'); return; }
    setUploading(u => ({ ...u, video: true }));
    try {
      const fd = new FormData(); fd.append('video', videoFile);
      await api.post(`/hospitals/${hid}/video`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Waiting video uploaded!'); setVideoFile(null); reload();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed (check file size < 200MB)'); }
    finally { setUploading(u => ({ ...u, video: false })); }
  };

  const toggleWaitVideo = async (enabled) => {
    try { await api.put(`/hospitals/${hid}/video/toggle`, { enabled }); reload(); toast.success(enabled ? 'Video enabled' : 'Video disabled'); }
    catch { toast.error('Failed'); }
  };

  // ── Save announcement ──────────────────────────────────────────
  const saveAnnouncement = async () => {
    setSavingAnnouncement(true);
    try {
      await api.put(`/hospitals/${hid}/settings`, { queueSettings: { announcement, announcementTemplates: templates } });
      toast.success('Announcement settings saved!');
      reload();
    } catch (e) { toast.error('Failed to save'); }
    finally { setSavingAnnouncement(false); }
  };

  const addTemplate = () => {
    if (!newTemplate.title || !newTemplate.message) return toast.error('Title and message required');
    setTemplates(t => [...t, newTemplate]);
    setNewTemplate({ title: '', message: '' });
  };
  const removeTemplate = (idx) => {
    setTemplates(t => t.filter((_, i) => i !== idx));
  };

  if (loading) return <div className="text-center py-12" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>;

  const slides = (data?.slideshow || []).sort((a, b) => (a.order || 0) - (b.order || 0));
  const vid    = data?.waitingVideo;

  const tabs = [
    { id: 'slideshow',    label: '🎠 Display Slideshow' },
    { id: 'logo',         label: '🖼 Hospital Logo' },
    { id: 'video',        label: '🎬 Waiting Video' },
    { id: 'announcement', label: '📢 Announcement' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Media & Display</h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Manage what patients see on the display screen in the waiting room
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b flex-wrap" style={{ borderColor: 'var(--color-border)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap"
            style={{ color: activeTab === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)', borderBottom: activeTab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent', marginBottom: '-1px' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SLIDESHOW TAB ── */}
      {activeTab === 'slideshow' && (
        <div>
          <div className="card mb-5">
            <h3 className="section-title mb-2">Upload Slides</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Add images (JPG, PNG, WebP) or short videos (MP4) to the portrait slideshow.
              Images display for 10 seconds by default (adjustable). Videos auto-advance at end.
              <strong className="text-white ml-1">Portrait/vertical orientation recommended.</strong>
            </p>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex-1 min-w-48">
                <label className="label">Select Images or Videos</label>
                <input ref={slideInput} type="file" multiple accept="image/*,video/mp4,video/webm"
                  onChange={e => setSlideFiles(Array.from(e.target.files))}
                  className="block w-full text-sm cursor-pointer rounded-xl p-2.5"
                  style={{ background: 'var(--color-surface2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>JPG, PNG, WebP, MP4 · Max 100MB each</p>
              </div>
              <button onClick={uploadSlides} disabled={!slideFiles.length || uploading.slides} className="btn-primary flex-shrink-0">
                {uploading.slides ? 'Uploading…' : `⬆ Add ${slideFiles.length || ''} Slide${slideFiles.length !== 1 ? 's' : ''}`}
              </button>
            </div>
            {slideFiles.length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {slideFiles.map((f, i) => (
                  <span key={i} className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(var(--color-primary-rgb),0.1)', color: 'var(--color-primary)' }}>
                    {f.type.startsWith('video') ? '🎬' : '🖼'} {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Slide grid */}
          {slides.length === 0 ? (
            <div className="card text-center py-14" style={{ color: 'var(--color-text-muted)' }}>
              <div className="text-5xl mb-3">🎠</div>
              <p className="text-lg font-medium text-white mb-1">No slides yet</p>
              <p className="text-sm">Upload portrait images or videos above to fill the display slideshow.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white">{slides.length} slides · {slides.filter(s => s.isActive).length} active</p>
                <a href={`/display/${hid}`} target="_blank" rel="noreferrer"
                  className="btn-ghost text-xs">📺 Preview Display →</a>
              </div>
              <div className="grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {slides.map(item => (
                  <SlideCard key={item._id} item={item}
                    onToggle={toggleSlide} onDelete={deleteSlide}
                    onDurationChange={updateSlideDuration} onCaptionChange={updateSlideCaption} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LOGO TAB ── */}
      {activeTab === 'logo' && (
        <div className="card max-w-lg">
          <h3 className="section-title mb-3">Hospital Logo</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Shown on display screens, login page, and printed prescriptions. PNG/SVG with transparent background recommended.
          </p>
          {data?.logo && (
            <div className="rounded-xl p-4 flex items-center gap-4 mb-4" style={{ background: 'var(--color-surface2)' }}>
              <img src={fUrl(data.logo)} alt="Current logo" className="h-16 object-contain rounded-lg" />
              <div>
                <p className="text-white text-sm font-medium">Current logo</p>
                <p className="text-xs mt-0.5 break-all" style={{ color: 'var(--color-text-muted)' }}>{data.logo}</p>
              </div>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="label">Upload New Logo</label>
              <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files[0])}
                className="block w-full text-sm cursor-pointer rounded-xl p-2.5"
                style={{ background: 'var(--color-surface2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>PNG, SVG, JPG · Max 5MB</p>
            </div>
            {logoFile && (
              <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'rgba(var(--color-primary-rgb),0.08)' }}>
                <img src={URL.createObjectURL(logoFile)} alt="Preview" className="h-12 rounded object-contain" />
                <span className="text-sm text-white">{logoFile.name}</span>
              </div>
            )}
            <button onClick={uploadLogo} disabled={!logoFile || uploading.logo} className="btn-primary w-full">
              {uploading.logo ? 'Uploading…' : '⬆ Upload Logo'}
            </button>
          </div>
        </div>
      )}

      {/* ── WAITING VIDEO TAB ── */}
      {activeTab === 'video' && (
        <div className="card max-w-lg">
          <div className="flex items-center justify-between mb-1">
            <h3 className="section-title">Waiting Room Video</h3>
            {vid?.url && (
              <button onClick={() => toggleWaitVideo(!vid.enabled)}
                className="text-sm px-4 py-1.5 rounded-xl font-medium"
                style={{ background: vid.enabled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)', color: vid.enabled ? '#10b981' : '#f87171' }}>
                {vid.enabled ? '● Active' : '○ Disabled'}
              </button>
            )}
          </div>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Plays on display screen while doctor hasn't arrived. Auto-stops when doctor is marked arrived.
          </p>
          {vid?.url ? (
            <div className="rounded-xl overflow-hidden mb-4" style={{ background: 'var(--color-surface2)' }}>
              <video src={fUrl(vid.url)} className="w-full max-h-48 object-cover" controls muted />
              <div className="px-3 py-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: vid.enabled ? '#10b981' : '#ef4444' }} />
                <span className="text-xs" style={{ color: vid.enabled ? '#10b981' : '#ef4444' }}>
                  {vid.enabled ? 'Showing on display' : 'Disabled'}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-8 text-center mb-4" style={{ background: 'var(--color-surface2)', border: '2px dashed var(--color-border)' }}>
              <div className="text-4xl mb-2">🎬</div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No waiting video yet</p>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="label">Upload Video</label>
              <input type="file" accept="video/mp4,video/webm" onChange={e => setVideoFile(e.target.files[0])}
                className="block w-full text-sm cursor-pointer rounded-xl p-2.5"
                style={{ background: 'var(--color-surface2)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }} />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>MP4, WebM · Max 200MB</p>
            </div>
            <button onClick={uploadVideo} disabled={!videoFile || uploading.video} className="btn-primary w-full">
              {uploading.video ? 'Uploading (may take a moment)…' : '⬆ Upload Video'}
            </button>
          </div>
        </div>
      )}

      {/* ── ANNOUNCEMENT TAB ── */}
      {activeTab === 'announcement' && (
        <div className="card max-w-2xl">
          <h3 className="section-title mb-1">Display Announcement</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            This text scrolls across the bottom of the display screen. Leave blank to show the default welcome message.
          </p>
          <div className="mb-4">
            <label className="label">Announcement Text</label>
            <textarea className="input resize-none" rows={4}
              placeholder="e.g. Clinic will be closed on public holidays. For emergencies, call 0771234567."
              value={announcement} onChange={e => setAnnouncement(e.target.value)} />
          </div>
          <div className="rounded-xl p-3 mb-4 text-xs" style={{ background: 'rgba(var(--color-primary-rgb),0.06)', border: '1px solid rgba(var(--color-primary-rgb),0.2)' }}>
            <p className="font-semibold mb-1" style={{ color: 'var(--color-primary)' }}>💡 Also — Text-to-Speech</p>
            <p style={{ color: 'var(--color-text-muted)' }}>
              The display screen automatically announces each patient number using text-to-speech when "Call Next" is pressed.
              It says: <em className="text-white">"Patient Number X, please proceed to [Room]."</em> No setup needed — works in all modern browsers.
            </p>
          </div>
          <div className="flex gap-3 mb-8">
            <button onClick={saveAnnouncement} disabled={savingAnnouncement} className="btn-primary">
              {savingAnnouncement ? 'Saving…' : '💾 Save Changes'}
            </button>
            {announcement && <button onClick={() => { setAnnouncement(''); }} className="btn-ghost text-sm">Clear Active Message</button>}
          </div>

          {/* Templates Section */}
          <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <h4 className="section-title mb-1">Scrolling Message Templates</h4>
            <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
              Create reusable templates that your clinic staff can quickly push to the display from their dashboard.
            </p>
            
            <div className="flex flex-col gap-3 mb-4 p-4 rounded-xl" style={{ background: 'var(--color-surface2)' }}>
              <div className="grid grid-cols-[1fr_2fr] gap-3">
                <input className="input" placeholder="Template Title (e.g. Doctor Delayed)" 
                  value={newTemplate.title} onChange={e => setNewTemplate({...newTemplate, title: e.target.value})} />
                <input className="input" placeholder="Message content..." 
                  value={newTemplate.message} onChange={e => setNewTemplate({...newTemplate, message: e.target.value})} />
              </div>
              <button onClick={addTemplate} className="btn-ghost text-xs self-start" style={{ color: 'var(--color-primary)' }}>+ Add Template</button>
            </div>

            <div className="space-y-2">
              {templates.map((t, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: 'var(--color-border)', background: 'rgba(255,255,255,0.02)' }}>
                  <div>
                    <p className="font-bold text-sm text-white">{t.title}</p>
                    <p className="text-xs text-white/50">{t.message}</p>
                  </div>
                  <button onClick={() => removeTemplate(idx)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">✕ Remove</button>
                </div>
              ))}
              {templates.length === 0 && <p className="text-xs italic opacity-50">No templates defined yet.</p>}
            </div>
          </div>

          {/* Display screen links */}
          <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <h4 className="section-title mb-3">Quick Links</h4>
            <div className="grid grid-cols-2 gap-3">
              <a href={`/display/${hid}`} target="_blank" rel="noreferrer"
                className="flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all hover:scale-105"
                style={{ background: 'rgba(var(--color-primary-rgb),0.1)', border: '1px solid rgba(var(--color-primary-rgb),0.3)' }}>
                <span className="text-2xl">🏥</span>
                <span className="text-sm font-medium text-white">Hospital Display</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Shows all doctors</span>
              </a>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl text-center"
                style={{ background: 'var(--color-surface2)', border: '1px solid var(--color-border)' }}>
                <span className="text-2xl">🩺</span>
                <span className="text-sm font-medium text-white">Per-Doctor Displays</span>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Copy URL from Admin → Doctors page
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
