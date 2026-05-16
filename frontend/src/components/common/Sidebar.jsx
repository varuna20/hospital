import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fUrl } from '../../utils/api';

const NAV = {
  superadmin: [
    { to: '/super',               label: 'Dashboard',      icon: '⬡', end: true },
    { to: '/super/hospitals',     label: 'Hospitals',      icon: '🏥' },
    { to: '/super/revenue',       label: 'Revenue',        icon: '💰' },
    { to: '/super/subscriptions', label: 'Subscriptions',  icon: '📦' },
    { to: '/super/system',        label: 'System',         icon: '⚙' },
    { to: '/super/logs',          label: 'Message Logs',   icon: '📝' },
    { to: '/super/links',         label: 'Hospital Links', icon: '🔗' },
  ],
  admin: [
    { to: '/admin',          label: 'Dashboard', icon: '⬡', end: true },
    { to: '/admin/doctors',  label: 'Doctors',   icon: '🩺' },
    { to: '/admin/staff',    label: 'Staff',     icon: '👥' },
    { to: '/admin/revenue',  label: 'Revenue',   icon: '💰' },
    { to: '/admin/media',    label: 'Media',     icon: '🎥' },
    { to: '/admin/drugs',    label: 'Drug Library',  icon: '💊' },
    { to: '/admin/settings', label: 'Settings',  icon: '⚙' },
  ],
  staff: [
    { to: '/staff',          label: 'Dashboard', icon: '⬡', end: true },
    { to: '/staff/queue',    label: 'Queue',     icon: '🔢' },
    { to: '/staff/booking',  label: 'Booking',   icon: '📅' },
  ],
  doctor: [
    { to: '/doctor',                 label: 'Dashboard',     icon: '⬡', end: true },
    { to: '/doctor/prescriptions',   label: 'Prescriptions', icon: '📋' },
    { to: '/doctor/drugs',           label: 'Drug Library',  icon: '💊' },
    { to: '/doctor/revenue',         label: 'My Revenue',    icon: '💰' },
  ],
};

export default function Sidebar({ mobileOpen, setMobileOpen }) {
  const { user, hospital, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const items = NAV[user?.role] || [];
  const theme = hospital?.theme || {};
  const primary = theme.primary || 'var(--color-primary)';

  return (
    <>
      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`flex flex-col h-screen transition-all duration-300 fixed lg:relative z-50 flex-shrink-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ width: collapsed ? '64px' : '240px', background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}>

      {/* Hospital branding */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          {hospital?.logo ? (
            <img src={fUrl(hospital.logo)} alt="logo" className="w-8 h-8 rounded-lg object-contain flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ background: primary }}>
              {user?.role === 'superadmin' ? '★' : (hospital?.name?.charAt(0) || 'H')}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white text-xs font-bold truncate" style={{ fontFamily: 'Sora,sans-serif' }}>
                {user?.role === 'superadmin' ? 'Super Admin' : (hospital?.shortName || hospital?.name || 'Hospital')}
              </p>
              <p className="text-xs capitalize" style={{ color: primary }}>{user?.role}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {items.map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => isActive ? 'nav-item nav-item-active' : 'nav-item'}>
            <span className="text-base flex-shrink-0">{icon}</span>
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}

        {/* Display screen link */}
        {['staff', 'admin'].includes(user?.role) && hospital?._id && (
          <a href={'/display/' + hospital._id} target="_blank" rel="noopener noreferrer" className="nav-item">
            <span className="text-base flex-shrink-0">📺</span>
            {!collapsed && <span>Display Screen</span>}
          </a>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t space-y-1" style={{ borderColor: 'var(--color-border)' }}>
        <button onClick={() => setCollapsed(c => !c)} className="nav-item w-full">
          <span className="flex-shrink-0">{collapsed ? '→' : '←'}</span>
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>

        {!collapsed && (
          <div className="px-3 py-2 rounded-xl" style={{ background: 'var(--color-surface2)' }}>
            <p className="text-white text-xs font-medium truncate">{user?.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{user?.email}</p>
            <button onClick={logout} className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
