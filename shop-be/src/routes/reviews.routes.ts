import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { Errors } from '../lib/apiError';
import { toReview } from '../lib/mappers';
import { requireRole } from '../middleware/auth';
import { STAFF_ROLES } from '../lib/roles';

export const reviewsRouter = Router();

const reviewInclude = { user: true, reply: { include: { employee: true } } } as const;

reviewsRouter.get(
  '/products/:id/reviews',
  asyncHandler(async (req, res) => {
    const productId = Number(req.params.id);
    const reviews = await prisma.review.findMany({
      where: { productId },
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews.map(toReview));
  }),
);

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().min(1, 'Noi dung danh gia khong duoc de trong.'),
});

reviewsRouter.post(
  '/products/:id/reviews',
  requireRole('CUSTOMER'),
  asyncHandler(async (req, res) => {
    const body = createReviewSchema.parse(req.body);
    const productId = Number(req.params.id);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw Errors.notFound('San pham khong ton tai.');

    const existing = await prisma.review.findUnique({
      where: { productId_userId: { productId, userId: req.userId! } },
    });
    if (existing) throw Errors.conflict('ALREADY_REVIEWED', 'Ban da danh gia san pham nay roi.');

    const review = await prisma.review.create({
      data: { productId, userId: req.userId!, rating: body.rating, content: body.content },
      include: reviewInclude,
    });
    res.status(201).json(toReview(review));
  }),
);

reviewsRouter.get(
  '/admin/reviews',
  requireRole(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const page = Math.max(0, Number(req.query.page ?? 0));
    const size = Math.min(100, Math.max(1, Number(req.query.size ?? 20)));
    const replied = req.query.replied;
    const where =
      replied === 'true' ? { reply: { isNot: null } } : replied === 'false' ? { reply: { is: null } } : {};

    const [items, totalItems] = await Promise.all([
      prisma.review.findMany({
        where,
        include: { ...reviewInclude, product: true },
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      prisma.review.count({ where }),
    ]);

    res.json({
      items: items.map((r) => ({ ...toReview(r), productName: r.product.name })),
      page,
      size,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / size)),
    });
  }),
);

const replySchema = z.object({ content: z.string().min(1, 'Noi dung tra loi khong duoc de trong.') });

reviewsRouter.post(
  '/admin/reviews/:id/reply',
  requireRole(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const body = replySchema.parse(req.body);
    const reviewId = Number(req.params.id);
    const review = await prisma.review.findUnique({ where: { id: reviewId }, include: { reply: true, product: true } });
    if (!review) throw Errors.notFound('Khong tim thay danh gia.');
    if (review.reply) throw Errors.conflict('ALREADY_REPLIED', 'Danh gia nay da duoc tra loi.');

    await prisma.reviewReply.create({
      data: { reviewId, employeeId: req.userId!, content: body.content },
    });

    const updated = await prisma.review.findUniqueOrThrow({
      where: { id: reviewId },
      include: { ...reviewInclude, product: true },
    });
    res.status(201).json({ ...toReview(updated), productName: updated.product.name });
  }),
);
