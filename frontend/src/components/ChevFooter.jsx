import React from 'react';
import { useAuth } from '../context/AuthContext';

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
    text: {
      fontFamily: 'DM Sans, sans-serif',
      fontSize: 10,
      color: 'rgba(255,255,255,0.25)',
      letterSpacing: '0.05em',
      textTransform: 'none',
    }
  };

  const displayText = branding.footerText || 'Powered by';
  const displayBrand = branding.brandName || 'Chevara Labs';
  const displayLink = branding.website || 'https://chevaralabs.com';

  return (
    <div style={style.wrapper}>
      <a href={displayLink} target="_blank" rel="noreferrer" style={style.link}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}>
        <span style={style.text}>{displayText} {displayBrand}</span>
      </a>
    </div>
  );
}

