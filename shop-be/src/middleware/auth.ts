import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { verifyToken } from '../lib/auth';
import { Errors } from '../lib/apiError';
import { prisma } from '../lib/prisma';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: Role;
      sessionId?: string;
    }
  }
}

/** Doc token/session-id neu co, khong bat buoc dang nhap. */
export function identify(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('Authorization');
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(header.slice('Bearer '.length));
      req.userId = payload.sub;
      req.userRole = payload.role;
    } catch {
      // token het han/khong hop le -> coi nhu khach vang lai
    }
  }
  const sid = req.header('X-Session-Id');
  if (sid) req.sessionId = sid;
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.userId) return next(Errors.unauthorized());
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userId || !req.userRole) return next(Errors.unauthorized());
    if (!roles.includes(req.userRole)) return next(Errors.forbidden());
    next();
  };
}

export async function currentUser(req: Request) {
  if (!req.userId) return null;
  return prisma.user.findUnique({ where: { id: req.userId } });
}
