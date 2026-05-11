export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
        signage: ['"Oswald"', 'sans-serif'],
      },
      animation: {
        'slide-up':    'slideUp 0.4s ease-out',
        'fade-in':     'fadeIn 0.3s ease-out',
        'pulse-glow':  'pulseGlow 2s ease-in-out infinite',
        'ticker':      'ticker 40s linear infinite',
        'number-flip': 'numberFlip 0.5s cubic-bezier(0.4,0,0.2,1)',
        'breathe':     'breathe 3s ease-in-out infinite',
      },
      keyframes: {
        slideUp:     { from:{ opacity:0, transform:'translateY(20px)' }, to:{ opacity:1, transform:'translateY(0)' } },
        fadeIn:      { from:{ opacity:0 }, to:{ opacity:1 } },
        pulseGlow:   { '0%,100%':{ boxShadow:'0 0 20px rgba(var(--color-primary-rgb),0.4)' }, '50%':{ boxShadow:'0 0 60px rgba(var(--color-primary-rgb),0.9)' } },
        ticker:      { from:{ transform:'translateX(100%)' }, to:{ transform:'translateX(-100%)' } },
        numberFlip:  { '0%':{ opacity:0, transform:'translateY(-30px) scale(0.8)' }, '60%':{ opacity:1, transform:'translateY(4px) scale(1.05)' }, '100%':{ transform:'translateY(0) scale(1)' } },
        breathe:     { '0%,100%':{ transform:'scale(1)' }, '50%':{ transform:'scale(1.03)' } },
      }
    }
  },
  plugins: []
}
