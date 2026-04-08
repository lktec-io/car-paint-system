import '../../styles/StatCard.css';

/**
 * @prop {ReactNode} icon
 * @prop {string}    label
 * @prop {string}    value
 * @prop {string}    sub       - secondary text below value
 * @prop {'green'|'orange'|'red'|'blue'} color
 * @prop {boolean}   loading
 */
export default function StatCard({ icon, label, value, sub, color = 'blue', loading = false }) {
  return (
    <div className={`stat-card stat-card--${color}`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-body">
        <p className="stat-card-label">{label}</p>
        {loading
          ? <div className="skeleton" style={{ height: 24, width: 80, borderRadius: 4 }} />
          : <p className="stat-card-value">{value}</p>
        }
        {sub && !loading && <p className="stat-card-sub">{sub}</p>}
      </div>
    </div>
  );
}
