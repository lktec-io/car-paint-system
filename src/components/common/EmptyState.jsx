import { MdInbox } from 'react-icons/md';
import '../../styles/EmptyState.css';

export default function EmptyState({ icon, title = 'Nothing here yet', message, action }) {
  const Icon = icon || MdInbox;
  return (
    <div className="empty-state">
      <div className="empty-state-icon"><Icon /></div>
      <h3 className="empty-state-title">{title}</h3>
      {message && <p className="empty-state-message">{message}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
