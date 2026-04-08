import { create } from 'zustand';

// Apply saved theme to <body> immediately (before React renders)
// so there's no flash of wrong theme on hard refresh
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
  document.body.setAttribute('data-theme', 'light');
}

let toastIdCounter = 0;

const useUiStore = create((set, get) => ({
  sidebarOpen: true,
  theme: savedTheme,
  toasts: [],

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    // Swap CSS variables by toggling the data-theme attribute on body
    document.body.setAttribute('data-theme', next === 'light' ? 'light' : '');
    set({ theme: next });
  },

  /**
   * Push a toast notification.
   * @param {{ type: 'success'|'error'|'warning'|'info', message: string, duration?: number }} toast
   */
  addToast: (toast) => {
    const id = ++toastIdCounter;
    const duration = toast.duration || 4000;

    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));

    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export default useUiStore;
