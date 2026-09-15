import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { Errors } from '../lib/apiError';
import { uniqueSlug } from '../lib/slug';
import { requireRole } from '../middleware/auth';

export const categoriesRouter = Router();

categoriesRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(
      categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, productCount: c._count.products })),
    );
  }),
);

const createCategorySchema = z.object({ name: z.string().min(1, 'Ten danh muc khong duoc de trong.') });

categoriesRouter.post(
  '/admin/categories',
  requireRole('EMPLOYEE', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = createCategorySchema.parse(req.body);
    const existing = await prisma.category.findFirst({
      where: { name: { equals: body.name } },
    });
    if (existing) throw Errors.conflict('CATEGORY_EXISTS', 'Loai nay da ton tai.');

    const slug = await uniqueSlug(body.name, async (s) => {
      const found = await prisma.category.findUnique({ where: { slug: s } });
      return !!found;
    });
    const category = await prisma.category.create({ data: { name: body.name, slug } });
    res.status(201).json({ id: category.id, name: category.name, slug: category.slug, productCount: 0 });
  }),
);

categoriesRouter.delete(
  '/admin/categories/:id',
  requireRole('EMPLOYEE', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count > 0) throw Errors.conflict('CATEGORY_NOT_EMPTY', 'Con san pham trong danh muc nay, khong the xoa.');
    await prisma.category.delete({ where: { id } }).catch(() => {
      throw Errors.notFound('Khong tim thay danh muc.');
    });
    res.status(204).send();
  }),
);
