import { create } from 'zustand';
import api, { setAccessToken } from '@/services/api-client';
import type { Role } from '@shared/constants/enums';
import { isSuperAdminOptIn } from '@/lib/permission-constants';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  teamId: string | null;
  sipExtension: string | null;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
  setUser: (user: User) => void;
  hasPermission: (key: string) => boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,

  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.data.accessToken);
    const { data: meData } = await api.get('/auth/me');
    set({ user: meData.data, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore logout errors
    }
    setAccessToken(null);
    set({ user: null, isAuthenticated: false });
  },

  bootstrap: async () => {
    try {
      const { data } = await api.post('/auth/refresh');
      setAccessToken(data.data.accessToken);
      const { data: meData } = await api.get('/auth/me');
      set({ user: meData.data, isAuthenticated: true, isBootstrapping: false });
    } catch {
      set({ user: null, isAuthenticated: false, isBootstrapping: false });
    }
  },

  setUser: (user: User) => set({ user }),

  hasPermission: (key: string): boolean => {
    const { user } = useAuthStore.getState();
    if (!user) return false;
    // super_admin auto-passes everything except opt-in destructive keys
    // (e.g. recording.delete) which require an explicit grant.
    if ((user.role as string) === 'super_admin' && !isSuperAdminOptIn(key)) return true;
    return user.permissions?.includes(key) ?? false;
  },
}));
