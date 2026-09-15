import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { Errors } from '../lib/apiError';
import { toOrder } from '../lib/mappers';
import { nextOrderCode } from '../lib/orderCode';
import { evaluateDiscountCode } from '../lib/discount';
import { clearCart, resolveCart } from '../lib/cart';

export const ordersRouter = Router();

const orderInclude = { items: true, shippingMethod: true, discountCode: true } as const;

const createOrderSchema = z.object({
  items: z.array(z.object({ variantId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1),
  shippingMethodId: z.number().int().positive(),
  discountCode: z.string().optional(),
  receiverName: z.string().min(1, 'Vui long nhap ten nguoi nhan.'),
  receiverPhone: z.string().min(8, 'So dien thoai khong hop le.'),
  shippingAddress: z.string().min(1, 'Vui long nhap dia chi giao hang.'),
  note: z.string().optional(),
  paymentMethod: z.enum(['COD', 'BANK_TRANSFER']),
});

ordersRouter.post(
  '/orders',
  asyncHandler(async (req, res) => {
    const body = createOrderSchema.parse(req.body);

    const shippingMethod = await prisma.shippingMethod.findUnique({ where: { id: body.shippingMethodId } });
    if (!shippingMethod || !shippingMethod.active) {
      throw Errors.validation('Phuong thuc van chuyen khong hop le.', 'shippingMethodId');
    }

    const order = await prisma.$transaction(async (tx) => {
      const lineItems: {
        productId: number;
        variantId: number;
        productName: string;
        size: string;
        color: string;
        unitPrice: number;
        quantity: number;
        lineTotal: number;
      }[] = [];

      for (const reqItem of body.items) {
        const variant = await tx.variant.findUnique({
          where: { id: reqItem.variantId },
          include: { product: true },
        });
        if (!variant) throw Errors.notFound(`Khong tim thay san pham (variant #${reqItem.variantId}).`);
        if (variant.stockQty < reqItem.quantity) {
          throw Errors.conflict(
            'OUT_OF_STOCK',
            `${variant.product.name} size ${variant.size} vua het hang.`,
          );
        }
        const unitPrice = variant.priceOverride ?? variant.product.basePrice;
        lineItems.push({
          productId: variant.productId,
          variantId: variant.id,
          productName: variant.product.name,
          size: variant.size,
          color: variant.color,
          unitPrice,
          quantity: reqItem.quantity,
          lineTotal: unitPrice * reqItem.quantity,
        });
        await tx.variant.update({
          where: { id: variant.id },
          data: { stockQty: { decrement: reqItem.quantity } },
        });
      }

      const subtotal = lineItems.reduce((s, i) => s + i.lineTotal, 0);

      let discountAmount = 0;
      let discountCodeId: number | null = null;
      if (body.discountCode) {
        const evalResult = await evaluateDiscountCode(body.discountCode, subtotal);
        if (!evalResult.valid || !evalResult.code) {
          throw Errors.validation(evalResult.message, 'discountCode');
        }
        discountAmount = evalResult.discountAmount;
        discountCodeId = evalResult.code.id;
        await tx.discountCode.update({ where: { id: evalResult.code.id }, data: { usedCount: { increment: 1 } } });
      }

      const totalAmount = subtotal + shippingMethod.fee - discountAmount;
      const code = await nextOrderCode();

      const created = await tx.order.create({
        data: {
          code,
          userId: req.userId ?? null,
          sessionId: req.userId ? null : req.sessionId ?? null,
          status: 'PENDING',
          subtotal,
          shippingFee: shippingMethod.fee,
          discountAmount,
          totalAmount,
          paymentMethod: body.paymentMethod,
          shippingMethodId: shippingMethod.id,
          discountCodeId,
          receiverName: body.receiverName,
          receiverPhone: body.receiverPhone,
          shippingAddress: body.shippingAddress,
          note: body.note,
          createdBy: 'WEB',
          items: { create: lineItems },
        },
        include: orderInclude,
      });

      return created;
    });

    const cart = await resolveCart(req).catch(() => null);
    if (cart) await clearCart(cart.id);

    res.status(201).json(toOrder(order));
  }),
);

ordersRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const page = Math.max(0, Number(req.query.page ?? 0));
    const size = Math.min(100, Math.max(1, Number(req.query.size ?? 20)));

    const where = req.userId ? { userId: req.userId } : req.sessionId ? { sessionId: req.sessionId } : { id: -1 };
    const [items, totalItems] = await Promise.all([
      prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      items: items.map(toOrder),
      page,
      size,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / size)),
    });
  }),
);

ordersRouter.get(
  '/orders/:code',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { code: req.params.code }, include: orderInclude });
    if (!order) throw Errors.notFound('Khong tim thay don hang.');
    const owned = req.userId ? order.userId === req.userId : order.sessionId === req.sessionId;
    if (!owned) throw Errors.notFound('Khong tim thay don hang.');
    res.json(toOrder(order));
  }),
);

const cancelSchema = z.object({ reason: z.string().min(1, 'Vui long nhap ly do huy don.') });

ordersRouter.post(
  '/orders/:code/cancel',
  asyncHandler(async (req, res) => {
    const body = cancelSchema.parse(req.body);
    const order = await prisma.order.findUnique({ where: { code: req.params.code }, include: orderInclude });
    if (!order) throw Errors.notFound('Khong tim thay don hang.');
    const owned = req.userId ? order.userId === req.userId : order.sessionId === req.sessionId;
    if (!owned) throw Errors.notFound('Khong tim thay don hang.');

    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      throw Errors.conflict('ORDER_NOT_CANCELLABLE', 'Don da giao cho van chuyen, khong huy duoc nua.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.variant.update({ where: { id: item.variantId }, data: { stockQty: { increment: item.quantity } } });
      }
      return tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: body.reason },
        include: orderInclude,
      });
    });

    res.json(toOrder(updated));
  }),
);
