import { Router } from 'express';
import { z } from 'zod';
import { Audience, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { Errors } from '../lib/apiError';
import { toProductCard, toProductDetail } from '../lib/mappers';
import { toRelativePath } from '../lib/url';
import { uniqueSlug } from '../lib/slug';
import { requireRole } from '../middleware/auth';

const AUDIENCES = new Set(Object.values(Audience));

export const productsRouter = Router();

const productInclude = { images: true, category: true } as const;

function isStaff(role: string | undefined): boolean {
  return role === 'EMPLOYEE' || role === 'MANAGER';
}

productsRouter.get(
  '/products',
  asyncHandler(async (req, res) => {
    const page = Math.max(0, Number(req.query.page ?? 0));
    const size = Math.min(100, Math.max(1, Number(req.query.size ?? 12)));
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const audienceParam = req.query.audience as string | undefined;
    const audience = audienceParam && AUDIENCES.has(audienceParam as Audience) ? (audienceParam as Audience) : undefined;

    // Khach hang chi thay san pham dang ban — nhan vien/quan ly (VD dang o trang
    // quan tri) thay ca san pham da an de con quan ly duoc.
    const where = {
      ...(categoryId ? { categoryId } : {}),
      ...(audience ? { audience } : {}),
      ...(isStaff(req.userRole) ? {} : { active: true }),
    };
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
    if (!product.active && !isStaff(req.userRole)) throw Errors.notFound('San pham khong con nua.');

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
      where: { categoryId: product.categoryId, id: { not: id }, active: true },
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
      where: { active: true },
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
  images: z.array(z.object({ url: z.string().min(1), color: z.string().optional() }))
    .min(1, 'Can it nhat 1 anh san pham.'),
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
        sizeChartUrl: body.sizeChartImageUrl ? toRelativePath(body.sizeChartImageUrl) : body.sizeChartImageUrl,
        audience: body.audience,
        images: {
          create: body.images.map((img, i) => ({
            url: toRelativePath(img.url),
            color: img.color,
            isPrimary: i === 0,
            sortOrder: i,
          })),
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

productsRouter.patch(
  '/admin/products/:id',
  requireRole('EMPLOYEE', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('Khong tim thay san pham.');

    const body = createProductSchema.parse(req.body);
    const category = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!category) throw Errors.validation('Danh muc khong ton tai.', 'categoryId');

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: body.name,
          categoryId: body.categoryId,
          basePrice: body.basePrice,
          description: body.description,
          brand: body.brand,
          material: body.material,
          sizeChartUrl: body.sizeChartImageUrl ? toRelativePath(body.sizeChartImageUrl) : body.sizeChartImageUrl,
          audience: body.audience,
        },
      });

      // Anh: thay toan bo — anh khong bi rang buoc khoa ngoai boi bang nao khac.
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: body.images.map((img, i) => ({
          productId: id,
          url: toRelativePath(img.url),
          color: img.color,
          isPrimary: i === 0,
          sortOrder: i,
        })),
      });

      // Bien the: doi chieu theo cap (size, color) de giu nguyen id cho bien the
      // da co (tranh vo du lieu gio hang/don hang cu dang tro toi id do).
      const existingVariants = await tx.variant.findMany({ where: { productId: id } });
      const keyOf = (size: string, color: string) => `${size}::${color}`;
      const incomingKeys = new Set(body.variants.map((v) => keyOf(v.size, v.color)));

      for (const ev of existingVariants) {
        if (incomingKeys.has(keyOf(ev.size, ev.color))) continue;
        const [cartRefs, orderRefs] = await Promise.all([
          tx.cartItem.count({ where: { variantId: ev.id } }),
          tx.orderItem.count({ where: { variantId: ev.id } }),
        ]);
        if (cartRefs === 0 && orderRefs === 0) {
          await tx.variant.delete({ where: { id: ev.id } });
        } else {
          // Da tung ban/dang trong gio ai do -> khong xoa duoc, chi tat ton kho.
          await tx.variant.update({ where: { id: ev.id }, data: { stockQty: 0 } });
        }
      }

      for (const v of body.variants) {
        const match = existingVariants.find((ev) => keyOf(ev.size, ev.color) === keyOf(v.size, v.color));
        if (match) {
          await tx.variant.update({
            where: { id: match.id },
            data: { colorHex: v.colorHex, priceOverride: v.priceOverride ?? null, stockQty: v.stockQty },
          });
        } else {
          await tx.variant.create({
            data: {
              productId: id,
              sku: `${existing.slug.slice(0, 12).toUpperCase()}-${v.size}-${Date.now().toString(36).slice(-5)}`
                .replace(/\s+/g, '').slice(0, 40).toUpperCase(),
              size: v.size,
              color: v.color,
              colorHex: v.colorHex,
              priceOverride: v.priceOverride,
              stockQty: v.stockQty,
            },
          });
        }
      }
    });

    const updated = await prisma.product.findUniqueOrThrow({
      where: { id },
      include: { ...productInclude, variants: true },
    });
    res.json(toProductDetail(updated));
  }),
);

const toggleActiveSchema = z.object({ active: z.boolean() });

productsRouter.patch(
  '/admin/products/:id/active',
  requireRole('EMPLOYEE', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = toggleActiveSchema.parse(req.body);
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('Khong tim thay san pham.');

    const updated = await prisma.product.update({
      where: { id },
      data: { active: body.active },
      include: productInclude,
    });
    res.json(toProductCard(updated));
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
