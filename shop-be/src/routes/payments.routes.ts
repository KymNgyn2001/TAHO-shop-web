import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { verifyMomoIpnSignature } from '../lib/momo';
import { getPayOSPaymentInfo, verifyPayOSWebhook } from '../lib/payos';
import { recordPayment } from '../lib/payments';

export const paymentsRouter = Router();

/**
 * MoMo goi thang vao day (server-to-server) sau khi khach thanh toan xong tren
 * trang MoMo — khong qua trinh duyet khach nen khong co cookie/token, chi tin
 * duoc nho kiem tra chu ky. Luon tra loi nhanh (MoMo se retry neu khong nhan
 * duoc phan hoi hop le trong thoi gian ngan).
 */
paymentsRouter.post(
  '/payments/momo/ipn',
  asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;

    if (!verifyMomoIpnSignature(body)) {
      return res.status(400).json({ resultCode: 1, message: 'Invalid signature' });
    }

    const orderCode = String(body.orderId ?? '');
    const resultCode = Number(body.resultCode);
    const amount = Number(body.amount);
    const order = await prisma.order.findUnique({ where: { code: orderCode } });

    if (order && order.paymentMethod === 'MOMO' && resultCode === 0 && Number.isFinite(amount)) {
      // recordPayment chi xac nhan khi so tien >= tong don, khong tin resultCode mot minh.
      await recordPayment(order, amount);
    }

    res.status(200).json({ resultCode: 0, message: 'Confirm Success' });
  }),
);

/**
 * PayOS goi thang vao day (server-to-server) khi nhan duoc chuyen khoan khop voi
 * link thanh toan da tao — dung de tu dong xac nhan don "Chuyen khoan ngan hang"
 * thay vi phai cho nhan vien tu kiem tra sao ke roi bam tay nhu truoc.
 */
paymentsRouter.post(
  '/payments/payos/webhook',
  asyncHandler(async (req, res) => {
    const data = await verifyPayOSWebhook(req.body);
    if (data && data.code === '00') {
      const order = await prisma.order.findUnique({ where: { id: data.orderCode } });
      if (order && order.paymentMethod === 'BANK_TRANSFER') {
        // Hoi lai PayOS tong da nhan (khach co the chuyen nhieu lan); neu PayOS khong tra
        // loi thi chi tin giao dich vua bao — khong bao gio cong don de tranh xac nhan nham.
        const info = await getPayOSPaymentInfo(data.orderCode);
        const paidTotal = Math.max(info?.amountPaid ?? 0, data.amount, order.paidAmount ?? 0);
        await recordPayment(order, paidTotal);
      }
    }
    // PayOS cung goi mot request thu (khong khop don nao that) luc dang ky webhook —
    // van tra 200 binh thuong de qua trinh xac thuc URL thanh cong.
    res.status(200).json({ error: 0, message: 'success', data: null });
  }),
);
