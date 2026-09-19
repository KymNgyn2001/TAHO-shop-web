import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { requireRole } from '../middleware/auth';
import { MANAGER_ROLES } from '../lib/roles';
import { mailStatus, sendTestEmail } from '../lib/mailer';

export const diagnosticsRouter = Router();

/** Kiem tra he thong gui mail — chi manager/admin, khong lo mat khau. */
diagnosticsRouter.get('/admin/email-status', requireRole(...MANAGER_ROLES), (_req, res) => {
  res.json(mailStatus());
});

diagnosticsRouter.post(
  '/admin/email-test',
  requireRole(...MANAGER_ROLES),
  asyncHandler(async (req, res) => {
    const { to } = z.object({ to: z.string().email('Email khong hop le.') }).parse(req.body);
    res.json(await sendTestEmail(to));
  }),
);
