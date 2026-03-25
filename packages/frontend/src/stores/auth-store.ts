import { create } from 'zustand';
import api, { setAccessToken } from '@/services/api-client';
import type { Role } from '@shared/constants/enums';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  teamId: string | null;
  sipExtension: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  bootstrap: () => Promise<void>;
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
}));
