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
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024,
  // Gui mail xac nhan don hang qua Gmail SMTP — de trong thi bo qua gui mail
  // (khong lam sap don hang), chi log canh bao. Xem README de biet cach lay App Password.
  emailUser: process.env.EMAIL_USER ?? '',
  emailAppPassword: process.env.EMAIL_APP_PASSWORD ?? '',
};
