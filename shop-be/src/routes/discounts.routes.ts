import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler';
import { evaluateDiscountCode } from '../lib/discount';

export const discountsRouter = Router();

const validateSchema = z.object({ code: z.string().min(1), subtotal: z.number().int().min(0) });

discountsRouter.post(
  '/discounts/validate',
  asyncHandler(async (req, res) => {
    const body = validateSchema.parse(req.body);
    const result = await evaluateDiscountCode(body.code, body.subtotal);
    res.json({
      code: body.code.trim().toUpperCase(),
      valid: result.valid,
      discountAmount: result.discountAmount,
      message: result.message,
    });
  }),
);
