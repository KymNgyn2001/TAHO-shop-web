import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { Errors } from '../lib/apiError';
import { uniqueSlug } from '../lib/slug';
import { requireRole } from '../middleware/auth';
import { STAFF_ROLES } from '../lib/roles';

export const categoriesRouter = Router();

/** Nhom co dinh de menu on dinh — chon 1 trong cac gia tri nay khi tao/sua danh muc. */
export const CATEGORY_GROUPS = ['Áo', 'Quần', 'Váy & Đầm', 'Phụ kiện'] as const;

categoriesRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
      orderBy: { name: 'asc' },
    });
    res.json(
      categories.map((c) => ({
        id: c.id, name: c.name, slug: c.slug, group: c.group, productCount: c._count.products,
      })),
    );
  }),
);

const createCategorySchema = z.object({
  name: z.string().min(1, 'Ten danh muc khong duoc de trong.'),
  group: z.enum(CATEGORY_GROUPS).optional(),
});

categoriesRouter.post(
  '/admin/categories',
  requireRole(...STAFF_ROLES),
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
    const category = await prisma.category.create({ data: { name: body.name, slug, group: body.group } });
    res.status(201).json({
      id: category.id, name: category.name, slug: category.slug, group: category.group, productCount: 0,
    });
  }),
);

const updateCategorySchema = z.object({ group: z.enum(CATEGORY_GROUPS).nullable() });

categoriesRouter.patch(
  '/admin/categories/:id',
  requireRole(...STAFF_ROLES),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = updateCategorySchema.parse(req.body);
    const category = await prisma.category.update({ where: { id }, data: { group: body.group } }).catch(() => {
      throw Errors.notFound('Khong tim thay danh muc.');
    });
    res.json({ id: category.id, name: category.name, slug: category.slug, group: category.group });
  }),
);

categoriesRouter.delete(
  '/admin/categories/:id',
  requireRole(...STAFF_ROLES),
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
