import { MdCheckCircle, MdError, MdWarning, MdInfo, MdClose } from 'react-icons/md';
import useUiStore from '../../stores/uiStore';
import '../../styles/ToastContainer.css';

const ICONS = {
  success: MdCheckCircle,
  error:   MdError,
  warning: MdWarning,
  info:    MdInfo,
};

export default function ToastContainer() {
  const { toasts, removeToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] || MdInfo;
        return (
          <div key={toast.id} className={`toast toast--${toast.type}`} role="alert">
            <span className="toast-icon"><Icon /></span>
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss"
            >
              <MdClose />
            </button>
          </div>
        );
      })}
    </div>
  );
}
