import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { toOrder, toProductCard } from '../lib/mappers';
import { isGreetingOrTooShort, scoreText, stripDiacritics } from '../lib/search';
import { addItemToCart, resolveCart } from '../lib/cart';
import { ApiError } from '../lib/apiError';
import { parseHeightCm, parseWeightKg, recommendSize, nearestAvailableSize } from '../lib/sizeAdvice';
import { computeMonthlyStats } from '../lib/monthlyStats';

export const chatRouter = Router();

const productInclude = { images: true, category: true } as const;
const orderInclude = { items: true, shippingMethod: true, discountCode: true } as const;

const ORDER_CODE_RE = /ORD-\d{8}-\d{4}/i;

/** Chi coi la ket qua "trung" khi it nhat mot nua so tu trong cau nguoi dung xuat hien o san pham. */
const MIN_MATCH_SCORE = 0.5;
/** Nguong cao hon danh cho xoa san pham — tranh xoa nham vi khop mo ho. */
const DELETE_MATCH_SCORE = 0.6;

const BUY_VERBS = ['lay', 'mua', 'dat', 'order', 'chot', 'chot don', 'cho minh', 'cho toi'];
const CANCEL_WORDS = ['khoi', 'thoi khoi', 'bo di', 'huy', 'khong lay', 'doi y', 'thoi', 'bo'];
const YES_WORDS = ['dong y', 'xac nhan', 'ok', 'oke', 'okie', 'duoc', 'chot', 'u', 'um', 'co'];
const NO_WORDS = ['khong dong y', 'khong', 'huy', 'thoi', 'k'];
const DELETE_TRIGGER = ['xoa san pham', 'xoa'];
const REPORT_TRIGGER = ['bao cao', 'doanh thu', 'tong ket', 'thong ke'];

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

/** Tu don le dung whole-word (tranh "k" khop vao giua tu khac), cum nhieu tu dung substring. */
function matchesAnyWord(flat: string, words: string[]): boolean {
  return words.some((w) => (w.includes(' ') ? flat.includes(w) : findWholeWord(flat, w)));
}

/**
 * Bo cac tu "lenh mua" (dong tu mua, size, so luong, tu "mau") khoi cau truoc khi
 * so khop ten san pham — khong thi 1 cau vua neu y dinh mua vua neu ten san pham
 * (vd "lay 2 cai ao thun mau trang size M") se bi loang diem vi qua nhieu tu thua.
 */
function stripBuyNoise(flat: string): string {
  let s = flat;
  for (const w of BUY_VERBS) s = s.replace(new RegExp(`\\b${escapeRegExp(w)}\\b`, 'gi'), ' ');
  s = s.replace(/\bsize\s*\w+\b/gi, ' ');
  s = s.replace(/\d+\s*(cai|chiec|c)\b/gi, ' ');
  s = s.replace(/\bmau\b/gi, ' ');
  return s;
}

function isStaff(role: string | undefined): boolean {
  return role === 'EMPLOYEE' || role === 'MANAGER';
}

const pendingConfirmSchema = z.union([
  z.object({
    kind: z.literal('ADD_TO_CART'),
    variantId: z.number().int().positive(),
    quantity: z.number().int().positive(),
    productName: z.string(),
    size: z.string(),
    color: z.string(),
  }),
  z.object({
    kind: z.literal('DELETE_PRODUCT'),
    productId: z.number().int().positive(),
    productName: z.string(),
  }),
]);

const contextSchema = z
  .object({
    productId: z.number().int().positive().optional(),
    lastCartItemId: z.number().int().positive().optional(),
    recommendedSize: z.string().optional(),
    pendingConfirm: pendingConfirmSchema.optional(),
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
    let context = body.context ?? {};

    const orderCodeMatch = ORDER_CODE_RE.exec(message);
    const wantsCancelWord = hasAnyFlat(flat, ['huy']);

    // ---------- 0. Tra loi cau hoi xac nhan (dong y / khong) vua hoi luot truoc ----------
    if (context.pendingConfirm) {
      const pending = context.pendingConfirm;
      const isYes = matchesAnyWord(flat, YES_WORDS);
      const isNo = matchesAnyWord(flat, NO_WORDS);

      if (isYes || isNo) {
        const { pendingConfirm: _drop, ...restContext } = context;

        if (!isYes) {
          return res.json({
            role: 'assistant',
            content: pending.kind === 'ADD_TO_CART' ? 'Đã huỷ, mình không thêm vào giỏ hàng nhé.' : 'Đã huỷ, mình không xoá sản phẩm đó.',
            context: restContext,
          });
        }

        if (pending.kind === 'ADD_TO_CART') {
          try {
            const cart = await resolveCart(req);
            const item = await addItemToCart(cart.id, pending.variantId, pending.quantity);
            return res.json({
              role: 'assistant',
              content: `Mình đã thêm ${pending.quantity} "${pending.productName}" — màu ${pending.color}, size ${pending.size} vào giỏ hàng cho bạn. Vào giỏ hàng để thanh toán nhé! Đổi ý thì cứ nhắn "huỷ" giúp mình.`,
              cartUpdated: true,
              context: { ...restContext, lastCartItemId: item.id },
            });
          } catch (e) {
            if (e instanceof ApiError) {
              return res.json({ role: 'assistant', content: e.message, context: restContext });
            }
            throw e;
          }
        }

        if (pending.kind === 'DELETE_PRODUCT' && isStaff(req.userRole)) {
          try {
            await prisma.product.delete({ where: { id: pending.productId } });
            return res.json({
              role: 'assistant',
              content: `Mình đã xoá sản phẩm "${pending.productName}" khỏi hệ thống.`,
              context: restContext,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : '';
            const isFk =
              (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') ||
              msg.includes('foreign key constraint');
            return res.json({
              role: 'assistant',
              content: isFk
                ? `"${pending.productName}" đã có trong đơn hàng nên không xoá được, bạn ẩn/ngừng bán thay vì xoá nhé.`
                : `Có lỗi khi xoá "${pending.productName}", bạn thử lại giúp mình.`,
              context: restContext,
            });
          }
        }

        return res.json({ role: 'assistant', content: 'Mình chưa xử lý được yêu cầu này.', context: restContext });
      }

      // Khach noi sang chuyen khac -> bo qua cau hoi xac nhan cu, xu ly binh thuong.
      const { pendingConfirm: _drop, ...restContext } = context;
      context = restContext;
    }

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

    // ---------- 3. Bao cao thang (chi MANAGER) ----------
    if (req.userRole === 'MANAGER' && hasAnyFlat(flat, REPORT_TRIGGER)) {
      const now = new Date();
      const isPrevMonth = hasAnyFlat(flat, ['thang truoc']);
      const target = new Date(now.getFullYear(), now.getMonth() - (isPrevMonth ? 1 : 0), 1);
      const month = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
      const stats = await computeMonthlyStats(month);

      const top3 = stats.topProducts
        .slice(0, 3)
        .map((p, i) => `${i + 1}. ${p.productName} — ${p.quantitySold} sp, ${p.revenue.toLocaleString('vi-VN')}đ`)
        .join('\n');
      const changeText =
        stats.revenueChangePct == null
          ? ''
          : ` (${stats.revenueChangePct >= 0 ? '+' : ''}${stats.revenueChangePct}% so với tháng trước)`;

      return res.json({
        role: 'assistant',
        content:
          `Báo cáo tháng ${month}:\n` +
          `- Doanh thu: ${stats.totalRevenue.toLocaleString('vi-VN')}đ${changeText}\n` +
          `- Đơn hàng: ${stats.totalOrders} (huỷ: ${stats.cancelledOrders})\n` +
          `- Giá trị đơn TB: ${stats.avgOrderValue.toLocaleString('vi-VN')}đ\n` +
          (top3 ? `- Bán chạy nhất:\n${top3}` : '- Chưa có sản phẩm nào bán ra tháng này.'),
        context,
      });
    }

    // ---------- 4. Xoa san pham (chi EMPLOYEE/MANAGER) ----------
    if (isStaff(req.userRole) && hasAnyFlat(flat, DELETE_TRIGGER)) {
      // Bo cum lenh ("xoa san pham"/"xoa") truoc khi so khop ten, khong thi diem bi loang.
      const nameOnly = DELETE_TRIGGER.reduce((s, w) => s.replace(new RegExp(escapeRegExp(w), 'gi'), ' '), lower);
      const products = await prisma.product.findMany({ include: productInclude });
      const ranked = products
        .map((p) => ({ product: p, score: scoreText(nameOnly, p.name) }))
        .filter((r) => r.score >= DELETE_MATCH_SCORE)
        .sort((a, b) => b.score - a.score);

      if (ranked.length === 0) {
        return res.json({
          role: 'assistant',
          content: 'Mình chưa xác định được sản phẩm nào để xoá, bạn nói rõ tên sản phẩm giúp mình nhé.',
          context,
        });
      }
      if (ranked.length > 1 && ranked[0].score - ranked[1].score < 0.15) {
        return res.json({
          role: 'assistant',
          content: 'Có vài sản phẩm trùng tên, bạn chọn đúng mẫu giúp mình:',
          products: ranked.slice(0, 3).map((r) => toProductCard(r.product)),
          context,
        });
      }

      const target = ranked[0].product;
      return res.json({
        role: 'assistant',
        content: `Xác nhận xoá sản phẩm "${target.name}" khỏi hệ thống? Không thể hoàn tác.`,
        confirm: true,
        context: { ...context, pendingConfirm: { kind: 'DELETE_PRODUCT', productId: target.id, productName: target.name } },
      });
    }

    // ---------- 5. Y dinh mua hang ----------
    if (hasAnyFlat(flat, BUY_VERBS)) {
      let productId = context.productId;

      // Chua co san pham dang noi (VD day la tin nhan dau tien) nhung cau da neu
      // luon ten san pham lan y dinh mua ("lấy 2 cái áo thun màu trắng size M") —
      // thu tim san pham ngay trong cau nay truoc khi hoi lai chung chung.
      if (!productId) {
        const candidates = await prisma.product.findMany({ include: productInclude });
        const searchRanked = candidates
          .map((p) => ({
            product: p,
            score: scoreText(stripBuyNoise(flat), [p.name, p.category?.name].filter(Boolean).join(' ')),
          }))
          .filter((r) => r.score >= MIN_MATCH_SCORE)
          .sort((a, b) => b.score - a.score);

        if (searchRanked.length === 1 || (searchRanked.length > 1 && searchRanked[0].score - searchRanked[1].score >= 0.15)) {
          productId = searchRanked[0].product.id;
        } else if (searchRanked.length > 1) {
          return res.json({
            role: 'assistant',
            content: 'Bạn muốn lấy mẫu nào trong số này?',
            products: searchRanked.slice(0, 3).map((r) => toProductCard(r.product)),
            context: { productId: searchRanked[0].product.id },
          });
        }
      }

      const product = productId
        ? await prisma.product.findUnique({ where: { id: productId }, include: { variants: true } })
        : null;

      if (product) {
        // Khach nhac ten 1 danh muc KHAC voi san pham dang noi -> dang hoi mon khac,
        // khong phai tiep tuc mua mon cu (vd dang xem Hoodie ma noi "mua áo thun").
        const categories = await prisma.category.findMany();
        const mentionedOtherCategory = categories.find(
          (c) => c.id !== product.categoryId && findWholeWord(flat, stripDiacritics(c.name.toLowerCase())),
        );

        if (!mentionedOtherCategory) {
          const availableSizes = [...new Set(product.variants.map((v) => v.size))];
          const explicitSizeToken = availableSizes.find((size) => findWholeWord(lower, size));
          // Khong noi size trong cau nhung truoc do bot da tu van (VD "1m72 83kg mac size gi") —
          // dung luon size da goi y thay vi bat khach lap lai.
          const sizeToken =
            explicitSizeToken ??
            (context.recommendedSize && availableSizes.includes(context.recommendedSize)
              ? context.recommendedSize
              : undefined);

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

            return res.json({
              role: 'assistant',
              content: `Xác nhận thêm ${quantity} "${product.name}" — màu ${variant.color}, size ${variant.size} vào giỏ hàng nhé?`,
              confirm: true,
              context: {
                ...context,
                pendingConfirm: {
                  kind: 'ADD_TO_CART',
                  variantId: variant.id,
                  quantity,
                  productName: product.name,
                  size: variant.size,
                  color: variant.color,
                },
              },
            });
          }
        }
      }
    }

    // ---------- 6. Muon huy nhung khong co ma don / khong ro muc nao ----------
    if (wantsCancelWord) {
      return res.json({
        role: 'assistant',
        content: 'Bạn cho mình mã đơn cần huỷ nhé, dạng ORD-20260915-0001 — hoặc nếu vừa nhờ mình thêm giỏ hàng thì nhắn "huỷ" ngay sau đó là được.',
        context,
      });
    }

    // ---------- 7. Tu van size theo chieu cao/can nang ----------
    const heightCm = parseHeightCm(lower);
    const weightKg = parseWeightKg(lower);
    if (lower.includes('size') || heightCm != null || weightKg != null) {
      if (heightCm == null && weightKg == null) {
        return res.json({
          role: 'assistant',
          content: 'Bạn cho mình biết chiều cao/cân nặng để tư vấn size chính xác hơn nhé. Thông thường 1m60-1m68, 50-58kg hợp size M.',
          context,
        });
      }

      let estimated = recommendSize(heightCm, weightKg);
      let productNote = '';

      if (context.productId && estimated) {
        const product = await prisma.product.findUnique({
          where: { id: context.productId },
          include: { variants: true },
        });
        if (product) {
          const availableSizes = [...new Set(product.variants.map((v) => v.size))];
          const adjusted = nearestAvailableSize(estimated, availableSizes);
          if (adjusted) {
            if (adjusted !== estimated) productNote = ` ("${product.name}" hiện chỉ có tới size ${adjusted})`;
            estimated = adjusted;
          }
        }
      }

      const missingHint =
        heightCm == null ? ' Cho mình thêm chiều cao thì tư vấn chuẩn hơn nhé.'
        : weightKg == null ? ' Cho mình thêm cân nặng thì tư vấn chuẩn hơn nhé.'
        : '';

      return res.json({
        role: 'assistant',
        content: `Theo số đo bạn đưa, mình nghĩ bạn hợp size ${estimated}${productNote} (đây là ước lượng chung, có thể lệch đôi chút tuỳ form áo).${missingHint} Ưng size này thì cứ nhắn "lấy" kèm màu/số lượng là mình lên đơn liền.`,
        context: { ...context, recommendedSize: estimated ?? undefined },
      });
    }

    // ---------- 8. Loi chao / cau qua ngan ----------
    if (isGreetingOrTooShort(message)) {
      return res.json({
        role: 'assistant',
        content: 'Chào bạn! Bạn đang tìm món gì, hay cần mình tra cứu/huỷ đơn hàng thì cứ nói cụ thể hơn cho mình nhé.',
        context,
      });
    }

    // ---------- 9. Tim san pham theo mo ta ----------
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
