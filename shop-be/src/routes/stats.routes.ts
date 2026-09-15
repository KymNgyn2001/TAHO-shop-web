import { Router } from 'express';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { Errors } from '../lib/apiError';
import { requireRole } from '../middleware/auth';

const ORDER_STATUSES = new Set(Object.values(OrderStatus));

export const statsRouter = Router();

function monthRange(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw Errors.validation('Thang khong hop le, dung dinh dang YYYY-MM.', 'month');
  const year = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) throw Errors.validation('Thang khong hop le.', 'month');
  return { start: new Date(year, m - 1, 1), end: new Date(year, m, 1), year, month: m };
}

statsRouter.get(
  '/admin/stats/monthly',
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const month = String(req.query.month ?? '');
    const { start, end, year, month: m } = monthRange(month);
    const prevStart = new Date(year, m - 2, 1);

    const [orders, prevOrders, mostViewedProducts] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: { items: { include: { product: { include: { category: true } } } } },
      }),
      prisma.order.findMany({ where: { createdAt: { gte: prevStart, lt: start } } }),
      prisma.product.findMany({ orderBy: { viewCount: 'desc' }, take: 5 }),
    ]);

    const active = orders.filter((o) => o.status !== 'CANCELLED');
    const cancelled = orders.filter((o) => o.status === 'CANCELLED');
    const totalRevenue = active.reduce((s, o) => s + o.totalAmount, 0);
    const totalOrders = active.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const prevActive = prevOrders.filter((o) => o.status !== 'CANCELLED');
    const prevRevenue = prevActive.reduce((s, o) => s + o.totalAmount, 0);
    const revenueChangePct =
      prevRevenue > 0 ? Number((((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)) : null;

    const lastDay = new Date(year, m, 0).getDate();
    const daily = Array.from({ length: lastDay }, (_, i) => {
      const day = i + 1;
      const dayOrders = active.filter((o) => o.createdAt.getDate() === day);
      return {
        date: `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        orders: dayOrders.length,
        revenue: dayOrders.reduce((s, o) => s + o.totalAmount, 0),
      };
    });

    const productAgg = new Map<number, { productName: string; quantitySold: number; revenue: number }>();
    const categoryAgg = new Map<string, number>();
    for (const o of active) {
      for (const item of o.items) {
        const agg = productAgg.get(item.productId) ?? { productName: item.productName, quantitySold: 0, revenue: 0 };
        agg.quantitySold += item.quantity;
        agg.revenue += item.lineTotal;
        productAgg.set(item.productId, agg);

        const categoryName = item.product.category?.name ?? 'Khac';
        categoryAgg.set(categoryName, (categoryAgg.get(categoryName) ?? 0) + item.quantity);
      }
    }

    const topProducts = [...productAgg.entries()]
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const categoryShare = [...categoryAgg.entries()].map(([categoryName, quantitySold]) => ({
      categoryName,
      quantitySold,
    }));

    res.json({
      month,
      totalOrders,
      cancelledOrders: cancelled.length,
      totalRevenue,
      avgOrderValue,
      revenueChangePct,
      daily,
      topProducts,
      categoryShare,
      mostViewed: mostViewedProducts.map((p) => ({ productId: p.id, productName: p.name, viewCount: p.viewCount })),
    });
  }),
);

statsRouter.get(
  '/admin/transactions',
  requireRole('MANAGER'),
  asyncHandler(async (req, res) => {
    const page = Math.max(0, Number(req.query.page ?? 0));
    const size = Math.min(100, Math.max(1, Number(req.query.size ?? 20)));
    const statusParam = req.query.status as string | undefined;
    const status = statusParam && ORDER_STATUSES.has(statusParam as OrderStatus) ? (statusParam as OrderStatus) : undefined;

    const where = status ? { status } : {};
    const [orders, totalItems] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { user: true, items: true },
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      items: orders.map((o) => ({
        orderCode: o.code,
        customerName: o.user?.name ?? o.receiverName,
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
