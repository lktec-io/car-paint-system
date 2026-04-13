import { useState } from 'react';
import { MdWarning, MdClose, MdInventory } from 'react-icons/md';
import './LowStockAlert.css';

/**
 * Dismissible low-stock banner.
 * Props:
 *   items  — array of { id, item_name, quantity, reorder_level, unit }
 *   onView — optional callback when "View All" is clicked
 */
export default function LowStockAlert({ items = [], onView }) {
  const [dismissed, setDismissed] = useState(false);

  const valid = (items || []).filter(
    i => parseFloat(i.quantity) <= parseFloat(i.reorder_level)
  );

  if (!valid.length || dismissed) return null;

  const preview = valid.slice(0, 4);
  const extra   = valid.length - preview.length;

  return (
    <div className="lsa-banner" role="alert" aria-live="polite">
      <span className="lsa-icon"><MdWarning /></span>

      <div className="lsa-body">
        <p className="lsa-title">
          Low Stock Alert —{' '}
          <strong>{valid.length} item{valid.length !== 1 ? 's' : ''}</strong> need restocking
        </p>
        <div className="lsa-tags">
          {preview.map(item => (
            <span key={item.id} className="lsa-tag">
              <MdInventory className="lsa-tag-icon" />
              {item.item_name}
              <em>{parseFloat(item.quantity)} {item.unit || 'left'}</em>
            </span>
          ))}
          {extra > 0 && (
            <span className="lsa-tag lsa-tag--more">+{extra} more</span>
          )}
          {onView && (
            <button className="lsa-view-btn" onClick={onView}>View All</button>
          )}
        </div>
      </div>

      <button
        className="lsa-close"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss alert"
      >
        <MdClose />
      </button>
    </div>
  );
}
