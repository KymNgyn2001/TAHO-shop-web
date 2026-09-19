import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { ApiError } from '../lib/apiError';
import { viMessage } from '../lib/messages';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ code: 'NOT_FOUND', message: viMessage('Khong tim thay duong dan nay.') });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ code: err.code, message: viMessage(err.message), field: err.field });
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({
      code: 'VALIDATION_FAILED',
      message: viMessage(first?.message ?? 'Du lieu khong hop le.'),
      field: first?.path?.join('.'),
    });
  }

  // Loi doc body (JSON hong, qua lon) do express.json() nem ra.
  const httpErr = err as { type?: string; status?: number };
  if (httpErr?.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 'BAD_REQUEST', message: 'Dữ liệu gửi lên không đúng định dạng.' });
  }
  if (httpErr?.type === 'entity.too.large') {
    return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: 'Dữ liệu gửi lên quá lớn.' });
  }

  // Loi DB thuong gap — tra thong bao de hieu thay vi "loi he thong" chung chung.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ code: 'ALREADY_EXISTS', message: 'Thông tin này đã tồn tại, bạn kiểm tra lại nhé.' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Không tìm thấy dữ liệu cần thao tác.' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ code: 'IN_USE', message: 'Dữ liệu này đang được dùng ở nơi khác nên chưa thao tác được.' });
    }
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(err);
    return res.status(503).json({ code: 'DB_UNAVAILABLE', message: 'Hệ thống đang bận, bạn thử lại sau ít phút nhé.' });
  }

  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: viMessage('Loi he thong. Vui long thu lai sau.') });
}
