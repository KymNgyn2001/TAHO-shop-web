import { Router } from 'express';
import { z } from 'zod';
import { Audience, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { Errors } from '../lib/apiError';
import { toProductCard, toProductDetail } from '../lib/mappers';
import { uniqueSlug } from '../lib/slug';
import { requireRole } from '../middleware/auth';

const AUDIENCES = new Set(Object.values(Audience));

export const productsRouter = Router();

const productInclude = { images: true, category: true } as const;

productsRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const page = Math.max(0, Number(req.query.page ?? 0));
    const size = Math.min(100, Math.max(1, Number(req.query.size ?? 12)));
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const audienceParam = req.query.audience as string | undefined;
    const audience = audienceParam && AUDIENCES.has(audienceParam as Audience) ? (audienceParam as Audience) : undefined;

    const where = { ...(categoryId ? { categoryId } : {}), ...(audience ? { audience } : {}) };
    const [items, totalItems] = await Promise.all([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { createdAt: 'desc' },
        skip: page * size,
        take: size,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      items: items.map((p) => toProductCard(p)),
      page,
      size,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / size)),
    });
  }),
);

productsRouter.get(
  '/products/:slug',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug },
      include: { ...productInclude, variants: true },
    });
    if (!product) throw Errors.notFound('San pham khong con nua.');

    await prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } });

    res.json(toProductDetail(product));
  }),
);

productsRouter.get(
  '/products/:id/similar',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const limit = Math.min(24, Number(req.query.limit ?? 8));
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw Errors.notFound();

    const items = await prisma.product.findMany({
      where: { categoryId: product.categoryId, id: { not: id } },
      include: productInclude,
      take: limit,
    });
    res.json(items.map((p) => toProductCard(p)));
  }),
);

productsRouter.get(
  '/recommend',
  asyncHandler(async (req, res) => {
    const limit = Math.min(24, Number(req.query.limit ?? 8));
    const items = await prisma.product.findMany({
      include: productInclude,
      orderBy: { viewCount: 'desc' },
      take: limit,
    });
    res.json(items.map((p) => toProductCard(p)));
  }),
);

const variantInputSchema = z.object({
  size: z.string().min(1),
  color: z.string().min(1),
  colorHex: z.string().optional(),
  priceOverride: z.number().int().positive().optional(),
  stockQty: z.number().int().min(0),
});

const createProductSchema = z.object({
  name: z.string().min(1, 'Ten san pham khong duoc de trong.'),
  categoryId: z.number().int().positive(),
  basePrice: z.number().int().positive('Gia phai lon hon 0.'),
  description: z.string().optional(),
  brand: z.string().optional(),
  material: z.string().optional(),
  imageUrls: z.array(z.string().min(1)).min(1, 'Can it nhat 1 anh san pham.'),
  sizeChartImageUrl: z.string().optional(),
  audience: z.enum(['MEN', 'WOMEN', 'KIDS', 'UNISEX']).optional(),
  variants: z.array(variantInputSchema).min(1, 'Can it nhat 1 phan loai (size/mau).'),
});

productsRouter.post(
  '/admin/products',
  requireRole('EMPLOYEE', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const body = createProductSchema.parse(req.body);
    const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!category) throw Errors.validation('Danh muc khong ton tai.', 'categoryId');

    const slug = await uniqueSlug(body.name, async (s) => {
      const found = await prisma.product.findUnique({ where: { slug: s } });
      return !!found;
    });

    const product = await prisma.product.create({
      data: {
        name: body.name,
        slug,
        categoryId: body.categoryId,
        basePrice: body.basePrice,
        description: body.description,
        brand: body.brand,
        material: body.material,
        sizeChartUrl: body.sizeChartImageUrl,
        audience: body.audience,
        images: {
          create: body.imageUrls.map((url, i) => ({ url, isPrimary: i === 0, sortOrder: i })),
        },
        variants: {
          create: body.variants.map((v, i) => ({
            sku: `${slug.slice(0, 12).toUpperCase()}-${v.size}-${i}`.replace(/\s+/g, '').slice(0, 40),
            size: v.size,
            color: v.color,
            colorHex: v.colorHex,
            priceOverride: v.priceOverride,
            stockQty: v.stockQty,
          })),
        },
      },
      include: { ...productInclude, variants: true },
    });

    res.status(201).json(toProductDetail(product));
  }),
);

productsRouter.delete(
  '/admin/products/:id',
  requireRole('EMPLOYEE', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    try {
      await prisma.product.delete({ where: { id } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw Errors.notFound('Khong tim thay san pham.');
      }
      const message = e instanceof Error ? e.message : '';
      const isForeignKeyViolation =
        (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') ||
        message.includes('foreign key constraint') ||
        message.includes('OrderItem_productId_fkey');
      if (isForeignKeyViolation) {
        throw Errors.conflict('PRODUCT_HAS_ORDERS', 'San pham nay da co trong don hang, khong the xoa.');
      }
      throw e;
    }
    res.status(204).send();
  }),
);
