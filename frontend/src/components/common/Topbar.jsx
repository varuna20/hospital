import React from 'react';
import { Link } from 'react-router-dom';
import { fUrl } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../NotificationBell';

export default function Topbar({ title, onMenuClick }) {
  const { user } = useAuth();
  const profileImg = user?.avatar || user?.doctorProfile?.profileImage;

  return (
    <div className="h-16 px-4 md:px-6 border-b flex items-center justify-between sticky top-0 z-30"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', backdropFilter: 'blur(10px)' }}>
      
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 -ml-2 text-white/70 hover:text-white">
          <span className="text-2xl">☰</span>
        </button>
        <span className="font-bold text-sm tracking-widest text-white/40 uppercase hidden md:block">{title}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex flex-col items-end mr-2">
          <span className="text-xs font-bold text-white leading-none">{user?.name}</span>
          <span className="text-[10px] text-primary uppercase font-bold tracking-tighter mt-1">{user?.role}</span>
        </div>
        
        <div className="w-[1px] h-8 bg-white/5 mx-1 hidden sm:block" />
        
        <NotificationBell />
        
        <Link to={`/${user?.role === 'patient' ? 'patient-dashboard' : user?.role === 'superadmin' ? 'super' : user?.role}/profile`} 
          className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 overflow-hidden flex items-center justify-center text-primary font-bold text-sm uppercase hover:scale-110 transition-all">
          {profileImg ? (
            <img src={fUrl(profileImg)} alt="" className="w-full h-full object-cover" />
          ) : (
            user?.name?.charAt(0) || 'U'
          )}
        </Link>
      </div>
    </div>
  );
}
