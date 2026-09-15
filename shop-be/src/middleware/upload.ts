import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { env } from '../lib/env';

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
 * URL day du (vd http://192.168.1.93:8080/uploads/2026/09/abc.jpg) de FE hien thi
 * truc tiep bang <img>, khong phu thuoc FE dang chay o host/cong nao.
 */
export function publicUrlFor(filePath: string): string {
  const relative = `/${path.relative('.', filePath).split(path.sep).join('/')}`;
  return `${env.publicBaseUrl}${relative}`;
}
