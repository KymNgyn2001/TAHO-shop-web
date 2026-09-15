import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { toShippingMethod } from '../lib/mappers';

export const shippingRouter = Router();

shippingRouter.get(
  '/shipping-methods',
  asyncHandler(async (_req, res) => {
    const methods = await prisma.shippingMethod.findMany({ where: { active: true }, orderBy: { fee: 'asc' } });
    res.json(methods.map(toShippingMethod));
  }),
);
