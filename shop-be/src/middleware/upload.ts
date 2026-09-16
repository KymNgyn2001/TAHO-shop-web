import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { env } from '../lib/env';
import { getRequestBaseUrl } from '../lib/requestContext';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const now = new Date();
    const dir = path.join(env.uploadDir, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      cb(new Error('UNSUPPORTED_TYPE'));
      return;
    }
    cb(null, true);
  },
});

/**
 * URL day du de FE preview ngay sau khi upload — dung host cua chinh request hien tai
 * (getRequestBaseUrl) nen luon dung du dang truy cap qua wifi/IP nao. Luu y: cho nay
 * chi phuc vu preview tuc thoi, khi luu vao DB (products.routes.ts) URL se duoc rut
 * gon lai thanh duong dan tuong doi qua toRelativePath() de khong bi "dinh cung" vao
 * mang tai thoi diem upload.
 */
export function publicUrlFor(filePath: string): string {
  const relative = `/${path.relative('.', filePath).split(path.sep).join('/')}`;
  const base = getRequestBaseUrl() ?? env.publicBaseUrl;
  return `${base}${relative}`;
}
