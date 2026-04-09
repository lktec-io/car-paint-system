import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ToastContainer from '../common/ToastContainer';
import InstallPrompt from '../common/InstallPrompt';
import useUiStore from '../../stores/uiStore';
import '../../styles/AppLayout.css';

export default function AppLayout() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);

  return (
    <div className={`app-layout${!sidebarOpen ? ' app-layout--collapsed' : ''}`}>
      <Sidebar />
      <div className="app-content">
        <TopBar />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <ToastContainer />
      <InstallPrompt />
    </div>
  );
}
