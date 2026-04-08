import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MdMenu, MdNotifications, MdWbSunny, MdNightlight, MdLogout, MdExpandMore,
  MdWarning, MdError, MdCheckCircle, MdInfo,
} from 'react-icons/md';
import useUiStore from '../../stores/uiStore';
import useNotificationStore from '../../stores/notificationStore';
import useAuth from '../../hooks/useAuth';
import usePolling from '../../hooks/usePolling';
import api from '../../api/axios';
import '../../styles/TopBar.css';

const PAGE_TITLES = {
  '/dashboard':                  'Dashboard',
  '/users':                      'User Management',
  '/accounting/accounts':        'Chart of Accounts',
  '/accounting/journal':         'Journal Entries',
  '/accounting/ledger':          'General Ledger',
  '/accounting/trial-balance':   'Trial Balance',
  '/accounting/profit-loss':     'Profit & Loss',
  '/accounting/balance-sheet':   'Balance Sheet',
  '/inventory':                  'Inventory',
  '/sales/invoices':             'Invoices',
  '/sales/customers':            'Customers',
  '/expenses':                   'Expenses',
  '/jobs':                       'Job Management',
  '/suppliers':                  'Suppliers',
  '/reports':                    'Reports & Analytics',
  '/audit':                      'Audit Logs',
};

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSidebarOpen, sidebarOpen, theme, toggleTheme } = useUiStore();
  const { notifications, unreadCount, markAllRead } = useNotificationStore();
  const { user, logout } = useAuth();

  const { setNotifications } = useNotificationStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const pollFn = useCallback(async () => {
    try {
      const { data } = await api.get('/audit-logs/poll');
      const items = (data.data?.notifications || []).map(n => ({ ...n, read: false }));
      setNotifications(items);
    } catch {
      // silent — polling failures must not interrupt the user
    }
  }, [setNotifications]);

  usePolling(pollFn, 30_000, Boolean(user));

  const notifRef = useRef(null);
  const userRef = useRef(null);

  const pageTitle = PAGE_TITLES[location.pathname] || 'AutoShine';

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '??';

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  async function handleLogout() {
    setUserMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="topbar">
      {/* Mobile: open sidebar drawer */}
      <button
        className="topbar-menu-btn"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <MdMenu />
      </button>

      <h1 className="topbar-title">{pageTitle}</h1>

      <div className="topbar-actions">
        {/* Theme toggle */}
        <button
          className="topbar-icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? <MdWbSunny /> : <MdNightlight />}
        </button>

        {/* Notification bell */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            className="topbar-icon-btn"
            onClick={() => { setNotifOpen((s) => !s); setUserMenuOpen(false); }}
            aria-label="Notifications"
          >
            <MdNotifications />
            {unreadCount > 0 && (
              <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>

          {notifOpen && (
            <div className="notif-dropdown">
              <div className="notif-dropdown-header">
                <h4>Notifications</h4>
                {unreadCount > 0 && (
                  <button className="notif-mark-read" onClick={markAllRead}>
                    Mark all read
                  </button>
                )}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">All clear — no alerts</div>
                ) : (
                  notifications.slice(0, 10).map((n) => {
                    const Icon = n.type === 'warning' ? MdWarning : n.type === 'danger' ? MdError : n.type === 'success' ? MdCheckCircle : MdInfo;
                    const color = n.type === 'warning' ? 'var(--color-accent-orange)' : n.type === 'danger' ? 'var(--color-accent-red)' : n.type === 'success' ? 'var(--color-accent-green)' : 'var(--color-accent-blue)';
                    return (
                      <div key={n.id} className={`notif-item${!n.read ? ' notif-item--unread' : ''}`}>
                        <Icon style={{ color, flexShrink: 0 }} />
                        <span>{n.message}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="user-menu-wrapper" ref={userRef}>
          <button
            className="user-menu-btn"
            onClick={() => { setUserMenuOpen((s) => !s); setNotifOpen(false); }}
            aria-label="User menu"
          >
            <div className="user-avatar">{initials}</div>
            <span className="user-name">{user?.full_name}</span>
            <MdExpandMore style={{ color: 'var(--color-text-secondary)', fontSize: '1rem' }} />
          </button>

          {userMenuOpen && (
            <div className="user-dropdown">
              <div className="user-dropdown-info">
                <div className="user-dropdown-name">{user?.full_name}</div>
                <div className="user-dropdown-role">{user?.role?.replace(/_/g, ' ')}</div>
                <div className="user-dropdown-email">{user?.email}</div>
              </div>
              <button className="user-dropdown-btn" onClick={handleLogout}>
                <MdLogout /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
