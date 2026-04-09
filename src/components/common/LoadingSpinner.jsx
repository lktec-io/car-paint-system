import '../../styles/LoadingSpinner.css';

/**
 * LoadingSpinner — three display modes:
 *   Default:                 3-dot bounce loader
 *   variant="spinner":       classic rotating ring
 *   variant="skeleton"       rows={n}: skeleton table rows
 *   variant="skeleton-cards" count={n}: skeleton cards grid
 */
export default function LoadingSpinner({
  variant = 'dots',
  size = 'md',
  rows = 5,
  count = 4,
  label = 'Loading…',
}) {
  if (variant === 'spinner') {
    return (
      <div className={`spinner-wrapper spinner-wrapper--${size}`} role="status" aria-label={label}>
        <div className="spinner" />
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className="skeleton-list" role="status" aria-label={label}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton skeleton-row" style={{ animationDelay: `${i * 0.06}s` }} />
        ))}
      </div>
    );
  }

  if (variant === 'skeleton-cards') {
    return (
      <div className="skeleton-cards-grid" role="status" aria-label={label}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton skeleton-card" style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
    );
  }

  // Default: dot loader
  return (
    <div className={`spinner-wrapper spinner-wrapper--${size}`} role="status" aria-label={label}>
      <div className="dot-loader">
        <span /><span /><span />
      </div>
    </div>
  );
}
