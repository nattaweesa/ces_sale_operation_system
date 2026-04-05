import { create } from "zustand";

interface AuthUser {
  user_id: number;
  username: string;
  full_name: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    try {
      const raw = localStorage.getItem("auth_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })(),
  token: localStorage.getItem("access_token"),
  setAuth: (token, user) => {
    localStorage.setItem("access_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
    set({ token: null, user: null });
  },
}));
