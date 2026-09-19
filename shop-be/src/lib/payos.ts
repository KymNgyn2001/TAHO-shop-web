import { PayOS } from '@payos/node';
import { env } from './env';

export const payosEnabled = Boolean(env.payosClientId && env.payosApiKey && env.payosChecksumKey);

const payos = payosEnabled
  ? new PayOS({ clientId: env.payosClientId, apiKey: env.payosApiKey, checksumKey: env.payosChecksumKey })
  : null;

if (payos) {
  // Dang ky/xac thuc webhook luc khoi dong — goi lai nhieu lan van an toan, PayOS
  // chi kiem tra lai URL con phan hoi hop le khong. Khong await, khong duoc lam
  // cham/lam sap qua trinh khoi dong server.
  payos.webhooks.confirm(`${env.backendPublicUrl}/api/payments/payos/webhook`).catch((e) => {
    // eslint-disable-next-line no-console
    console.warn('[payos] Khong dang ky duoc webhook:', e instanceof Error ? e.message : e);
  });
}

if (!payosEnabled) {
  // eslint-disable-next-line no-console
  console.warn('[payos] Thieu PAYOS_CLIENT_ID/PAYOS_API_KEY/PAYOS_CHECKSUM_KEY — "Chuyen khoan ngan hang" van dung VietQR + xac nhan tay nhu cu.');
}

export interface PayOSPaymentResult {
  checkoutUrl: string;
  qrCode: string;
}

/**
 * Tao link thanh toan PayOS cho don chuyen khoan — orderCode cua PayOS phai la so
 * nguyen duy nhat nen dung luon order.id (khac voi order.code dang la chuoi).
 */
export async function createPayOSPayment(params: {
  orderId: number;
  orderCode: string;
  amount: number;
}): Promise<PayOSPaymentResult> {
  if (!payos) throw new Error('PAYOS_NOT_CONFIGURED');
  const link = await payos.paymentRequests.create({
    orderCode: params.orderId,
    amount: params.amount,
    description: params.orderCode,
    cancelUrl: `${env.frontendUrl}/orders/${params.orderCode}`,
    returnUrl: `${env.frontendUrl}/orders/${params.orderCode}`,
  });
  return { checkoutUrl: link.checkoutUrl, qrCode: link.qrCode };
}

export async function verifyPayOSWebhook(
  body: unknown,
): Promise<{ orderCode: number; code: string; amount: number } | null> {
  if (!payos) return null;
  try {
    const data = await payos.webhooks.verify(body as Parameters<typeof payos.webhooks.verify>[0]);
    return { orderCode: data.orderCode, code: data.code, amount: data.amount };
  } catch {
    return null;
  }
}

/**
 * Hoi PayOS tong so tien da nhan cua 1 link thanh toan — webhook chi bao 1 giao dich,
 * ma khach co the chuyen nhieu lan (thieu roi bu them), nen PayOS moi la nguon dung.
 */
export async function getPayOSPaymentInfo(orderCode: number): Promise<{ status: string; amountPaid: number } | null> {
  if (!payos) return null;
  try {
    const link = await payos.paymentRequests.get(orderCode);
    return { status: link.status, amountPaid: link.amountPaid };
  } catch {
    return null;
  }
}

/** Huy link khi don bi huy — khach khong the chuyen tien vao don da huy nua. Best-effort. */
export async function cancelPayOSPayment(orderCode: number, reason: string): Promise<void> {
  if (!payos) return;
  try {
    await payos.paymentRequests.cancel(orderCode, reason);
  } catch {
    // Link da het han/da huy/da thanh toan — khong sao.
  }
}