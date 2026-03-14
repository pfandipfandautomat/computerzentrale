import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthStore {
  isAuthenticated: boolean;
  isLoading: boolean;
  authRequired: boolean | null;
  token: string | null;
  
  setAuthenticated: (authenticated: boolean) => void;
  setToken: (token: string | null) => void;
  setAuthRequired: (required: boolean) => void;
  setLoading: (loading: boolean) => void;
  
  checkAuthStatus: () => Promise<void>;
  login: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const API_BASE = '/api';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      isLoading: true,
      authRequired: null,
      token: null,

      setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
      setToken: (token) => set({ token }),
      setAuthRequired: (required) => set({ authRequired: required }),
      setLoading: (loading) => set({ isLoading: loading }),

      checkAuthStatus: async () => {
        set({ isLoading: true });
        try {
          // First check if auth is required
          const statusRes = await fetch(`${API_BASE}/auth/status`);
          const statusData = await statusRes.json();
          
          set({ authRequired: statusData.required });
          
          if (!statusData.required) {
            set({ isAuthenticated: true, isLoading: false });
            return;
          }

          // If auth is required, verify current session
          const token = get().token;
          const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: 'include',
          });

          if (verifyRes.ok) {
            set({ isAuthenticated: true });
          } else {
            set({ isAuthenticated: false, token: null });
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          set({ isAuthenticated: false });
        } finally {
          set({ isLoading: false });
        }
      },

      login: async (password: string) => {
        try {
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
            credentials: 'include',
          });

          const data = await res.json();

          if (res.ok && data.success) {
            set({ isAuthenticated: true, token: data.token });
            return { success: true };
          } else {
            return { success: false, error: data.error || 'Login failed' };
          }
        } catch (error) {
          console.error('Login failed:', error);
          return { success: false, error: 'Network error' };
        }
      },

      logout: async () => {
        try {
          await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout failed:', error);
        } finally {
          set({ isAuthenticated: false, token: null });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
