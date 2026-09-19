import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { toProductCard } from '../lib/mappers';
import { scoreText } from '../lib/search';
import { upload } from '../middleware/upload';

export const searchRouter = Router();

const productInclude = { images: true, category: true } as const;

const semanticSchema = z.object({ query: z.string().min(1), limit: z.number().int().positive().max(50).optional() });

searchRouter.post(
  '/search/semantic',
  asyncHandler(async (req, res) => {
    const body = semanticSchema.parse(req.body);
    const limit = body.limit ?? 12;
    const products = await prisma.product.findMany({ where: { active: true }, include: productInclude });
    const ranked = products
      .map((p) => ({
        product: p,
        score: scoreText(body.query, [p.name, p.description, p.material, p.brand, p.category?.name]
          .filter(Boolean).join(' ')),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    res.json(ranked.map((r) => toProductCard(r.product, Number(r.score.toFixed(2)))));
  }),
);

searchRouter.post(
  '/search/image',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const limit = Math.min(50, Number(req.query.limit ?? 12));
    // Chua co model nhan dien anh -> tra ve san pham duoc xem nhieu nhat lam goi y tam thoi.
    const products = await prisma.product.findMany({
      where: { active: true },
      include: productInclude,
      orderBy: { viewCount: 'desc' },
      take: limit,
    });
    res.json(products.map((p, i) => toProductCard(p, Number((0.75 - i * 0.05).toFixed(2)))));
  }),
);
