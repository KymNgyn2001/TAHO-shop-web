import { prisma } from './prisma';

export async function nextOrderCode(): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePart = `${y}${m}${d}`;
  const countToday = await prisma.order.count({
    where: { code: { startsWith: `ORD-${datePart}-` } },
  });
  const seq = String(countToday + 1).padStart(4, '0');
  return `ORD-${datePart}-${seq}`;
}
