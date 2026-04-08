import axios from 'axios';
import useAuthStore from '../stores/authStore';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send httpOnly cookies on every request
});

// ── Request interceptor: attach access token ─────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: silent token refresh on 401 ────────────────────────
// Multiple concurrent requests that 401 simultaneously are queued.
// Only one refresh attempt fires; all queued requests retry with the new token.
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve(token)));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    const is401 = error.response?.status === 401;
    // Avoid retrying the refresh endpoint itself to prevent infinite loops
    const isRefreshEndpoint = original.url?.includes('/auth/refresh');

    if (is401 && !original._retry && !isRefreshEndpoint) {
      if (isRefreshing) {
        // Queue this request to retry once refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });

        const { accessToken, user } = data.data;
        useAuthStore.getState().setAuth(user, accessToken);

        processQueue(null, accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Refresh failed — clear auth state, let ProtectedRoute redirect to /login
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
