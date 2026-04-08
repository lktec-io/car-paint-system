import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-primary)',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent-red)', fontSize: '2.5rem', margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: 480 }}>
            An unexpected error occurred. Please refresh the page or contact your administrator if the problem persists.
          </p>
          {this.state.error && (
            <pre style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              padding: '1rem',
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
              maxWidth: 600,
              overflow: 'auto',
              textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            style={{
              background: 'var(--color-accent-green)',
              color: '#0F1923',
              border: 'none',
              borderRadius: '6px',
              padding: '0.6rem 1.4rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
