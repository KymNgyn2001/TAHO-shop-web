import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { env } from '../lib/env';
import { getRequestBaseUrl } from '../lib/requestContext';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

// memoryStorage — file nam trong RAM (req.file.buffer) de co the day thang len
// Cloudflare R2; khong con ghi dia truoc nhu cu (dia cua Render bi xoa moi lan deploy).
export const upload = multer({
  storage: multer.memoryStorage(),
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
 * Fallback luu dia cuc bo — chi dung khi chua cau hinh R2 (VD dev local). Tren
 * Render thi KHONG nen dung duong nay vi dia se bi xoa trang moi lan deploy lai.
 */
export function saveLocalUpload(file: Express.Multer.File): string {
  const now = new Date();
  const dir = path.join(env.uploadDir, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(file.originalname) || '.jpg';
  const fileName = `${crypto.randomBytes(12).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(dir, fileName), file.buffer);

  const relative = `/${env.uploadDir}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${fileName}`;
  const base = getRequestBaseUrl() ?? env.publicBaseUrl;
  return `${base}${relative}`;
}
