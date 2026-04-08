import { MdWarning, MdDeleteForever } from 'react-icons/md';
import Modal from './Modal';

/**
 * @prop {boolean}  open
 * @prop {Function} onClose
 * @prop {Function} onConfirm
 * @prop {string}   title
 * @prop {string}   message
 * @prop {'danger'|'warning'} variant
 * @prop {boolean}  loading
 */
export default function ConfirmDialog({
  open, onClose, onConfirm, title = 'Confirm', message, variant = 'danger', loading = false,
}) {
  const Icon = variant === 'danger' ? MdDeleteForever : MdWarning;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-secondary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing…' : 'Confirm'}
          </button>
        </>
      }
    >
      <div className={`confirm-icon confirm-icon--${variant}`}><Icon /></div>
      <p className="confirm-message">{message}</p>
    </Modal>
  );
}
