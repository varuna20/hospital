import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';

export default function NotificationBell() {
  const { user, hospital } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (!socket || !hospital?._id) return;
    socket.on('new_notification', (notif) => {
      // Only show if matches role or is specifically for this user
      if (notif.role === user.role || notif.userId === user._id) {
        setNotifications(prev => [notif, ...prev]);
        // Optional: show a small ping sound or toast
      }
    });
    return () => socket.off('new_notification');
  }, [socket, hospital, user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  const handleNotificationClick = async (n) => {
    setIsOpen(false);
    
    // Mark as read in backend
    try {
      await api.put(`/notifications/${n._id}/read`);
      setNotifications(prev => prev.map(item => item._id === n._id ? { ...item, isRead: true } : item));
    } catch {}

    // Smart Routing Logic based on notification title, link, or type!
    if (n.link) {
      navigate(n.link);
      return;
    }

    const t = (n.title || '').toLowerCase();
    const m = (n.message || '').toLowerCase();
    
    if (n.type === 'doctor_request' || t.includes('reschedule') || m.includes('reschedule') || t.includes('vacation') || m.includes('vacation')) {
      if (user.role === 'admin' || user.role === 'staff') {
        navigate('/staff/queue?requests=true');
      } else if (user.role === 'doctor') {
        navigate('/doctor/calendar');
      }
    } else if (n.type === 'booking' || t.includes('booking') || t.includes('appointment')) {
      if (user.role === 'admin' || user.role === 'staff') {
        navigate('/staff/queue');
      } else if (user.role === 'doctor') {
        navigate('/doctor/calendar');
      } else if (user.role === 'patient') {
        navigate('/patient-dashboard');
      }
    } else if (t.includes('refund')) {
      if (user.role === 'admin' || user.role === 'staff') {
        navigate('/staff/refund');
      } else if (user.role === 'doctor') {
        navigate('/doctor');
      }
    }
  };

  const clearAllNotifications = async () => {
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
    } catch {}
  };

  return (
    <div className="relative">
      <button 
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) markAllRead(); }}
        className="relative p-2 rounded-full hover:bg-white/5 transition-all text-white/70 hover:text-white"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-[#02040a]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-[400px] overflow-hidden rounded-2xl bg-[#0f172a] border border-white/10 shadow-2xl z-[70] flex flex-col">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-white">Notifications</h3>
              <button onClick={markAllRead} className="text-[10px] text-primary hover:underline font-bold uppercase tracking-wider">Mark all read</button>
            </div>
            
            <div className="overflow-y-auto flex-1 no-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-10 text-center text-white/30 text-sm">No notifications yet</div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n._id} 
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 border-b border-white/5 hover:bg-white/[0.04] cursor-pointer transition-all duration-200 ${!n.isRead ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
                  >
                    <p className="text-xs font-bold text-white mb-0.5">{n.title}</p>
                    <p className="text-[11px] text-white/60 leading-relaxed">{n.message}</p>
                    <p className="text-[9px] text-white/30 mt-2">{moment(n.createdAt).fromNow()}</p>
                  </div>
                ))
              )}
            </div>
            
            {notifications.length > 0 && (
              <div className="p-3 bg-white/[0.02] text-center border-t border-white/5">
                <button onClick={clearAllNotifications} className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest cursor-pointer">Clear History</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
