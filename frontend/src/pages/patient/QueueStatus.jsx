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

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const apptDate = status.appointmentDate ? new Date(status.appointmentDate) : null;
  if (apptDate) {
    apptDate.setHours(0,0,0,0);
  }
  const isFuture = apptDate ? apptDate.getTime() > today.getTime() : false;

  const isDone = status.status === 'completed';
  const isMyTurn = !isFuture && status.peopleAhead === 0 && !isDone;

  const handleAddToCalendar = () => {
    if (!status) return;

    const apptDateObj = new Date(status.appointmentDate);
    let startHour = 9, startMin = 0;
    let endHour = 10, endMin = 0;

    if (status.sessionTime) {
      const parts = status.sessionTime.split('-');
      const startPart = parts[0]?.trim();
      const endPart = parts[1]?.trim();

      if (startPart && startPart.includes(':')) {
        const [sh, sm] = startPart.split(':').map(Number);
        if (!isNaN(sh)) { startHour = sh; startMin = sm || 0; }
      }
      if (endPart && endPart.includes(':')) {
        const [eh, em] = endPart.split(':').map(Number);
        if (!isNaN(eh)) { endHour = eh; endMin = em || 0; }
      } else {
        endHour = startHour + 1;
        endMin = startMin;
      }
    }

    const startDate = new Date(apptDateObj);
    startDate.setHours(startHour, startMin, 0);
    const endDate = new Date(apptDateObj);
    endDate.setHours(endHour, endMin, 0);

    const formatDate = (date) => {
      const pad = (n) => String(n).padStart(2, '0');
      return date.getUTCFullYear() +
        pad(date.getUTCMonth() + 1) +
        pad(date.getUTCDate()) + 'T' +
        pad(date.getUTCHours()) +
        pad(date.getUTCMinutes()) +
        pad(date.getUTCSeconds()) + 'Z';
    };

    const dtStart = formatDate(startDate);
    const dtEnd = formatDate(endDate);
    const nowStr = formatDate(new Date());

    const summary = `Appointment with Dr. ${status.doctor}`;
    const description = `Appointment with Dr. ${status.doctor} at ${status.hospitalName}. Queue Number: #${status.queueNumber}. Room: ${status.room || 'TBD'}. Session: ${status.sessionLabel || 'General'}.`;
    const location = `${status.room || 'TBD'}, ${status.hospitalName}`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Hospital System//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${status.queueNumber}-${dtStart}-${status.doctor.replace(/\s+/g, '')}@hospitalsystem.com`,
      `DTSTAMP:${nowStr}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT1H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `appointment-dr-${status.doctor.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          {status.hospitalName && (
            <p className="text-xs uppercase font-black tracking-widest mb-1.5" style={{ color: 'var(--color-primary)' }}>
              {status.hospitalName}
            </p>
          )}
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
              background: isDone ? 'rgba(16,185,129,0.15)' : isMyTurn ? 'rgba(245,158,11,0.15)' : isFuture ? 'rgba(99,102,241,0.15)' : 'var(--color-surface2)',
              color: isDone ? '#10b981' : isMyTurn ? '#f59e0b' : isFuture ? '#818cf8' : 'var(--color-text-muted)'
            }}>
            {isDone && '✓ '}
            {isDone 
              ? 'Consultation Complete' 
              : isFuture 
                ? 'Your appointment date and time as below' 
                : isMyTurn 
                  ? '🔔 Your Turn! Please proceed' 
                  : status.peopleAhead + ' ahead of you'}
          </span>

          {isFuture && apptDate && (
            <div className="mt-4 pt-4 border-t text-left" style={{ borderColor: 'var(--color-border)' }}>
              <div className="rounded-xl p-3 flex flex-col gap-2.5" style={{ background: 'var(--color-surface2)' }}>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Scheduled Date</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {apptDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="border-t pt-2" style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Session Time</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--color-primary)' }}>
                    {status.sessionLabel || 'General'} {status.sessionTime ? `(${status.sessionTime})` : ''}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {isFuture && (
          <button
            onClick={handleAddToCalendar}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border transition-all mb-4"
            style={{
              background: 'rgba(99,102,241,0.1)',
              borderColor: 'rgba(99,102,241,0.3)',
              color: '#818cf8',
              fontFamily: 'Sora,sans-serif'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(99,102,241,0.2)';
              e.currentTarget.style.borderColor = '#818cf8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(99,102,241,0.1)';
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
            }}
          >
            📅 Add to Calendar (1h Reminder)
          </button>
        )}

        {!isFuture && !isDone && status.isArrived === false && (
          <div className="card text-center mb-4 border-dashed border-2" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Session is not started yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Please wait for the doctor to arrive.</p>
          </div>
        )}

        {!isFuture && !isDone && status.isArrived !== false && (
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

        {!isFuture && !isDone && status.peopleAhead > 0 && (
          <div className="card text-center mb-4" style={{ borderColor: 'rgba(var(--color-primary-rgb),0.3)', background: 'rgba(var(--color-primary-rgb),0.05)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>Estimated Wait</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'Sora,sans-serif' }}>
              {waitEstimate(status.peopleAhead, status.avgSlotMinutes || 15)}
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
