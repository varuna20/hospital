import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fUrl } from '../utils/api';

/**
 * SLIDESHOW COMPONENT
 * ===================
 * Loops through images and videos with configurable duration.
 * Supports auto-advance for images and onEnded-advance for videos.
 */
export default function Slideshow({ items }) {
  const [count, setCount] = useState(0);
  const timerRef = useRef(null);

  const active = useMemo(() => items?.filter(i => i.isActive) || [], [items]);
  const cur = active.length > 0 ? active[count % active.length] : null;

  const next = useCallback(() => {
    if (active.length > 0) {
      setCount(prev => prev + 1);
    }
  }, [active.length]);

  // Pre-cache media
  useEffect(() => {
    active.forEach(item => {
      const formattedUrl = fUrl(item.url);
      if (item.type !== 'video') {
        const img = new Image();
        img.src = formattedUrl;
      } else {
        const v = document.createElement('video');
        v.src = formattedUrl;
        v.preload = 'auto';
      }
    });
  }, [active]);

  // Handle auto-advance for images
  useEffect(() => {
    if (!active.length) return;
    if (cur?.type === 'video') return; 

    const d = Number(cur?.duration) || 10;
    timerRef.current = setTimeout(next, d * 1000);
    return () => clearTimeout(timerRef.current);
  }, [count, cur, active.length, next]);

  if (!active.length) {
    return (
      <div style={{ 
        width: '100%', height: '100%', 
        display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center', 
        background: 'rgba(0,0,0,0.4)', borderRadius: 16 
      }}>
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>🖼</div>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>No media content</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: 16, overflow: 'hidden' }}>
      <style>{`
        @keyframes slideFadeIn { 
          from { opacity: 0; transform: scale(1.04); } 
          to { opacity: 1; transform: scale(1); } 
        }
        .slide-fade { 
          animation: slideFadeIn 0.8s ease-out both; 
          width: 100%; 
          height: 100%;
        }
      `}</style>
      
      {/* Key is based on count to ensure animation re-triggers even if same item repeats */}
      <div key={count} className="slide-fade">
        {cur?.type === 'video' ? (
          <video 
            src={fUrl(cur.url)} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            autoPlay 
            muted 
            playsInline 
            onEnded={next}
            // If only one video, we can also use native loop for smoother playback
            loop={active.length === 1}
          />
        ) : (
          <img 
            src={fUrl(cur?.url)} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            alt="Slide" 
          />
        )}
      </div>
    </div>
  );
}
