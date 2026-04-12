import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MdWbSunny, MdNightlight, MdLogout, MdExpandMore,
} from 'react-icons/md';
import useUiStore from '../../stores/uiStore';
import useAuth from '../../hooks/useAuth';
import '../../styles/TopBar.css';

const PAGE_TITLES = {
  '/dashboard':                 'Dashboard',
  '/users':                     'User Management',
  '/accounting/accounts':       'Chart of Accounts',
  '/accounting/journal':        'Journal Entries',
  '/accounting/trial-balance':  'Trial Balance',
  '/accounting/profit-loss':    'Profit & Loss',
  '/accounting/balance-sheet':  'Balance Sheet',
  '/inventory':                 'Inventory',
  '/sales':                     'Sales',
  '/expenses':                  'Expenses',
  '/suppliers':                 'Suppliers',
  '/reports':                   'Reports & Analytics',
};

export default function TopBar({ onLogout }) {
  const navigate    = useNavigate();
  const location    = useLocation();
  const { setSidebarOpen, sidebarOpen, theme, toggleTheme } = useUiStore();
  const { user, logout } = useAuth();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userRef = useRef(null);

  const pageTitle = PAGE_TITLES[location.pathname] || 'Silas Paint Store';

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '??';

  // Close user menu when clicking outside
  useEffect(() => {
    function handleOutside(e) {
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  async function handleLogout() {
    setUserMenuOpen(false);
    await (onLogout ? onLogout() : logout());
    if (!onLogout) navigate('/login', { replace: true });
  }

  return (
    <header className="topbar">
      {/* Hamburger */}
      <button
        className={`hamburger${sidebarOpen ? ' active' : ''}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
      >
        <span /><span /><span />
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
          <span className={`theme-toggle-icon${theme === 'light' ? ' rotated' : ''}`}>
            {theme === 'dark' ? <MdWbSunny /> : <MdNightlight />}
          </span>
        </button>

        {/* User menu */}
        <div className="user-menu-wrapper" ref={userRef}>
          <button
            className="user-menu-btn"
            onClick={() => setUserMenuOpen((s) => !s)}
            aria-label="User menu"
          >
            {user?.profile_image ? (
              <img src={user.profile_image} alt="" className="topbar-avatar" />
            ) : (
              <div className="user-avatar">{initials}</div>
            )}
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
