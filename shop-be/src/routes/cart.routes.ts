import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { Errors } from '../lib/apiError';
import { loadCartPayload, resolveCart } from '../lib/cart';

export const cartRouter = Router();

cartRouter.get(
  '/cart',
  asyncHandler(async (req, res) => {
    const cart = await resolveCart(req);
    res.json(await loadCartPayload(cart.id));
  }),
);

const addSchema = z.object({ variantId: z.number().int().positive(), quantity: z.number().int().positive() });

cartRouter.post(
  '/cart/items',
  asyncHandler(async (req, res) => {
    const body = addSchema.parse(req.body);
    const cart = await resolveCart(req);
    const variant = await prisma.variant.findUnique({ where: { id: body.variantId } });
    if (!variant) throw Errors.notFound('Khong tim thay san pham.');

    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: body.variantId } },
    });
    const desiredQty = (existing?.quantity ?? 0) + body.quantity;
    if (variant.stockQty < desiredQty) {
      throw Errors.conflict('OUT_OF_STOCK', `Size ${variant.size} chi con ${variant.stockQty} san pham.`);
    }

    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: body.variantId } },
      update: { quantity: desiredQty },
      create: { cartId: cart.id, variantId: body.variantId, quantity: body.quantity },
    });

    res.json(await loadCartPayload(cart.id));
  }),
);

const updateSchema = z.object({ quantity: z.number().int().min(1) });

cartRouter.patch(
  '/cart/items/:itemId',
  asyncHandler(async (req, res) => {
    const body = updateSchema.parse(req.body);
    const cart = await resolveCart(req);
    const item = await prisma.cartItem.findFirst({
      where: { id: Number(req.params.itemId), cartId: cart.id },
      include: { variant: true },
    });
    if (!item) throw Errors.notFound('Khong tim thay san pham trong gio hang.');
    if (item.variant.stockQty < body.quantity) {
      throw Errors.conflict('OUT_OF_STOCK', `Chi con ${item.variant.stockQty} san pham.`);
    }
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity: body.quantity } });
    res.json(await loadCartPayload(cart.id));
  }),
);

cartRouter.delete(
  '/cart/items/:itemId',
  asyncHandler(async (req, res) => {
    const cart = await resolveCart(req);
    await prisma.cartItem.deleteMany({ where: { id: Number(req.params.itemId), cartId: cart.id } });
    res.json(await loadCartPayload(cart.id));
  }),
);
