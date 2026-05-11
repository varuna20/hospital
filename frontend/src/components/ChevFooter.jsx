import React from 'react';

export default function ChevFooter({ minimal = false }) {
  const style = {
    wrapper: {
      textAlign: 'center',
      padding: minimal ? '10px 0 6px' : '14px 24px',
      borderTop: '1px solid rgba(0,212,170,0.15)',
      background: 'rgba(0,212,170,0.04)',
      flexShrink: 0,
      marginTop: 'auto',
    },
    link: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      textDecoration: 'none',
      transition: 'opacity 0.2s',
    },
    logo: {
      height: minimal ? 20 : 26,
      objectFit: 'contain',
      // Invert to white so it's visible on dark background
      filter: 'brightness(0) invert(1) opacity(0.75)',
    },
    text: {
      fontFamily: 'DM Sans, sans-serif',
      fontSize: minimal ? 11 : 12,
      color: 'rgba(255,255,255,0.5)',
      letterSpacing: '0.02em',
    },
    brand: {
      color: '#00d4aa',
      fontWeight: 700,
    },
    crown: {
      color: 'rgba(255,255,255,0.35)',
    },
  };

  return (
    <div style={style.wrapper}>
      <a href="https://chevaralabs.com" target="_blank" rel="noreferrer" style={style.link}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = ''}>
        <img src="/chevara-logo.png" alt="Chevara Labs" style={style.logo} />
        <span style={style.text}>
          Powered by{' '}
          <strong style={style.brand}>CHEVARA Labs</strong>
          <span style={style.crown}> by Crown</span>
        </span>
      </a>
    </div>
  );
}
