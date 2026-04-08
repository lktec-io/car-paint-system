import { create } from 'zustand';

/**
 * Auth store — access token lives in memory only (never localStorage).
 * Refresh token lives in an httpOnly cookie managed by the server.
 *
 * authReady: false until the initial silent-refresh attempt completes.
 * App renders a spinner while authReady is false to prevent flash-of-wrong-content.
 */
const useAuthStore = create((set) => ({
  user: null,
  token: null,
  authReady: false,

  setAuth: (user, token) => set({ user, token }),

  clearAuth: () => set({ user: null, token: null }),

  setAuthReady: () => set({ authReady: true }),

  /**
   * Called once on App mount.
   * Attempts a silent token refresh using the httpOnly cookie.
   * Sets authReady=true regardless of outcome so the app can render.
   */
  initialize: async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          set({ user: data.data.user, token: data.data.accessToken, authReady: true });
          return;
        }
      }
    } catch (_) {
      // Network error or no cookie — treat as unauthenticated
    }
    set({ authReady: true });
  },
}));

export default useAuthStore;
