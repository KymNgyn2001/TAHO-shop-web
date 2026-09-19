import { Router } from 'express';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { requireRole } from '../middleware/auth';
import { MANAGER_ROLES } from '../lib/roles';
import { computeMonthlyStats } from '../lib/monthlyStats';

const ORDER_STATUSES = new Set(Object.values(OrderStatus));

export const statsRouter = Router();

statsRouter.get(
  '/admin/stats/monthly',
  requireRole(...MANAGER_ROLES),
  asyncHandler(async (req, res) => {
    const month = String(req.query.month ?? '');
    res.json(await computeMonthlyStats(month));
  }),
);

statsRouter.get(
  '/admin/transactions',
  requireRole(...MANAGER_ROLES),
  asyncHandler(async (req, res) => {
    const page = Math.max(0, Number(req.query.page ?? 0));
    const size = Math.min(100, Math.max(1, Number(req.query.size ?? 20)));
    const statusParam = req.query.status as string | undefined;
    const status = statusParam && ORDER_STATUSES.has(statusParam as OrderStatus) ? (statusParam as OrderStatus) : undefined;

    const where = status ? { status } : {};
    const [orders, totalItems] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      items: orders.map((o) => ({
        orderCode: o.code,
        // Dung receiverName (nguoi nhan hang) thay vi ten tai khoan — trung voi cach
        // trang "Don hang" (admin/orders) hien thi, tranh 2 noi cho ra 2 ten khac nhau
        // cho cung 1 don (VD tai khoan dung chung nhung nguoi nhan la nguoi khac).
        customerName: o.receiverName,
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        totalAmount: o.totalAmount,
        status: o.status,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt.toISOString(),
      })),
      page,
      size,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / size)),
    });
  }),
);
