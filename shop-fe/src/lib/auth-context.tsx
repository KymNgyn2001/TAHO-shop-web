// src/lib/auth-context.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api, getStoredUser, getToken, type AuthUser } from './api-client';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function hydrate() {
      const cached = getStoredUser();
      if (cached) setUser(cached);
      if (!getToken()) {
        setLoading(false);
        return;
      }
      api.me()
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    }
    hydrate();
  }, []);

  async function login(email: string, password: string) {
    const auth = await api.login({ email, password });
    setUser(auth.user);
  }

  async function register(name: string, email: string, password: string, phone?: string) {
    const auth = await api.register({ name, email, password, phone });
    setUser(auth.user);
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phai dung ben trong <AuthProvider>.');
  return ctx;
}

export function roleLabel(role: AuthUser['role']): string {
  if (role === 'MANAGER') return 'Quản lý';
  if (role === 'EMPLOYEE') return 'Nhân viên';
  return 'Khách hàng';
}

/** Nhan vien/quan ly khong dung chuc nang mua hang/gio hang. */
export function isStaffRole(role: AuthUser['role'] | undefined): boolean {
  return role === 'EMPLOYEE' || role === 'MANAGER';
}
