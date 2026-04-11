import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  MdDirectionsCar, MdDashboard, MdPeople, MdAccountBalance,
  MdInventory2, MdReceipt, MdGroup, MdMoneyOff,
  MdLocalShipping, MdBarChart, MdExpandMore,
  MdChevronLeft, MdChevronRight, MdPointOfSale,
} from 'react-icons/md';
import useUiStore from '../../stores/uiStore';
import useAuth from '../../hooks/useAuth';
import '../../styles/Sidebar.css';

const ALL_ROLES = ['super_admin', 'accountant', 'store_manager', 'sales_officer', 'technician', 'viewer'];

const NAV_CONFIG = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    Icon: MdDashboard,
    roles: ALL_ROLES,
  },
  {
    path: '/users',
    label: 'Users',
    Icon: MdPeople,
    roles: ['super_admin'],
  },
  { divider: true, roles: ['super_admin', 'accountant'] },
  {
    label: 'Accounting',
    Icon: MdAccountBalance,
    roles: ['super_admin', 'accountant'],
    children: [
      { path: '/accounting/accounts',       label: 'Chart of Accounts', Icon: MdAccountBalance },
      { path: '/accounting/journal',        label: 'Journal Entries',   Icon: MdReceipt },
      { path: '/accounting/trial-balance',  label: 'Trial Balance',     Icon: MdBarChart },
      { path: '/accounting/profit-loss',    label: 'Profit & Loss',     Icon: MdBarChart },
      { path: '/accounting/balance-sheet',  label: 'Balance Sheet',     Icon: MdBarChart },
    ],
  },
  { divider: true, roles: ALL_ROLES },
  {
    path: '/inventory',
    label: 'Inventory',
    Icon: MdInventory2,
    roles: ALL_ROLES,
  },
  {
    label: 'Sales',
    Icon: MdPointOfSale,
    roles: ['super_admin', 'accountant', 'store_manager', 'sales_officer'],
    children: [
      { path: '/sales/invoices',   label: 'Invoices',   Icon: MdReceipt },
      { path: '/sales/customers',  label: 'Customers',  Icon: MdGroup },
    ],
  },
  {
    path: '/expenses',
    label: 'Expenses',
    Icon: MdMoneyOff,
    roles: ['super_admin', 'accountant', 'store_manager'],
  },
  {
    path: '/suppliers',
    label: 'Suppliers',
    Icon: MdLocalShipping,
    roles: ['super_admin', 'accountant', 'store_manager'],
  },
  { divider: true, roles: ['super_admin', 'accountant', 'store_manager', 'sales_officer', 'viewer'] },
  {
    path: '/reports',
    label: 'Reports',
    Icon: MdBarChart,
    roles: ['super_admin', 'accountant', 'store_manager', 'sales_officer', 'viewer'],
  },
];

// Bottom nav shows the 5 most important items on mobile
const BOTTOM_NAV_PATHS = ['/dashboard', '/inventory', '/sales/invoices', '/reports'];

function NavItem({ item, collapsed }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `nav-item${isActive ? ' nav-item--active' : ''}`
      }
      title={collapsed ? item.label : undefined}
    >
      <span className="nav-item-icon"><item.Icon /></span>
      <span className="nav-item-label">{item.label}</span>
    </NavLink>
  );
}

function NavGroup({ item, collapsed }) {
  const location = useLocation();
  const hasActiveChild = item.children.some((c) => location.pathname.startsWith(c.path));
  const [open, setOpen] = useState(hasActiveChild);

  // Auto-open group when navigating to a child path
  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  return (
    <div className="nav-group">
      <button
        className={`nav-group-toggle${hasActiveChild ? ' nav-group-toggle--active' : ''}`}
        onClick={() => !collapsed && setOpen((s) => !s)}
        title={collapsed ? item.label : undefined}
      >
        <span className="nav-item-icon"><item.Icon /></span>
        <span className="nav-item-label">{item.label}</span>
        {!collapsed && (
          <MdExpandMore
            className={`nav-group-arrow${open ? ' nav-group-arrow--open' : ''}`}
          />
        )}
      </button>

      {!collapsed && (
        <div
          className="nav-group-children"
          style={{ maxHeight: open ? `${item.children.length * 44}px` : 0 }}
        >
          {item.children.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              className={({ isActive }) =>
                `nav-item${isActive ? ' nav-item--active' : ''}`
              }
            >
              <span className="nav-item-icon"><child.Icon /></span>
              <span className="nav-item-label">{child.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUiStore();
  const { user } = useAuth();
  const location = useLocation();

  const collapsed = !sidebarOpen;

  // On mobile, close sidebar when route changes
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname, setSidebarOpen]);

  const role = user?.role || 'viewer';

  const visibleItems = NAV_CONFIG.filter((item) => {
    if (item.divider) return item.roles.includes(role);
    return item.roles?.includes(role) || item.children?.length > 0;
  }).filter((item) => {
    if (item.children) {
      return item.roles.includes(role);
    }
    return true;
  });

  const initials = user?.full_name
    ? user.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '??';

  // Bottom nav items (mobile) — flatten top-level + children to catch nested paths
  const allNavItems = NAV_CONFIG.flatMap((item) =>
    item.children ? item.children.map((c) => ({ ...c, roles: item.roles })) : [item]
  );
  const bottomNavItems = allNavItems.filter(
    (item) => item.path && BOTTOM_NAV_PATHS.includes(item.path) && item.roles?.includes(role)
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && window.innerWidth < 768 && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}${sidebarOpen && window.innerWidth < 768 ? ' sidebar--mobile-open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <MdDirectionsCar className="sidebar-logo-icon" />
            {!collapsed && <span className="sidebar-logo-text">Silas Paint Store</span>}
          </div>
          <button className="sidebar-toggle" onClick={toggleSidebar} aria-label="Toggle sidebar">
            {collapsed ? <MdChevronRight /> : <MdChevronLeft />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {visibleItems.map((item, i) => {
            if (item.divider) return <div key={`div-${i}`} className="nav-divider" />;
            if (item.children) return <NavGroup key={item.label} item={item} collapsed={collapsed} />;
            return <NavItem key={item.path} item={item} collapsed={collapsed} />;
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-user">
            <div className="sidebar-footer-avatar" title={user?.full_name}>
              {initials}
            </div>
            {!collapsed && (
              <div className="sidebar-footer-info">
                <div className="sidebar-footer-name">{user?.full_name}</div>
                <div className="sidebar-footer-role">
                  {user?.role?.replace('_', ' ')}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="bottom-nav">
        {bottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `bottom-nav-item${isActive ? ' bottom-nav-item--active' : ''}`
            }
          >
            <item.Icon />
            <span>{item.path === '/sales/invoices' ? 'Sales' : item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
