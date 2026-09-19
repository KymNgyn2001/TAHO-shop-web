import { Order } from '@prisma/client';
import { prisma } from './prisma';
import { sendPaymentShortfallEmail } from './mailer';

/**
 * Ghi nhan tong so tien da nhan cho don va tu dong xac nhan CHI KHI du tien.
 * - Thieu: giu PENDING, bao khach chuyen not (email) — truoc day webhook xac nhan luon
 *   bat ke so tien, nen khach chuyen 1.000d cung duoc coi la da tra du.
 * - Du/thua: xac nhan binh thuong, so du duoc luu o paidAmount de nhan vien hoan lai.
 * - Don da huy van ghi paidAmount (khach lo chuyen sau khi huy) de nhan vien hoan tien.
 */
export async function recordPayment(order: Order, paidTotal: number): Promise<void> {
  const fullyPaid = paidTotal >= order.totalAmount;
  const changed = paidTotal !== order.paidAmount;

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paidAmount: paidTotal,
      ...(fullyPaid && order.status === 'PENDING' ? { status: 'CONFIRMED' } : {}),
    },
  });

  if (!fullyPaid && changed && order.status === 'PENDING' && order.email) {
    void sendPaymentShortfallEmail(order.email, {
      code: order.code,
      paid: paidTotal,
      total: order.totalAmount,
      payUrl: order.payUrl,
    });
  }
}
