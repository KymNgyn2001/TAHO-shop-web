// src/lib/bankQr.ts
// QR VietQR (chuan Napas 247) — quet la ra thang app ngan hang, tu dien san so tien +
// noi dung. Dung dich vu anh mien phi cua img.vietqr.io, khong can dang ky/API key.

// CHO SUA SAU: doi lai neu TAHO doi tai khoan nhan tien.
const BANK_BIN = '970407'; // Techcombank
const ACCOUNT_NO = '5656066886';
const ACCOUNT_NAME = 'NGUYEN TRONG KIM';

/** content nen la ma don (VD "ORD-20260917-0001") de doi soat giao dich de hon. */
export function vietQrImageUrl(amount: number, content: string): string {
  const params = new URLSearchParams({
    amount: String(Math.round(amount)),
    addInfo: content,
    accountName: ACCOUNT_NAME,
  });
  return `https://img.vietqr.io/image/${BANK_BIN}-${ACCOUNT_NO}-compact2.png?${params.toString()}`;
}

export const bankInfo = {
  bankName: 'Techcombank',
  accountNo: ACCOUNT_NO,
  accountName: ACCOUNT_NAME,
};

/**
 * Ve lai anh QR tu chuoi VietQR goc ma PayOS tra ve (order.payQrData) — day la ma
 * that gan voi tai khoan ngan hang da lien ket trong PayOS, khac voi vietQrImageUrl()
 * o tren (chi la QR tinh set cung, dung khi CHUA cau hinh PayOS).
 */
export function payosQrImageUrl(rawQrData: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(rawQrData)}`;
}
