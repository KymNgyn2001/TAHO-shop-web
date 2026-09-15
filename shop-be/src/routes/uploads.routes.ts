import { Router } from 'express';
import { ApiError } from '../lib/apiError';
import { requireRole } from '../middleware/auth';
import { upload, publicUrlFor } from '../middleware/upload';

export const uploadsRouter = Router();

uploadsRouter.post(
  '/admin/uploads',
  requireRole('EMPLOYEE', 'MANAGER'),
  (req, res, next) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof Error && err.message === 'UNSUPPORTED_TYPE') {
          return next(new ApiError(415, 'UNSUPPORTED_TYPE', 'Dinh dang anh khong duoc ho tro.'));
        }
        if (err instanceof Error && err.name === 'MulterError' && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
          return next(new ApiError(413, 'FILE_TOO_LARGE', 'Anh vuot qua 5MB.'));
        }
        return next(err);
      }
      next();
    });
  },
  (req, res, next) => {
    if (!req.file) return next(new ApiError(400, 'VALIDATION_FAILED', 'Thieu file anh.'));
    res.json({
      url: publicUrlFor(req.file.path),
      fileName: req.file.originalname,
      sizeBytes: req.file.size,
    });
  },
);
