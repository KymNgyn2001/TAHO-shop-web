// src/lib/require-role.ts
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';
import type { Role } from './api-client';

/** Dieu huong ve /login neu chua dang nhap hoac sai role. Dat o dau moi trang quan tri. */
export function useRequireRole(roles: Role[]) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !roles.includes(user.role)) router.replace('/login');
  }, [user, loading, roles, router]);

  return { user, ready: !loading && !!user && roles.includes(user.role) };
}
