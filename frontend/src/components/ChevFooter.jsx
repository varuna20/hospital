import React from 'react';
import { useAuth } from '../context/AuthContext';
import { fUrl } from '../utils/api';
import logoImg from '/chevara-brand.png';

export default function ChevFooter({ minimal = false }) {
  const { systemSettings } = useAuth();
  const branding = systemSettings?.branding || {};
  
  const style = {
    wrapper: {
      textAlign: 'center',
      padding: minimal ? '12px 0' : '20px 24px',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      background: 'transparent',
      flexShrink: 0,
      marginTop: 'auto',
    },
    link: {
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      textDecoration: 'none',
      transition: 'opacity 0.2s',
      opacity: 0.7,
    },
    logo: {
      height: minimal ? 28 : 36,
      objectFit: 'contain',
      display: 'block',
    },
    text: {
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 9,
      color: 'rgba(255,255,255,0.25)',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    badge: {
      background: '#fff',
      padding: '8px 16px',
      borderRadius: '12px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      border: '1px solid rgba(0,0,0,0.05)',
    }
  };

  const displayLogo = branding.logo ? fUrl(branding.logo) : logoImg;
  const displayText = branding.footerText || 'Powered by';
  const displayBrand = branding.brandName || 'Chevara Labs';
  const displayLink = branding.website || 'https://chevaralabs.com';

  return (
    <div style={style.wrapper}>
      <a href={displayLink} target="_blank" rel="noreferrer" style={style.link}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}>
        <span style={style.text}>{displayText}</span>
        <div style={style.badge}>
          <img src={displayLogo} alt={displayBrand} style={style.logo} />
        </div>
      </a>
    </div>
  );
}
