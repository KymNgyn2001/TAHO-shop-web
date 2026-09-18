import { Router } from 'express';
import { z } from 'zod';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { Errors } from '../lib/apiError';
import { toOrder } from '../lib/mappers';
import { nextOrderCode } from '../lib/orderCode';
import { evaluateDiscountCode } from '../lib/discount';
import { clearCart, resolveCart } from '../lib/cart';
import { requireAuth, requireRole } from '../middleware/auth';
import { sendOrderConfirmationEmail } from '../lib/mailer';
import { createMomoPayment } from '../lib/momo';
import { createPayOSPayment, payosEnabled } from '../lib/payos';

export const ordersRouter = Router();

function isStaff(role: string | undefined): boolean {
  return role === 'EMPLOYEE' || role === 'MANAGER';
}

const orderInclude = { items: true, shippingMethod: true, discountCode: true } as const;

const createOrderSchema = z.object({
  items: z.array(z.object({ variantId: z.number().int().positive(), quantity: z.number().int().positive() })).min(1),
  shippingMethodId: z.number().int().positive(),
  discountCode: z.string().optional(),
  receiverName: z.string().min(1, 'Vui long nhap ten nguoi nhan.'),
  receiverPhone: z.string().min(8, 'So dien thoai khong hop le.'),
  email: z.string().email('Email khong hop le.'),
  shippingAddress: z.string().min(1, 'Vui long nhap dia chi giao hang.'),
  note: z.string().optional(),
  paymentMethod: z.enum(['COD', 'BANK_TRANSFER', 'MOMO']),
});

ordersRouter.post(
  '/orders',
  (req, _res, next) => {
    if (isStaff(req.userRole)) {
      return next(Errors.forbidden('Tai khoan nhan vien khong dung chuc nang mua hang.'));
    }
    next();
  },
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
          // COD khong can xac minh thanh toan truoc — tu dong xac nhan luon, chi
          // don chuyen khoan moi can nhan vien tu kiem tra roi bam xac nhan tay.
          status: body.paymentMethod === 'COD' ? 'CONFIRMED' : 'PENDING',
          subtotal,
          shippingFee: shippingMethod.fee,
          discountAmount,
          totalAmount,
          paymentMethod: body.paymentMethod,
          shippingMethodId: shippingMethod.id,
          discountCodeId,
          receiverName: body.receiverName,
          receiverPhone: body.receiverPhone,
          email: body.email,
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

    // Khong await — gui mail cham/loi khong duoc lam cham hay lam sap request dat hang.
    sendOrderConfirmationEmail(order.email!, {
      code: order.code,
      receiverName: order.receiverName,
      receiverPhone: order.receiverPhone,
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      shippingMethodName: order.shippingMethod?.name ?? null,
      items: order.items.map((i) => ({
        productName: i.productName, size: i.size, color: i.color, quantity: i.quantity, lineTotal: i.lineTotal,
      })),
    });

    if (order.paymentMethod === 'MOMO') {
      try {
        const payment = await createMomoPayment({
          orderCode: order.code,
          amount: order.totalAmount,
          orderInfo: `Thanh toan don hang ${order.code} - TAHO`,
        });
        if (payment.resultCode === 0 && payment.payUrl) {
          const updated = await prisma.order.update({
            where: { id: order.id },
            data: { payUrl: payment.payUrl },
            include: orderInclude,
          });
          return res.status(201).json(toOrder(updated));
        }
        // MoMo tu choi tao thanh toan (VD sai cau hinh sandbox) — don van da tao
        // xong (con PENDING), chi bao loi de FE hien thong bao, khong lam mat don.
        return res.status(201).json({ ...toOrder(order), payUrl: null, payError: payment.message });
      } catch {
        return res.status(201).json({ ...toOrder(order), payUrl: null, payError: 'Khong ket noi duoc toi MoMo.' });
      }
    }

    // Chuyen khoan ngan hang — neu da cau hinh PayOS thi tao link thanh toan that,
    // xac nhan tu dong qua webhook; chua cau hinh thi fallback ve VietQR tinh + nhan
    // vien tu xac nhan tay (hanh vi cu, khong doi gi ca).
    if (order.paymentMethod === 'BANK_TRANSFER' && payosEnabled) {
      try {
        const payment = await createPayOSPayment({
          orderId: order.id,
          orderCode: order.code,
          amount: order.totalAmount,
        });
        const updated = await prisma.order.update({
          where: { id: order.id },
          data: { payUrl: payment.checkoutUrl, payQrData: payment.qrCode },
          include: orderInclude,
        });
        return res.status(201).json(toOrder(updated));
      } catch (e) {
        return res.status(201).json({
          ...toOrder(order),
          payUrl: null,
          payError: e instanceof Error ? e.message : 'Khong ket noi duoc toi PayOS.',
        });
      }
    }

    res.status(201).json(toOrder(order));
  }),
);

ordersRouter.get(
  '/orders',
  requireAuth,
  asyncHandler(async (req, res) => {
    const page = Math.max(0, Number(req.query.page ?? 0));
    const size = Math.min(100, Math.max(1, Number(req.query.size ?? 20)));

    // "Don hang cua toi" — luon la don cua chinh tai khoan dang dang nhap,
    // ke ca voi nhan vien/quan ly (ho khong tu dong thay het don cua khach o day).
    const where = { userId: req.userId! };
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

/** Toan bo don hang cho nhan vien/quan ly duyet + xu ly — khac voi GET /orders
 * (luon loc theo chinh tai khoan dang dang nhap, ke ca voi nhan vien). */
ordersRouter.get(
  '/admin/orders',
  requireRole('EMPLOYEE', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const page = Math.max(0, Number(req.query.page ?? 0));
    const size = Math.min(100, Math.max(1, Number(req.query.size ?? 20)));
    const statusParam = req.query.status as string | undefined;
    const isValidStatus = (s: string): s is OrderStatus => Object.values(OrderStatus).includes(s as OrderStatus);
    const where = statusParam && isValidStatus(statusParam) ? { status: statusParam } : {};

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
  requireAuth,
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { code: req.params.code }, include: orderInclude });
    if (!order) throw Errors.notFound('Khong tim thay don hang.');
    const allowed = order.userId === req.userId || isStaff(req.userRole);
    if (!allowed) throw Errors.notFound('Khong tim thay don hang.');
    res.json(toOrder(order));
  }),
);

const cancelSchema = z.object({ reason: z.string().min(1, 'Vui long nhap ly do huy don.') });

ordersRouter.post(
  '/orders/:code/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = cancelSchema.parse(req.body);
    const order = await prisma.order.findUnique({ where: { code: req.params.code }, include: orderInclude });
    if (!order) throw Errors.notFound('Khong tim thay don hang.');
    const allowed = order.userId === req.userId || req.userRole === 'MANAGER';
    if (!allowed) throw Errors.notFound('Khong tim thay don hang.');

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

/** Thu tu tien trien don hang — nhan vien/quan ly chi duoc chuyen toi, khong lui lai
 * duoc, va khong dung endpoint nay de huy (da co /cancel rieng, co hoan kho). */
const STATUS_FLOW = ['PENDING', 'CONFIRMED', 'SHIPPING', 'COMPLETED'] as const;
const updateStatusSchema = z.object({ status: z.enum(['CONFIRMED', 'SHIPPING', 'COMPLETED']) });

ordersRouter.patch(
  '/admin/orders/:code/status',
  requireRole('EMPLOYEE', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = updateStatusSchema.parse(req.body);
    const order = await prisma.order.findUnique({ where: { code: req.params.code } });
    if (!order) throw Errors.notFound('Khong tim thay don hang.');
    if (order.status === 'CANCELLED') {
      throw Errors.conflict('ORDER_CANCELLED', 'Don da huy, khong doi trang thai duoc nua.');
    }

    const currentIdx = STATUS_FLOW.indexOf(order.status as (typeof STATUS_FLOW)[number]);
    const nextIdx = STATUS_FLOW.indexOf(body.status);
    if (nextIdx <= currentIdx) {
      throw Errors.validation('Chi co the chuyen sang trang thai sau, khong lui lai duoc.', 'status');
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: body.status },
      include: orderInclude,
    });
    res.json(toOrder(updated));
  }),
);
