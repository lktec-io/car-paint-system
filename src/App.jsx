import { useEffect } from 'react';
import useAuthStore from './stores/authStore';
import AppRoutes from './routes/AppRoutes';

/**
 * App — root component.
 * Fires the silent token-refresh attempt on mount (authReady pattern).
 * Renders a full-screen spinner until authReady is true to prevent
 * a flash where ProtectedRoute sees user=null before the cookie is checked.
 */
export default function App() {
  const { authReady, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authReady) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
      </div>
    );
  }

  return <AppRoutes />;
}
