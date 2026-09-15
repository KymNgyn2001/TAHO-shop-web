import { DiscountCode } from '@prisma/client';
import { prisma } from './prisma';

export interface DiscountEvalResult {
  code: DiscountCode | null;
  discountAmount: number;
  valid: boolean;
  message: string;
}

export async function evaluateDiscountCode(rawCode: string, subtotal: number): Promise<DiscountEvalResult> {
  const code = await prisma.discountCode.findUnique({ where: { code: rawCode.trim().toUpperCase() } });
  if (!code || !code.active) {
    return { code: null, discountAmount: 0, valid: false, message: 'Ma giam gia khong ton tai.' };
  }
  if (code.expiresAt && code.expiresAt.getTime() < Date.now()) {
    return { code: null, discountAmount: 0, valid: false, message: 'Ma giam gia da het han.' };
  }
  if (code.maxUses !== null && code.usedCount >= code.maxUses) {
    return { code: null, discountAmount: 0, valid: false, message: 'Ma giam gia da het luot su dung.' };
  }
  if (subtotal < code.minOrderAmount) {
    return {
      code: null,
      discountAmount: 0,
      valid: false,
      message: `Don hang can toi thieu ${code.minOrderAmount.toLocaleString('vi-VN')}d de dung ma nay.`,
    };
  }
  const amount = code.type === 'PERCENT' ? Math.round((subtotal * code.value) / 100) : code.value;
  return { code, discountAmount: Math.min(amount, subtotal), valid: true, message: 'Ap dung ma giam gia thanh cong.' };
}
