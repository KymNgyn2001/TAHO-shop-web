import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../lib/apiError';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Khong tim thay duong dan nay.' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ code: err.code, message: err.message, field: err.field });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({
      code: 'VALIDATION_FAILED',
      message: first?.message ?? 'Du lieu khong hop le.',
      field: first?.path?.join('.'),
    });
  }
  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Loi he thong. Vui long thu lai sau.' });
}
