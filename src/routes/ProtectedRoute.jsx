import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../stores/authStore';

/**
 * Wraps authenticated routes.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string[]} [props.allowedRoles] - If provided, user must have one of these roles
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, authReady } = useAuthStore();
  const location = useLocation();

  // While initial token refresh is in flight, render nothing (App shows global spinner)
  if (!authReady) return null;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
