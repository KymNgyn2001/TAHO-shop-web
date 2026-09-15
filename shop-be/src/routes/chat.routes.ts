import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { toOrder, toProductCard } from '../lib/mappers';

export const chatRouter = Router();

const productInclude = { images: true, category: true } as const;
const orderInclude = { items: true, shippingMethod: true, discountCode: true } as const;

const ORDER_CODE_RE = /ORD-\d{8}-\d{4}/i;

function scoreProduct(query: string, haystack: string): number {
  const q = query.toLowerCase().trim();
  const h = haystack.toLowerCase();
  if (!q) return 0;
  if (h.includes(q)) return 0.9;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  return words.filter((w) => h.includes(w)).length / words.length;
}

const chatSchema = z.object({
  message: z.string().min(1),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).optional(),
});

chatRouter.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const body = chatSchema.parse(req.body);
    const message = body.message.trim();
    const lower = message.toLowerCase();
    const orderCodeMatch = ORDER_CODE_RE.exec(message);
    const wantsCancel = lower.includes('hủy') || lower.includes('huy');

    if (orderCodeMatch) {
      const code = orderCodeMatch[0].toUpperCase();
      const order = await prisma.order.findUnique({ where: { code }, include: orderInclude });
      if (!order) {
        return res.json({ role: 'assistant', content: `Mình không tìm thấy đơn ${code}, bạn kiểm tra lại mã giúp mình nhé.` });
      }
      const owned = req.userId ? order.userId === req.userId : order.sessionId === req.sessionId;
      if (!owned) {
        return res.json({ role: 'assistant', content: `Mình không tìm thấy đơn ${code} thuộc tài khoản của bạn.` });
      }

      if (wantsCancel) {
        if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
          return res.json({
            role: 'assistant',
            content: `Đơn ${code} đã giao cho vận chuyển nên không huỷ được nữa.`,
            order: toOrder(order),
          });
        }
        const updated = await prisma.$transaction(async (tx) => {
          for (const item of order.items) {
            await tx.variant.update({ where: { id: item.variantId }, data: { stockQty: { increment: item.quantity } } });
          }
          return tx.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Khách huỷ qua chatbot' },
            include: orderInclude,
          });
        });
        return res.json({ role: 'assistant', content: `Mình đã huỷ đơn ${code} giúp bạn.`, order: toOrder(updated) });
      }

      return res.json({
        role: 'assistant',
        content: `Đơn ${code} hiện đang ở trạng thái ${order.status}.`,
        order: toOrder(order),
      });
    }

    if (wantsCancel) {
      return res.json({ role: 'assistant', content: 'Bạn cho mình mã đơn cần huỷ nhé, dạng ORD-20260915-0001.' });
    }

    if (lower.includes('size')) {
      return res.json({
        role: 'assistant',
        content: 'Bạn cho mình biết chiều cao/cân nặng để tư vấn size chính xác hơn nhé. Thông thường 1m60-1m68, 50-58kg hợp size M.',
      });
    }

    const products = await prisma.product.findMany({ include: productInclude });
    const ranked = products
      .map((p) => ({
        product: p,
        score: scoreProduct(message, [p.name, p.description, p.material, p.brand, p.category?.name]
          .filter(Boolean).join(' ')),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (ranked.length === 0) {
      return res.json({
        role: 'assistant',
        content: 'Mình chưa hiểu rõ ý bạn lắm, bạn mô tả kiểu dáng/chất liệu/mục đích sử dụng để mình gợi ý sản phẩm phù hợp hơn nhé.',
      });
    }

    res.json({
      role: 'assistant',
      content: 'Mình tìm được vài mẫu hợp ý bạn:',
      products: ranked.map((r) => toProductCard(r.product, Number(r.score.toFixed(2)))),
    });
  }),
);
