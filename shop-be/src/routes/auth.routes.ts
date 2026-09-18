import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { ApiError, Errors } from '../lib/apiError';
import { hashPassword, signToken, verifyPassword } from '../lib/auth';
import { toAuthUser } from '../lib/mappers';
import { requireAuth } from '../middleware/auth';
import { sendPasswordResetEmail } from '../lib/mailer';
import { env } from '../lib/env';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1, 'Ten khong duoc de trong.'),
  email: z.string().email('Email khong hop le.'),
  password: z.string().min(6, 'Mat khau phai co it nhat 6 ky tu.'),
  phone: z.string().optional(),
});

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw Errors.conflict('EMAIL_EXISTS', 'Email nay da duoc dang ky.');

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        passwordHash: await hashPassword(body.password),
        role: 'CUSTOMER',
      },
    });

    const token = signToken({ sub: user.id, role: user.role });
    res.status(201).json({ token, user: toAuthUser(user) });
  }),
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !user.active || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email hoac mat khau khong dung.');
    }
    const token = signToken({ sub: user.id, role: user.role });
    res.json({ token, user: toAuthUser(user) });
  }),
);

authRouter.post('/logout', (_req, res) => {
  // JWT la stateless: FE chi can xoa token da luu. Endpoint giu de doi xung API.
  res.status(204).send();
});

const forgotPasswordSchema = z.object({ email: z.string().email('Email khong hop le.') });

authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const body = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    // Luon tra ve cung 1 thong bao du email co ton tai hay khong — tranh lo email
    // nao da dang ky trong he thong.
    const genericMessage = 'Neu email nay ton tai trong he thong, minh da gui link dat lai mat khau roi.';

    if (user && user.active) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const resetUrl = `${env.frontendUrl}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }

    res.json({ message: genericMessage });
  }),
);

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Thieu token.'),
  newPassword: z.string().min(6, 'Mat khau phai co it nhat 6 ky tu.'),
});

authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const body = resetPasswordSchema.parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(body.token).digest('hex');
    const user = await prisma.user.findFirst({
      where: { resetTokenHash: tokenHash, resetTokenExpiresAt: { gt: new Date() } },
    });
    if (!user) {
      throw Errors.validation('Link dat lai mat khau khong hop le hoac da het han.', 'token');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(body.newPassword),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    res.json({ message: 'Da dat lai mat khau. Ban dang nhap lai voi mat khau moi nhe.' });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw Errors.notFound();
    res.json(toAuthUser(user));
  }),
);
