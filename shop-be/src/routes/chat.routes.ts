import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { toOrder, toProductCard } from '../lib/mappers';
import { isGreetingOrTooShort, scoreText, stripDiacritics } from '../lib/search';
import { addItemToCart, resolveCart } from '../lib/cart';
import { ApiError } from '../lib/apiError';

export const chatRouter = Router();

const productInclude = { images: true, category: true } as const;
const orderInclude = { items: true, shippingMethod: true, discountCode: true } as const;

const ORDER_CODE_RE = /ORD-\d{8}-\d{4}/i;

/** Chi coi la ket qua "trung" khi it nhat mot nua so tu trong cau nguoi dung xuat hien o san pham. */
const MIN_MATCH_SCORE = 0.5;

const BUY_VERBS = ['lay', 'mua', 'dat', 'order', 'chot', 'chot don', 'cho minh', 'cho toi'];
const CANCEL_WORDS = ['khoi', 'thoi khoi', 'bo di', 'huy', 'khong lay', 'doi y', 'thoi', 'bo'];

function hasAnyFlat(flat: string, words: string[]): boolean {
  return words.some((w) => flat.includes(w));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findWholeWord(haystackLower: string, token: string): boolean {
  const re = new RegExp(`(^|[^\\p{L}0-9])${escapeRegExp(token.toLowerCase())}([^\\p{L}0-9]|$)`, 'iu');
  return re.test(haystackLower);
}

const contextSchema = z
  .object({
    productId: z.number().int().positive().optional(),
    lastCartItemId: z.number().int().positive().optional(),
  })
  .optional();

const chatSchema = z.object({
  message: z.string().min(1),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).optional(),
  context: contextSchema,
});

chatRouter.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const body = chatSchema.parse(req.body);
    const message = body.message.trim();
    const lower = message.toLowerCase();
    const flat = stripDiacritics(lower);
    const context = body.context ?? {};

    const orderCodeMatch = ORDER_CODE_RE.exec(message);
    const wantsCancelWord = hasAnyFlat(flat, ['huy']);

    // ---------- 1. Tra cuu / huy don qua MA DON ----------
    if (orderCodeMatch) {
      const code = orderCodeMatch[0].toUpperCase();
      const order = await prisma.order.findUnique({ where: { code }, include: orderInclude });
      if (!order) {
        return res.json({ role: 'assistant', content: `Mình không tìm thấy đơn ${code}, bạn kiểm tra lại mã giúp mình nhé.`, context });
      }
      const owned = req.userId ? order.userId === req.userId : order.sessionId === req.sessionId;
      if (!owned) {
        return res.json({ role: 'assistant', content: `Mình không tìm thấy đơn ${code} thuộc tài khoản của bạn.`, context });
      }

      if (wantsCancelWord) {
        if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
          return res.json({
            role: 'assistant',
            content: `Đơn ${code} đã giao cho vận chuyển nên không huỷ được nữa.`,
            order: toOrder(order),
            context,
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
        return res.json({ role: 'assistant', content: `Mình đã huỷ đơn ${code} giúp bạn.`, order: toOrder(updated), context });
      }

      return res.json({
        role: 'assistant',
        content: `Đơn ${code} hiện đang ở trạng thái ${order.status}.`,
        order: toOrder(order),
        context,
      });
    }

    // ---------- 2. Doi y ngay sau khi bot vua them vao gio ----------
    if (context.lastCartItemId && hasAnyFlat(flat, CANCEL_WORDS)) {
      await prisma.cartItem.deleteMany({ where: { id: context.lastCartItemId } });
      return res.json({
        role: 'assistant',
        content: 'Mình đã bỏ sản phẩm đó khỏi giỏ hàng giúp bạn. Cần gì thêm thì cứ nhắn mình nhé.',
        cartUpdated: true,
        context: { productId: context.productId },
      });
    }

    // ---------- 3. Y dinh mua hang (can biet dang noi ve san pham nao) ----------
    if (context.productId && hasAnyFlat(flat, BUY_VERBS)) {
      const product = await prisma.product.findUnique({
        where: { id: context.productId },
        include: { variants: true },
      });

      if (product) {
        const sizeToken = [...new Set(product.variants.map((v) => v.size))].find((size) =>
          findWholeWord(lower, size),
        );

        if (sizeToken) {
          const colorToken = [...new Set(product.variants.map((v) => v.color))].find((color) =>
            flat.includes(stripDiacritics(color.toLowerCase())),
          );
          const candidates = product.variants.filter(
            (v) => v.size === sizeToken && (!colorToken || v.color.toLowerCase() === colorToken.toLowerCase()),
          );
          const variant = candidates[0] ?? product.variants.find((v) => v.size === sizeToken) ?? null;

          const qtyMatch = message.match(/(\d+)\s*(cái|chiếc|c\b)?/i);
          const quantity = qtyMatch ? Math.max(1, parseInt(qtyMatch[1], 10)) : 1;

          if (!variant) {
            return res.json({
              role: 'assistant',
              content: `Mình chưa thấy size ${sizeToken} cho "${product.name}", bạn xem lại giúp mình nhé.`,
              context,
            });
          }
          if (variant.stockQty < quantity) {
            return res.json({
              role: 'assistant',
              content: `Size ${variant.size}${variant.color ? ` màu ${variant.color}` : ''} chỉ còn ${variant.stockQty} sản phẩm thôi, bạn lấy ít hơn nhé.`,
              context,
            });
          }

          try {
            const cart = await resolveCart(req);
            const item = await addItemToCart(cart.id, variant.id, quantity);
            return res.json({
              role: 'assistant',
              content: `Mình đã thêm ${quantity} "${product.name}" — màu ${variant.color}, size ${variant.size} vào giỏ hàng cho bạn. Vào giỏ hàng để thanh toán nhé! Đổi ý thì cứ nhắn "huỷ" giúp mình.`,
              cartUpdated: true,
              context: { productId: product.id, lastCartItemId: item.id },
            });
          } catch (e) {
            if (e instanceof ApiError) {
              return res.json({ role: 'assistant', content: e.message, context });
            }
            throw e;
          }
        }
      }
    }

    // ---------- 4. Muon huy nhung khong co ma don / khong ro muc nao ----------
    if (wantsCancelWord) {
      return res.json({
        role: 'assistant',
        content: 'Bạn cho mình mã đơn cần huỷ nhé, dạng ORD-20260915-0001 — hoặc nếu vừa nhờ mình thêm giỏ hàng thì nhắn "huỷ" ngay sau đó là được.',
        context,
      });
    }

    // ---------- 5. Hoi tu van size chung chung ----------
    if (lower.includes('size')) {
      return res.json({
        role: 'assistant',
        content: 'Bạn cho mình biết chiều cao/cân nặng để tư vấn size chính xác hơn nhé. Thông thường 1m60-1m68, 50-58kg hợp size M.',
        context,
      });
    }

    // ---------- 6. Loi chao / cau qua ngan ----------
    if (isGreetingOrTooShort(message)) {
      return res.json({
        role: 'assistant',
        content: 'Chào bạn! Bạn đang tìm món gì, hay cần mình tra cứu/huỷ đơn hàng thì cứ nói cụ thể hơn cho mình nhé.',
        context,
      });
    }

    // ---------- 7. Tim san pham theo mo ta ----------
    const products = await prisma.product.findMany({ include: productInclude });
    const ranked = products
      .map((p) => ({
        product: p,
        score: scoreText(message, [p.name, p.description, p.material, p.brand, p.category?.name]
          .filter(Boolean).join(' ')),
      }))
      .filter((r) => r.score >= MIN_MATCH_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (ranked.length === 0) {
      return res.json({
        role: 'assistant',
        content: 'Mình chưa hiểu rõ ý bạn lắm, bạn mô tả kiểu dáng/chất liệu/mục đích sử dụng để mình gợi ý sản phẩm phù hợp hơn nhé.',
        context,
      });
    }

    res.json({
      role: 'assistant',
      content: 'Mình tìm được vài mẫu hợp ý bạn:',
      products: ranked.map((r) => toProductCard(r.product, Number(r.score.toFixed(2)))),
      context: { productId: ranked[0].product.id },
    });
  }),
);
