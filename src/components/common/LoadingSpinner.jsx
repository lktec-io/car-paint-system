import '../../styles/LoadingSpinner.css';

export default function LoadingSpinner({ size = 'md', label = 'Loading…' }) {
  return (
    <div className={`spinner-wrapper spinner-wrapper--${size}`} role="status" aria-label={label}>
      <div className="spinner" />
    </div>
  );
}
