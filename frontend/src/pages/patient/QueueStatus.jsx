import ChevFooter from '../../components/ChevFooter.jsx';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import api from '../../utils/api';
import { waitEstimate } from '../../utils/helpers';

export default function QueueStatus() {
  const { token } = useParams();
  const { socket } = useSocket();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const { data } = await api.get('/appointments/guest/' + token);
      if (data.success) setStatus(data);
    } catch { setStatus(null); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, 20000);
    return () => clearInterval(id);
  }, [fetch]);

  useEffect(() => {
    if (!socket) return;
    ['next_called', 'queue_update', 'appointment_updated'].forEach(e => socket.on(e, fetch));
    return () => ['next_called', 'queue_update', 'appointment_updated'].forEach(e => socket.off(e, fetch));
  }, [socket, fetch]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)' }} />
    </div>
  );

  if (!status) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
      <div className="text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-bold text-white mb-2">Appointment Not Found</h2>
        <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>The link may be invalid or expired.</p>
        <a href="/" className="btn-primary inline-block">Book New Appointment</a>
      </div>
    </div>
  );

  const isDone = status.status === 'completed';
  const isMyTurn = status.peopleAhead === 0 && !isDone;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Sora,sans-serif' }}>Your Queue Status</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Dr. {status.doctor} · {status.room}</p>
        </div>

        {/* Big number */}
        <div className="card text-center mb-4" style={{
          boxShadow: isMyTurn ? '0 0 40px rgba(var(--color-primary-rgb),0.5)' : 'none',
          borderColor: isMyTurn ? 'var(--color-primary)' : 'var(--color-border)'
        }}>
          <p className="text-xs tracking-widest mb-2" style={{ color: 'var(--color-text-muted)' }}>YOUR NUMBER</p>
          <p className="font-black text-8xl my-3" style={{ color: 'var(--color-primary)', fontFamily: 'Sora,sans-serif' }}>
            {status.queueNumber}
          </p>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium"
            style={{
              background: isDone ? 'rgba(16,185,129,0.15)' : isMyTurn ? 'rgba(245,158,11,0.15)' : 'var(--color-surface2)',
              color: isDone ? '#10b981' : isMyTurn ? '#f59e0b' : 'var(--color-text-muted)'
            }}>
            {isDone && '✓ '}
            {isDone ? 'Consultation Complete' : isMyTurn ? '🔔 Your Turn! Please proceed' : status.peopleAhead + ' ahead of you'}
          </span>
        </div>

        {!isDone && status.isArrived === false && (
          <div className="card text-center mb-4 border-dashed border-2" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Session is not started yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Please wait for the doctor to arrive.</p>
          </div>
        )}

        {!isDone && status.isArrived !== false && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Sora,sans-serif' }}>{status.currentServing}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Now Serving</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Sora,sans-serif' }}>{status.peopleAhead}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Ahead of You</p>
            </div>
          </div>
        )}

        {!isDone && status.peopleAhead > 0 && (
          <div className="card text-center mb-4" style={{ borderColor: 'rgba(var(--color-primary-rgb),0.3)', background: 'rgba(var(--color-primary-rgb),0.05)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Estimated Wait</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'Sora,sans-serif' }}>
              {waitEstimate(status.peopleAhead)}
            </p>
          </div>
        )}

        <div className="text-center">
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Updates automatically every 20 seconds</p>
          <button onClick={fetch} className="text-xs" style={{ color: 'var(--color-primary)' }}>Refresh now</button>
        </div>
        <div className="text-center mt-6">
          <a href="/" className="text-sm" style={{ color: 'var(--color-text-muted)' }}>← Book another appointment</a>
        </div>
      </div>
      <ChevFooter minimal />
    </div>
  );
}
