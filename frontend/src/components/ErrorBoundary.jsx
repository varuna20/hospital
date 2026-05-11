import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('App Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0f172a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'DM Sans, sans-serif', padding: '2rem'
        }}>
          <div style={{ maxWidth: 500, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: 'white', marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div style={{ background: '#1e293b', borderRadius: 8, padding: '12px 16px', marginBottom: 24, textAlign: 'left' }}>
              <p style={{ color: '#ef4444', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {this.state.error?.stack?.split('\n')[0]}
              </p>
            </div>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
              style={{ background: '#0d9488', color: 'white', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
              ↩ Go to Home
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#1e293b', color: '#94a3b8', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14, marginLeft: 8 }}>
              ↻ Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
