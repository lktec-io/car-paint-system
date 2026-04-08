import useAuthStore from '../stores/authStore';
import api from '../api/axios';

export default function useAuth() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const authReady = useAuthStore((s) => s.authReady);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch (_) {
      // Server-side logout is best-effort; always clear client state
    }
    clearAuth();
  }

  function hasRole(...roles) {
    return user ? roles.includes(user.role) : false;
  }

  return { user, token, authReady, logout, hasRole };
}
