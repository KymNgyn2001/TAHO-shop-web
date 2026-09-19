import { Router } from 'express';
import { ApiError } from '../lib/apiError';
import { requireRole } from '../middleware/auth';
import { STAFF_ROLES } from '../lib/roles';
import { upload, saveLocalUpload } from '../middleware/upload';
import { uploadToR2, r2Enabled } from '../lib/r2';

export const uploadsRouter = Router();

uploadsRouter.post(
  '/admin/uploads',
  requireRole(...STAFF_ROLES),
  (req, res, next) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof Error && err.message === 'UNSUPPORTED_TYPE') {
          return next(new ApiError(415, 'UNSUPPORTED_TYPE', 'Dinh dang anh khong duoc ho tro.'));
        }
        if (err instanceof Error && err.name === 'MulterError' && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
          return next(new ApiError(413, 'FILE_TOO_LARGE', 'Anh vuot qua 10MB.'));
        }
        return next(err);
      }
      next();
    });
  },
  async (req, res, next) => {
    if (!req.file) return next(new ApiError(400, 'VALIDATION_FAILED', 'Thieu file anh.'));
    try {
      const url = r2Enabled
        ? await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype)
        : saveLocalUpload(req.file);
      res.json({ url, fileName: req.file.originalname, sizeBytes: req.file.size });
    } catch (err) {
      // R2 hong/timeout — bao de thu lai thay vi 'loi he thong' chung chung.
      console.error('[upload] Luu anh that bai:', err);
      next(new ApiError(502, 'UPLOAD_FAILED', 'Không lưu được ảnh, bạn thử lại sau ít giây nhé.'));
    }
  },
);
