// Cung noi dung voi shop-fe/src/lib/bankQr.ts — giu dong bo neu doi tai khoan.
// Dung rieng cho email xac nhan don hang (checkout page ben FE tu ve QR rieng).

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
