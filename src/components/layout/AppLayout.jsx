import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ToastContainer from '../common/ToastContainer';
import InstallPrompt from '../common/InstallPrompt';
import useUiStore from '../../stores/uiStore';
import useAuth from '../../hooks/useAuth';
import '../../styles/AppLayout.css';

export default function AppLayout() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await logout();
    // ProtectedRoute redirects to /login automatically when user is cleared
  };

  return (
    <div className={`app-layout${!sidebarOpen ? ' app-layout--collapsed' : ''}`}>
      <Sidebar />
      <div className="app-content">
        <TopBar onLogout={handleLogout} />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
      <InstallPrompt />
      {loggingOut && <div className="logout-overlay" />}
    </div>
  );
}
