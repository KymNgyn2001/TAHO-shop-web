import crypto from 'crypto';
import { env } from './env';

function sign(raw: string): string {
  return crypto.createHmac('sha256', env.momoSecretKey).update(raw).digest('hex');
}

export interface MomoPaymentResult {
  payUrl: string | null;
  resultCode: number;
  message: string;
}

/**
 * Tao yeu cau thanh toan MoMo (captureWallet, redirect toi trang MoMo) — orderId
 * dung luon ma don hang cua minh (da la duy nhat) de khoi phai luu them bang tra cuu.
 * Xem tai lieu: https://developers.momo.vn/v3/vi/docs/payment/api/wallet/onetime
 */
export async function createMomoPayment(params: {
  orderCode: string;
  amount: number;
  orderInfo: string;
}): Promise<MomoPaymentResult> {
  const requestId = `${params.orderCode}-${Date.now()}`;
  const redirectUrl = `${env.frontendUrl}/orders/${params.orderCode}`;
  const ipnUrl = `${env.backendPublicUrl}/api/payments/momo/ipn`;
  const requestType = 'captureWallet';
  const extraData = '';

  const rawSignature =
    `accessKey=${env.momoAccessKey}&amount=${params.amount}&extraData=${extraData}` +
    `&ipnUrl=${ipnUrl}&orderId=${params.orderCode}&orderInfo=${params.orderInfo}` +
    `&partnerCode=${env.momoPartnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}` +
    `&requestType=${requestType}`;

  const body = {
    partnerCode: env.momoPartnerCode,
    partnerName: 'TAHO',
    storeId: 'TahoStore',
    requestId,
    amount: String(params.amount),
    orderId: params.orderCode,
    orderInfo: params.orderInfo,
    redirectUrl,
    ipnUrl,
    lang: 'vi',
    extraData,
    requestType,
    signature: sign(rawSignature),
  };

  const res = await fetch(env.momoEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { payUrl?: string; resultCode: number; message: string };
  return { payUrl: data.payUrl ?? null, resultCode: data.resultCode, message: data.message };
}

/**
 * Xac minh chu ky IPN MoMo gui ve — thu tu truong PHAI dung theo tai lieu, khong
 * duoc doi (chu ky tinh tren chuoi da sap xep san, khong phai tren JSON body).
 */
export function verifyMomoIpnSignature(body: Record<string, unknown>): boolean {
  const {
    partnerCode, orderId, requestId, amount, orderInfo, orderType,
    transId, resultCode, message, payType, responseTime, extraData, signature,
  } = body as Record<string, string | number>;

  const raw =
    `accessKey=${env.momoAccessKey}&amount=${amount}&extraData=${extraData ?? ''}` +
    `&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}` +
    `&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}` +
    `&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;

  return sign(raw) === signature;
}
