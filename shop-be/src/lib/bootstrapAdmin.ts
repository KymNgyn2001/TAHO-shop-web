import { prisma } from './prisma';
import { env } from './env';
import { hashPassword } from './auth';

/**
 * Tao tai khoan ADMIN dau tien tu ADMIN_EMAIL/ADMIN_PASSWORD (bien moi truong) —
 * khong hardcode mat khau trong code. Neu email da ton tai thi chi nang vai tro len
 * ADMIN, khong dong vao mat khau hien tai. Khong lam sap server neu loi.
 */
export async function bootstrapAdmin(): Promise<void> {
  if (!env.adminEmail || !env.adminPassword) return;
  try {
    const existing = await prisma.user.findUnique({ where: { email: env.adminEmail } });
    if (!existing) {
      await prisma.user.create({
        data: {
          name: 'Quan tri vien',
          email: env.adminEmail,
          passwordHash: await hashPassword(env.adminPassword),
          role: 'ADMIN',
        },
      });
      console.log(`[admin] Da tao tai khoan admin ${env.adminEmail}`);
    } else if (existing.role !== 'ADMIN' || existing.deletedAt || !existing.active) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN', deletedAt: null, active: true },
      });
      console.log(`[admin] Da nang ${env.adminEmail} len admin`);
    }
  } catch (e) {
    console.error('[admin] Khong tao duoc tai khoan admin:', e);
  }
}
