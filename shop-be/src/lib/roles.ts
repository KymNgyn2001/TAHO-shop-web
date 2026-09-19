import { Role } from '@prisma/client';

/** Nhan vien, quan ly, admin — deu la "phia shop", khong dung chuc nang mua hang. */
export const STAFF_ROLES: Role[] = ['EMPLOYEE', 'MANAGER', 'ADMIN'];
/** Xem thong ke, quan ly nhan vien. Admin la cap tren manager nen luon gom ca admin. */
export const MANAGER_ROLES: Role[] = ['MANAGER', 'ADMIN'];

export function isStaff(role: string | undefined): boolean {
  return role === 'EMPLOYEE' || role === 'MANAGER' || role === 'ADMIN';
}

export function isManagerRole(role: string | undefined): boolean {
  return role === 'MANAGER' || role === 'ADMIN';
}
