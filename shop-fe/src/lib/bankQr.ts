// src/lib/bankQr.ts
// Ve anh QR tu chuoi VietQR goc ma PayOS tra ve (order.payQrData). Ma nay gan voi tai khoan
// ngan hang lien ket trong PayOS — so tai khoan KHONG luu trong code/repo.
export function payosQrImageUrl(rawQrData: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(rawQrData)}`;
}
