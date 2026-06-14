import axios from "axios";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import { authApi } from "@/api/client";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  finishOAuthLogin: (token: string, user?: User) => Promise<void>;
  updateSettings: (data: Record<string, unknown>) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const data = await authApi.login(email, password);
          localStorage.setItem("access_token", data.access_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          set({ accessToken: data.access_token, user: data.user, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      register: async (email, username, password) => {
        set({ isLoading: true });
        try {
          const data = await authApi.register(email, username, password);
          localStorage.setItem("access_token", data.access_token);
          set({ accessToken: data.access_token, user: data.user, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, accessToken: null });
      },

      fetchMe: async () => {
        const token = localStorage.getItem("access_token");
        if (!token) return;
        try {
          const user = await authApi.me();
          set({ user, accessToken: token });
        } catch (err) {
          if (axios.isAxiosError(err) && err.response?.status === 401) {
            localStorage.removeItem("access_token");
            set({ user: null, accessToken: null });
            return;
          }
          set({ accessToken: token });
        }
      },

      finishOAuthLogin: async (token, user) => {
        localStorage.setItem("access_token", token);
        set({ accessToken: token, user: user ?? null });
        if (!user) {
          await get().fetchMe();
        }
      },

      updateSettings: async (data) => {
        await authApi.updateSettings(data);
        await get().fetchMe();
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ accessToken: state.accessToken }),
    }
  )
);
