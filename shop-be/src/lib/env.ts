import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thieu bien moi truong ${name}`);
  return v;
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8080}`).replace(/\/$/, ''),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024,
  // Gui mail xac nhan don hang qua Gmail SMTP — de trong thi bo qua gui mail
  // (khong lam sap don hang), chi log canh bao. Xem README de biet cach lay App Password.
  emailUser: process.env.EMAIL_USER ?? '',
  emailAppPassword: process.env.EMAIL_APP_PASSWORD ?? '',
  // Cloudflare R2 (luu anh san pham) — de trong thi fallback ve dia cuc bo (chi dung
  // cho dev, vi disk cua Render se bi xoa moi lan deploy lai).
  r2AccountId: process.env.R2_ACCOUNT_ID ?? '',
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  r2Bucket: process.env.R2_BUCKET_NAME ?? '',
  r2PublicUrl: (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, ''),
  // URL cua chinh FE/BE khi da len production — dung de dung sinh redirectUrl/ipnUrl
  // cho MoMo (khong the tu suy tu request nhu cac cho khac, vi MoMo tu server ho goi
  // thang vao, khong phai trinh duyet cua khach).
  frontendUrl: (process.env.FRONTEND_URL ?? 'https://taho-shop-web.vercel.app').replace(/\/$/, ''),
  backendPublicUrl: (process.env.BACKEND_PUBLIC_URL ?? 'https://taho-shop-web-aehw.onrender.com').replace(/\/$/, ''),
  // MoMo (vi dien tu) — mac dinh la bo tai khoan TEST dung chung MoMo cong khai trong
  // tai lieu cho nha phat trien thu nghiem (khong can dang ky). Neu muon dung tai
  // khoan sandbox rieng, dang ky mien phi tai business.momo.vn roi ghi de 3 bien nay.
  momoPartnerCode: process.env.MOMO_PARTNER_CODE ?? 'MOMO',
  momoAccessKey: process.env.MOMO_ACCESS_KEY ?? 'F8BBA842ECF85',
  momoSecretKey: process.env.MOMO_SECRET_KEY ?? 'K951B6PE1waDMi640xX08PD3vg6EkVlz',
  momoEndpoint: process.env.MOMO_ENDPOINT ?? 'https://test-payment.momo.vn/v2/gateway/api/create',
  // PayOS (chuyen khoan ngan hang, tu dong xac nhan qua webhook) — khac MoMo, PayOS
  // khong co bo tai khoan test cong khai, phai tu dang ky mien phi tai payos.vn.
  // De trong thi "Chuyen khoan ngan hang" fallback ve VietQR + nhan vien tu xac nhan
  // tay nhu truoc, khong lam hong tinh nang cu.
  payosClientId: process.env.PAYOS_CLIENT_ID ?? '',
  payosApiKey: process.env.PAYOS_API_KEY ?? '',
  payosChecksumKey: process.env.PAYOS_CHECKSUM_KEY ?? '',
};
