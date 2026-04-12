import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';
import Login from '../pages/auth/Login';

// Pages — imported as they are built phase by phase.
// Placeholder component used until the real page is created.
import Dashboard from '../pages/dashboard/Dashboard';
import UsersPage from '../pages/users/UsersPage';
import ChartOfAccounts from '../pages/accounting/ChartOfAccounts';
import JournalEntries from '../pages/accounting/JournalEntries';
import TrialBalance from '../pages/accounting/TrialBalance';
import ProfitLoss from '../pages/accounting/ProfitLoss';
import BalanceSheet from '../pages/accounting/BalanceSheet';
import InventoryPage from '../pages/inventory/InventoryPage';
import SalesPage from '../pages/sales/SalesPage';
import ExpensesPage from '../pages/expenses/ExpensesPage';
import SuppliersPage from '../pages/suppliers/SuppliersPage';
import ReportsPage from '../pages/reports/ReportsPage';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected — all wrapped in AppLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />

        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />

        {/* Accounting */}
        <Route
          path="/accounting/accounts"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'accountant']}>
              <ChartOfAccounts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting/journal"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'accountant']}>
              <JournalEntries />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting/trial-balance"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'accountant']}>
              <TrialBalance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting/profit-loss"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'accountant']}>
              <ProfitLoss />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounting/balance-sheet"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'accountant']}>
              <BalanceSheet />
            </ProtectedRoute>
          }
        />

        {/* Inventory */}
        <Route path="/inventory" element={<InventoryPage />} />

        {/* Sales */}
        <Route
          path="/sales"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'accountant', 'store_manager', 'sales_officer']}>
              <SalesPage />
            </ProtectedRoute>
          }
        />
        {/* Expenses */}
        <Route
          path="/expenses"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'accountant', 'store_manager']}>
              <ExpensesPage />
            </ProtectedRoute>
          }
        />

        {/* Suppliers */}
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'accountant', 'store_manager']}>
              <SuppliersPage />
            </ProtectedRoute>
          }
        />

        {/* Reports */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'accountant', 'store_manager', 'sales_officer', 'viewer']}>
              <ReportsPage />
            </ProtectedRoute>
          }
        />

      </Route>

      {/* Redirects */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function UnauthorizedPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      background: 'var(--color-bg-primary)',
    }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent-red)', fontSize: '2rem' }}>
        403
      </h2>
      <p style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>Access Denied</p>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
        You don&apos;t have permission to view this page.
      </p>
    </div>
  );
}
