import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { Errors } from '../lib/apiError';
import { addItemToCart, loadCartPayload, resolveCart } from '../lib/cart';

export const cartRouter = Router();

/** Tai khoan nhan vien/quan ly khong dung chuc nang mua hang cua khach. */
function blockStaff(req: Request, _res: Response, next: NextFunction) {
  if (req.userRole === 'EMPLOYEE' || req.userRole === 'MANAGER') {
    return next(Errors.forbidden('Tai khoan nhan vien khong dung chuc nang them vao gio hang.'));
  }
  next();
}

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
  blockStaff,
  asyncHandler(async (req, res) => {
    const body = addSchema.parse(req.body);
    const cart = await resolveCart(req);
    await addItemToCart(cart.id, body.variantId, body.quantity);
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
