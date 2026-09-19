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
import { createProductFromDraft } from '../lib/products';
import { isStaff, isManagerRole } from '../lib/roles';
import { uniqueSlug } from '../lib/slug';

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
const HIDE_TRIGGER = ['an san pham', 'ngung ban', 'tam ngung ban'];
const SHOW_TRIGGER = ['hien san pham', 'mo ban lai', 'ban lai san pham', 'kich hoat lai'];
const STOCK_TRIGGER = ['cap nhat ton kho', 'sua ton kho', 'chinh ton kho', 'them ton kho'];
const ADD_PRODUCT_TRIGGER = ['them san pham', 'dang san pham', 'tao san pham moi', 'them mau moi'];
const AUDIENCE_VI: Record<string, string> = { MEN: 'Nam', WOMEN: 'Nữ', KIDS: 'Trẻ em', UNISEX: 'Unisex' };

function hasAnyFlat(flat: string, words: string[]): boolean {
  return words.some((w) => flat.includes(w));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Bo cum lenh ("xoa san pham", "an san pham"...) va tu chung ("san pham", "mau") khoi cau da bo dau,
 * chi de lai ten san pham de so khop — neu khong cac tu lenh se lam loang diem trung khop. */
function commandFreeName(flat: string, triggers: string[]): string {
  const sorted = [...triggers].sort((a, b) => b.length - a.length);
  const stripped = sorted.reduce((s, w) => s.replace(new RegExp(`(^|\\s)${escapeRegExp(w)}(?=\\s|$)`, 'g'), ' '), flat);
  return stripped.replace(/\b(san pham|mau)\b/g, ' ');
}

function findWholeWord(haystackLower: string, token: string): boolean {
  const re = new RegExp(`(^|[^\\p{L}0-9])${escapeRegExp(token.toLowerCase())}([^\\p{L}0-9]|$)`, 'iu');
  return re.test(haystackLower);
}

/** Tu don le dung whole-word (tranh "k" khop vao giua tu khac), cum nhieu tu dung substring. */
function matchesAnyWord(flat: string, words: string[]): boolean {
  return words.some((w) => (w.includes(' ') ? flat.includes(w) : findWholeWord(flat, w)));
}

/** "tao moi danh muc Sweater" / "them loai Ao len" -> "Sweater" / "Ao len" (giu nguyen dau & hoa thuong
 * cua khach). Cat theo tung tu vi stripDiacritics giu nguyen so tu, nen tu thu i cua 2 ban khop nhau. */
function extractNewCategoryName(message: string, flat: string): string | null {
  const orig = message.trim().split(/\s+/);
  const f = flat.trim().split(/\s+/);
  const verbAt = f.findIndex((w) => ['tao', 'them'].includes(w));
  if (verbAt === -1) return null;
  let i = verbAt + 1;
  while (['moi', 'mot', 'them'].includes(f[i])) i++;
  if (f[i] === 'danh' && f[i + 1] === 'muc') i += 2;
  else if (f[i] === 'loai') i += 1;
  else return null;
  while (['moi', 'la', 'ten'].includes(f[i])) i++;
  const name = orig.slice(i).join(' ').replace(/^[:\-"“]+|["”.]+$/g, '').trim();
  return name && name.length <= 40 ? name : null;
}

/** Doan nhom menu (Ao/Quan/Vay & Dam/Phu kien) tu ten danh muc; khong doan duoc -> null (hien o "Khac"). */
function guessCategoryGroup(name: string): 'Áo' | 'Quần' | 'Váy & Đầm' | 'Phụ kiện' | null {
  const flat = stripDiacritics(name.toLowerCase());
  if (/\b(quan|jean|short|jogger|kaki)\b/.test(flat)) return 'Quần';
  if (/\b(vay|dam)\b/.test(flat)) return 'Váy & Đầm';
  if (/\b(ao|sweater|hoodie|polo|cardigan|len)\b/.test(flat)) return 'Áo';
  if (/\b(non|mu|tui|that lung|day lung|vo|khan|kinh|phu kien)\b/.test(flat)) return 'Phụ kiện';
  return null;
}

/** Tao danh muc moi tu chat; da co ten trung (khong phan biet hoa thuong/dau) thi dung lai cai cu. */
async function findOrCreateCategory(name: string): Promise<{ category: { id: number; name: string; group: string | null }; created: boolean }> {
  const all = await prisma.category.findMany();
  const key = stripDiacritics(name.toLowerCase());
  const existing = all.find((c) => stripDiacritics(c.name.toLowerCase()) === key);
  if (existing) return { category: existing, created: false };
  const slug = await uniqueSlug(name, async (s) => !!(await prisma.category.findUnique({ where: { slug: s } })));
  const category = await prisma.category.create({ data: { name, slug, group: guessCategoryGroup(name) } });
  return { category, created: true };
}

function newCategoryNote(c: { name: string; group: string | null }): string {
  return `Mình đã tạo danh mục "${c.name}"` +
    (c.group ? ` (nhóm ${c.group} trên menu)` : ' (chưa xếp nhóm, sẽ nằm ở mục "Khác" — bạn xếp nhóm ở trang Danh mục nhé)');
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

/** "250000" hoac "250k" -> 250000. */
function parsePriceVnd(message: string): number | null {
  const m = message.replace(/\./g, '').match(/(\d+)\s*(k)?/i);
  if (!m) return null;
  let n = parseInt(m[1], 10);
  if (m[2]) n *= 1000;
  return n > 0 ? n : null;
}

function parseAudience(flat: string): 'MEN' | 'WOMEN' | 'KIDS' | 'UNISEX' | null {
  if (findWholeWord(flat, 'unisex') || flat.includes('ca hai') || flat.includes('khong phan biet')) return 'UNISEX';
  if (flat.includes('tre em') || flat.includes('tre con')) return 'KIDS';
  if (findWholeWord(flat, 'nu')) return 'WOMEN';
  if (findWholeWord(flat, 'nam')) return 'MEN';
  return null;
}

/** Lay so muc tieu trong cau lenh cap nhat ton kho — uu tien so ngay sau
 * "thanh"/"len"/"la"/"con lai", khong thi lay so cuoi cung (tranh nham voi "2xl"/"3xl"). */
function extractQuantity(flat: string): number | null {
  const explicit = /(?:thanh|len|la|con lai)\s*(\d+)\b/.exec(flat);
  if (explicit) return parseInt(explicit[1], 10);
  const all = [...flat.matchAll(/(\d+)(?!xl)\b/g)];
  if (all.length > 0) return parseInt(all[all.length - 1][1], 10);
  return null;
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
  z.object({
    kind: z.literal('TOGGLE_ACTIVE'),
    productId: z.number().int().positive(),
    productName: z.string(),
    active: z.boolean(),
  }),
  z.object({
    kind: z.literal('UPDATE_STOCK'),
    variantId: z.number().int().positive(),
    quantity: z.number().int().min(0),
    productName: z.string(),
    size: z.string(),
    color: z.string(),
  }),
  z.object({
    kind: z.literal('CREATE_PRODUCT'),
    name: z.string(),
    categoryId: z.number().int().positive(),
    basePrice: z.number().int().positive(),
    audience: z.enum(['MEN', 'WOMEN', 'KIDS', 'UNISEX']),
    material: z.string().optional(),
    description: z.string().optional(),
    colors: z.array(z.string()).min(1),
    sizes: z.array(z.string()).min(1),
    stockQty: z.number().int().min(0),
    images: z.array(z.object({ url: z.string() })).min(1),
  }),
]);

/** Trang thai dang thu thap thong tin de dang san pham moi qua chat — moi buoc
 * chi dien them 1 truong, giu nguyen cac truong da co truoc do. */
const productDraftSchema = z.object({
  step: z.enum(['NAME', 'CATEGORY', 'PRICE', 'AUDIENCE', 'MATERIAL', 'DESCRIPTION', 'COLOR', 'SIZE', 'STOCK', 'IMAGE']),
  name: z.string().optional(),
  categoryId: z.number().int().positive().optional(),
  categoryName: z.string().optional(),
  basePrice: z.number().int().positive().optional(),
  audience: z.enum(['MEN', 'WOMEN', 'KIDS', 'UNISEX']).optional(),
  material: z.string().optional(),
  description: z.string().optional(),
  colors: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  stockQty: z.number().int().min(0).optional(),
  images: z.array(z.object({ url: z.string() })).optional(),
});

const contextSchema = z
  .object({
    productId: z.number().int().positive().optional(),
    lastCartItemId: z.number().int().positive().optional(),
    recommendedSize: z.string().optional(),
    pendingConfirm: pendingConfirmSchema.optional(),
    pendingProduct: productDraftSchema.optional(),
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
            content:
              pending.kind === 'ADD_TO_CART' ? 'Đã huỷ, mình không thêm vào giỏ hàng nhé.'
              : pending.kind === 'CREATE_PRODUCT' ? 'Đã huỷ, mình không đăng sản phẩm này nữa.'
              : 'Đã huỷ, mình không xoá sản phẩm đó.',
            context: restContext,
          });
        }

        if (pending.kind === 'ADD_TO_CART' && isStaff(req.userRole)) {
          return res.json({
            role: 'assistant',
            content: 'Tài khoản nhân viên không dùng chức năng mua hàng/thêm giỏ hàng nhé.',
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
            await prisma.product.update({ where: { id: pending.productId }, data: { deletedAt: new Date(), active: false } });
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

        if (pending.kind === 'TOGGLE_ACTIVE' && isStaff(req.userRole)) {
          await prisma.product.update({ where: { id: pending.productId }, data: { active: pending.active } });
          return res.json({
            role: 'assistant',
            content: pending.active
              ? `Mình đã hiện lại sản phẩm "${pending.productName}" để bán công khai.`
              : `Mình đã ẩn sản phẩm "${pending.productName}" — khách sẽ không thấy sản phẩm này nữa.`,
            context: restContext,
          });
        }

        if (pending.kind === 'UPDATE_STOCK' && isStaff(req.userRole)) {
          await prisma.variant.update({ where: { id: pending.variantId }, data: { stockQty: pending.quantity } });
          return res.json({
            role: 'assistant',
            content: `Mình đã cập nhật tồn kho "${pending.productName}" — màu ${pending.color}, size ${pending.size} thành ${pending.quantity}.`,
            context: restContext,
          });
        }

        if (pending.kind === 'CREATE_PRODUCT' && isStaff(req.userRole)) {
          try {
            const product = await createProductFromDraft({
              name: pending.name,
              categoryId: pending.categoryId,
              basePrice: pending.basePrice,
              audience: pending.audience,
              material: pending.material,
              description: pending.description,
              colors: pending.colors,
              sizes: pending.sizes,
              stockQty: pending.stockQty,
              images: pending.images,
            });
            return res.json({
              role: 'assistant',
              content: `Mình đã đăng sản phẩm "${product.name}" lên trang rồi! Vào trang quản trị nếu muốn chỉnh sửa thêm nhé.`,
              products: [toProductCard(product)],
              context: restContext,
            });
          } catch {
            return res.json({
              role: 'assistant',
              content: 'Có lỗi khi đăng sản phẩm, bạn thử lại hoặc đăng qua trang quản trị giúp mình nhé.',
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

    // ---------- 0.5. Dang thu thap thong tin de dang san pham moi (chi EMPLOYEE/MANAGER) ----------
    if (context.pendingProduct && isStaff(req.userRole)) {
      const draft = context.pendingProduct;

      if (matchesAnyWord(flat, ['huy'])) {
        const { pendingProduct: _drop, ...restContext } = context;
        return res.json({ role: 'assistant', content: 'Đã huỷ, mình không đăng sản phẩm này nữa.', context: restContext });
      }

      const wantsSkip = matchesAnyWord(flat, ['bo qua', 'khong co']);

      if (draft.step === 'NAME') {
        const name = message.trim();
        if (!name) {
          return res.json({ role: 'assistant', content: 'Bạn cho mình tên sản phẩm giúp nhé.', context });
        }
        const categories = await prisma.category.findMany();
        return res.json({
          role: 'assistant',
          content: `Sản phẩm "${name}" thuộc danh mục nào? Hiện có: ${categories.map((c) => c.name).join(', ')}.`,
          context: { ...context, pendingProduct: { ...draft, step: 'CATEGORY', name } },
        });
      }

      if (draft.step === 'CATEGORY') {
        const categories = await prisma.category.findMany();
        const newName = extractNewCategoryName(message, flat);
        if (newName) {
          const { category, created } = await findOrCreateCategory(newName);
          return res.json({
            role: 'assistant',
            content: `${created ? newCategoryNote(category) : `Danh mục "${category.name}" đã có sẵn, mình dùng luôn`}. Giá bán "${draft.name}" là bao nhiêu?`,
            context: { ...context, pendingProduct: { ...draft, step: 'PRICE', categoryId: category.id, categoryName: category.name } },
          });
        }
        // Tim danh muc dai nhat khop truoc, tranh "Ao" khop nham vao "Ao khoac".
        const matched = [...categories]
          .sort((a, b) => b.name.length - a.name.length)
          .find((c) => findWholeWord(flat, stripDiacritics(c.name.toLowerCase())));
        if (!matched) {
          return res.json({
            role: 'assistant',
            content:
              `Mình chưa nhận ra danh mục đó, bạn chọn giúp 1 trong: ${categories.map((c) => c.name).join(', ')}. ` +
              'Hoặc nhắn "tạo mới danh mục <tên>" (VD: tạo mới danh mục Sweater) để mình tạo luôn.',
            context,
          });
        }
        return res.json({
          role: 'assistant',
          content: `Giá bán "${draft.name}" là bao nhiêu?`,
          context: { ...context, pendingProduct: { ...draft, step: 'PRICE', categoryId: matched.id, categoryName: matched.name } },
        });
      }

      if (draft.step === 'PRICE') {
        const price = parsePriceVnd(message);
        if (!price) {
          return res.json({ role: 'assistant', content: 'Bạn cho mình giá bán cụ thể giúp nhé (VD: 250000 hoặc 250k).', context });
        }
        return res.json({
          role: 'assistant',
          content: 'Sản phẩm dành cho đối tượng nào — Nam, Nữ, Trẻ em, hay Unisex?',
          context: { ...context, pendingProduct: { ...draft, step: 'AUDIENCE', basePrice: price } },
        });
      }

      if (draft.step === 'AUDIENCE') {
        const audience = parseAudience(flat);
        if (!audience) {
          return res.json({ role: 'assistant', content: 'Bạn chọn giúp mình: Nam, Nữ, Trẻ em, hay Unisex?', context });
        }
        return res.json({
          role: 'assistant',
          content: 'Chất liệu là gì? (nhắn "bỏ qua" nếu không cần ghi)',
          context: { ...context, pendingProduct: { ...draft, step: 'MATERIAL', audience } },
        });
      }

      if (draft.step === 'MATERIAL') {
        const material = wantsSkip ? undefined : message.trim();
        return res.json({
          role: 'assistant',
          content: 'Mô tả ngắn về sản phẩm? (nhắn "bỏ qua" nếu không cần)',
          context: { ...context, pendingProduct: { ...draft, step: 'DESCRIPTION', material } },
        });
      }

      if (draft.step === 'DESCRIPTION') {
        const description = wantsSkip ? undefined : message.trim();
        return res.json({
          role: 'assistant',
          content: 'Sản phẩm có những màu nào? (cách nhau bằng dấu phẩy, VD: Đen, Trắng, Xám)',
          context: { ...context, pendingProduct: { ...draft, step: 'COLOR', description } },
        });
      }

      if (draft.step === 'COLOR') {
        const colors = message.split(',').map((s) => s.trim()).filter(Boolean);
        if (colors.length === 0) {
          return res.json({ role: 'assistant', content: 'Bạn cho mình ít nhất 1 màu giúp nhé.', context });
        }
        return res.json({
          role: 'assistant',
          content: 'Có những size nào? (cách nhau bằng dấu phẩy, VD: S, M, L, XL)',
          context: { ...context, pendingProduct: { ...draft, step: 'SIZE', colors } },
        });
      }

      if (draft.step === 'SIZE') {
        const sizes = message.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
        if (sizes.length === 0) {
          return res.json({ role: 'assistant', content: 'Bạn cho mình ít nhất 1 size giúp nhé.', context });
        }
        return res.json({
          role: 'assistant',
          content: 'Mỗi màu/size để tồn kho bao nhiêu? (một số áp dụng cho tất cả, sửa lại từng ô sau cũng được)',
          context: { ...context, pendingProduct: { ...draft, step: 'STOCK', sizes } },
        });
      }

      if (draft.step === 'STOCK') {
        const stockMatch = flat.match(/\d+/);
        const stockQty = stockMatch ? parseInt(stockMatch[0], 10) : null;
        if (stockQty == null) {
          return res.json({ role: 'assistant', content: 'Bạn cho mình một số tồn kho cụ thể giúp nhé (VD: 20).', context });
        }
        return res.json({
          role: 'assistant',
          content: 'Gửi ảnh sản phẩm cho mình (bấm biểu tượng đính kèm cạnh ô nhắn). Cần ít nhất 1 ảnh — gửi xong thì nhắn "xong".',
          expectingImage: true,
          context: { ...context, pendingProduct: { ...draft, step: 'IMAGE', stockQty, images: [] } },
        });
      }

      if (draft.step === 'IMAGE') {
        const images = draft.images ?? [];
        const isDone = matchesAnyWord(flat, ['xong', 'het anh', 'du anh', 'hoan tat']);
        const looksLikeUrl = /^https?:\/\//i.test(message.trim());

        if (looksLikeUrl) {
          const nextImages = [...images, { url: message.trim() }];
          return res.json({
            role: 'assistant',
            content: `Đã nhận ảnh (${nextImages.length}). Gửi thêm ảnh khác hoặc nhắn "xong" khi đủ ảnh rồi.`,
            expectingImage: true,
            context: { ...context, pendingProduct: { ...draft, images: nextImages } },
          });
        }

        if (isDone) {
          if (images.length === 0) {
            return res.json({
              role: 'assistant',
              content: 'Cần ít nhất 1 ảnh để đăng sản phẩm — bạn gửi ảnh giúp mình nhé.',
              expectingImage: true,
              context,
            });
          }

          const summary =
            `Xác nhận đăng sản phẩm:\n` +
            `- Tên: ${draft.name}\n` +
            `- Danh mục: ${draft.categoryName}\n` +
            `- Giá: ${draft.basePrice?.toLocaleString('vi-VN')}đ\n` +
            `- Đối tượng: ${AUDIENCE_VI[draft.audience ?? 'UNISEX']}\n` +
            (draft.material ? `- Chất liệu: ${draft.material}\n` : '') +
            (draft.description ? `- Mô tả: ${draft.description}\n` : '') +
            `- Màu: ${draft.colors?.join(', ')}\n` +
            `- Size: ${draft.sizes?.join(', ')}\n` +
            `- Tồn kho mỗi biến thể: ${draft.stockQty}\n` +
            `- Số ảnh: ${images.length}`;

          const { pendingProduct: _drop, ...restContext } = context;
          return res.json({
            role: 'assistant',
            content: summary,
            confirm: true,
            context: {
              ...restContext,
              pendingConfirm: {
                kind: 'CREATE_PRODUCT',
                name: draft.name!,
                categoryId: draft.categoryId!,
                basePrice: draft.basePrice!,
                audience: draft.audience ?? 'UNISEX',
                material: draft.material,
                description: draft.description,
                colors: draft.colors!,
                sizes: draft.sizes!,
                stockQty: draft.stockQty!,
                images,
              },
            },
          });
        }

        return res.json({
          role: 'assistant',
          content: 'Bạn gửi link ảnh, hoặc nhắn "xong" khi đã đủ ảnh.',
          expectingImage: true,
          context,
        });
      }
    }

    // ---------- 0.9. Tao danh muc moi qua chat (chi EMPLOYEE/MANAGER) ----------
    if (isStaff(req.userRole)) {
      const newName = extractNewCategoryName(message, flat);
      if (newName) {
        const { category, created } = await findOrCreateCategory(newName);
        return res.json({
          role: 'assistant',
          content: created
            ? `${newCategoryNote(category)}. Nhắn "thêm sản phẩm" để đăng sản phẩm vào danh mục này nhé.`
            : `Danh mục "${category.name}" đã có sẵn rồi.`,
          context,
        });
      }
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
    if (isManagerRole(req.userRole) && hasAnyFlat(flat, REPORT_TRIGGER)) {
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
      const nameOnly = commandFreeName(flat, DELETE_TRIGGER);
      const products = await prisma.product.findMany({ where: { deletedAt: null }, include: productInclude });
      const ranked = products
        .map((p) => ({ product: p, score: scoreText(nameOnly, p.name) }))
        // Xoa la thao tac nguy hiem: bat buoc moi tu khach nhac deu nam trong ten san pham,
        // khong chap nhan khop 1 phan (tranh "ao thun nu" da xoa roi lai khop nham "Ao thun Unisex").
        .filter((r) => r.score >= 0.99)
        .sort((a, b) => b.score - a.score);

      if (ranked.length === 0) {
        return res.json({
          role: 'assistant',
          content: 'Mình không tìm thấy sản phẩm nào khớp hoàn toàn với tên bạn nói (có thể sản phẩm đã được xoá rồi). Bạn nói rõ tên sản phẩm giúp mình nhé.',
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
        content: `Xác nhận xoá sản phẩm "${target.name}" khỏi shop? Sản phẩm sẽ bị gỡ hoàn toàn (dữ liệu vẫn được lưu lại, không xoá cứng).`,
        confirm: true,
        context: { ...context, pendingConfirm: { kind: 'DELETE_PRODUCT', productId: target.id, productName: target.name } },
      });
    }

    // ---------- 4b. An/hien san pham (chi EMPLOYEE/MANAGER) ----------
    if (isStaff(req.userRole) && (hasAnyFlat(flat, HIDE_TRIGGER) || hasAnyFlat(flat, SHOW_TRIGGER))) {
      const wantsShow = hasAnyFlat(flat, SHOW_TRIGGER);
      const triggerWords = wantsShow ? SHOW_TRIGGER : HIDE_TRIGGER;
      const nameOnly = commandFreeName(flat, triggerWords);
      const products = await prisma.product.findMany({ where: { deletedAt: null }, include: productInclude });
      const ranked = products
        .map((p) => ({ product: p, score: scoreText(nameOnly, p.name) }))
        .filter((r) => r.score >= DELETE_MATCH_SCORE)
        .sort((a, b) => b.score - a.score);

      if (ranked.length === 0) {
        return res.json({
          role: 'assistant',
          content: 'Mình chưa xác định được sản phẩm nào, bạn nói rõ tên sản phẩm giúp mình nhé.',
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
        content: wantsShow
          ? `Xác nhận hiện lại sản phẩm "${target.name}" để bán công khai?`
          : `Xác nhận ẩn sản phẩm "${target.name}"? Khách sẽ không thấy sản phẩm này nữa (vẫn giữ nguyên dữ liệu, có thể hiện lại bất cứ lúc nào).`,
        confirm: true,
        context: { ...context, pendingConfirm: { kind: 'TOGGLE_ACTIVE', productId: target.id, productName: target.name, active: wantsShow } },
      });
    }

    // ---------- 4c. Cap nhat ton kho (chi EMPLOYEE/MANAGER) ----------
    if (isStaff(req.userRole) && hasAnyFlat(flat, STOCK_TRIGGER)) {
      const quantity = extractQuantity(flat);
      if (quantity == null) {
        return res.json({
          role: 'assistant',
          content: 'Bạn muốn cập nhật tồn kho thành bao nhiêu? Nhắn kiểu "cập nhật tồn kho áo thun TAHO màu đen size M thành 20" giúp mình nhé.',
          context,
        });
      }

      const nameOnly = commandFreeName(flat, STOCK_TRIGGER)
        .replace(/\bsize\s*\w+\b/gi, ' ')
        .replace(/(?:thanh|len|la|con lai)\s*\d+\b/gi, ' ');
      const products = await prisma.product.findMany({ where: { deletedAt: null }, include: { ...productInclude, variants: true } });
      const ranked = products
        .map((p) => ({ product: p, score: scoreText(nameOnly, p.name) }))
        .filter((r) => r.score >= DELETE_MATCH_SCORE)
        .sort((a, b) => b.score - a.score);

      if (ranked.length === 0) {
        return res.json({
          role: 'assistant',
          content: 'Mình chưa xác định được sản phẩm nào, bạn nói rõ tên sản phẩm giúp mình nhé.',
          context,
        });
      }

      const product = ranked[0].product;
      const availableSizes = [...new Set(product.variants.map((v) => v.size))];
      const availableColors = [...new Set(product.variants.map((v) => v.color))];
      const sizeToken = availableSizes.find((size) => findWholeWord(flat, stripDiacritics(size.toLowerCase())));
      const colorToken = availableColors.find((color) => flat.includes(stripDiacritics(color.toLowerCase())));

      let targetVariants = product.variants;
      if (sizeToken) targetVariants = targetVariants.filter((v) => v.size === sizeToken);
      if (colorToken) targetVariants = targetVariants.filter((v) => v.color.toLowerCase() === colorToken.toLowerCase());

      if (targetVariants.length === 0) {
        return res.json({
          role: 'assistant',
          content: `Mình không tìm thấy biến thể phù hợp cho "${product.name}", bạn kiểm tra lại size/màu giúp mình.`,
          context,
        });
      }
      if (targetVariants.length > 1) {
        return res.json({
          role: 'assistant',
          content: `"${product.name}" có nhiều biến thể (size: ${availableSizes.join(', ')}; màu: ${availableColors.join(', ')}) — bạn nói rõ size và màu giúp mình nhé.`,
          context: { ...context, productId: product.id },
        });
      }

      const variant = targetVariants[0];
      return res.json({
        role: 'assistant',
        content: `Xác nhận cập nhật tồn kho "${product.name}" — màu ${variant.color}, size ${variant.size} từ ${variant.stockQty} thành ${quantity}?`,
        confirm: true,
        context: {
          ...context,
          pendingConfirm: {
            kind: 'UPDATE_STOCK',
            variantId: variant.id,
            quantity,
            productName: product.name,
            size: variant.size,
            color: variant.color,
          },
        },
      });
    }

    // ---------- 4d. Bat dau dang san pham moi qua chat (chi EMPLOYEE/MANAGER) ----------
    if (isStaff(req.userRole) && hasAnyFlat(flat, ADD_PRODUCT_TRIGGER)) {
      return res.json({
        role: 'assistant',
        content: 'Mình sẽ hỏi vài câu để đăng sản phẩm mới nhé. Trước tiên, tên sản phẩm là gì?',
        context: { ...context, pendingProduct: { step: 'NAME' } },
      });
    }

    // ---------- 5. Y dinh mua hang ----------
    if (isStaff(req.userRole) && hasAnyFlat(flat, BUY_VERBS)) {
      return res.json({
        role: 'assistant',
        content: 'Tài khoản nhân viên không dùng chức năng mua hàng/thêm giỏ hàng nhé.',
        context,
      });
    }

    if (hasAnyFlat(flat, BUY_VERBS)) {
      let productId = context.productId;

      // Chua co san pham dang noi (VD day la tin nhan dau tien) nhung cau da neu
      // luon ten san pham lan y dinh mua ("lấy 2 cái áo thun màu trắng size M") —
      // thu tim san pham ngay trong cau nay truoc khi hoi lai chung chung.
      if (!productId) {
        const candidates = await prisma.product.findMany({ where: { active: true }, include: productInclude });
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

          const distinctColors = [...new Set(product.variants.map((v) => v.color))];

          if (sizeToken) {
            const colorToken = distinctColors.find((color) => flat.includes(stripDiacritics(color.toLowerCase())));

            // Nhieu mau ma khach chua noi ro mau nao -> hoi lai thay vi tu doan dai mau dau tien.
            if (!colorToken && distinctColors.length > 1) {
              return res.json({
                role: 'assistant',
                content: `"${product.name}" size ${sizeToken} có mấy màu: ${distinctColors.join(', ')}. Bạn lấy màu nào?`,
                context: { ...context, productId: product.id, recommendedSize: sizeToken },
              });
            }

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

            if (variant.stockQty === 0) {
              const variantsInStock = product.variants.filter((v) => v.stockQty > 0);
              const sameSizeColors = [...new Set(
                variantsInStock.filter((v) => v.size === variant.size).map((v) => v.color),
              )];
              const sameColorSizes = [...new Set(
                variantsInStock.filter((v) => v.color.toLowerCase() === variant.color.toLowerCase()).map((v) => v.size),
              )];

              let content = `"${product.name}" màu ${variant.color} size ${variant.size} hiện đã hết hàng.`;
              if (sameSizeColors.length > 0) content += ` Size ${variant.size} vẫn còn màu: ${sameSizeColors.join(', ')}.`;
              if (sameColorSizes.length > 0) content += ` Màu ${variant.color} vẫn còn size: ${sameColorSizes.join(', ')}.`;

              if (variantsInStock.length === 0) {
                // San pham nay het sach moi mau/size -> tim mau tuong tu cung danh muc con hang.
                const altCandidates = await prisma.product.findMany({
                  where: { categoryId: product.categoryId, id: { not: product.id }, active: true },
                  include: { ...productInclude, variants: true },
                });
                const altWithStock = altCandidates.filter((p) => p.variants.some((v) => v.stockQty > 0));
                if (altWithStock.length > 0) {
                  content += ' Sản phẩm này hết hàng toàn bộ rồi, bạn xem thử mấy mẫu tương tự này nhé:';
                  return res.json({
                    role: 'assistant',
                    content,
                    products: altWithStock.slice(0, 3).map((p) => toProductCard(p)),
                    context,
                  });
                }
                content += ' Sản phẩm này hết hàng toàn bộ và hiện mình chưa có mẫu tương tự khác.';
              }

              return res.json({ role: 'assistant', content, context });
            }

            if (variant.stockQty < quantity) {
              return res.json({
                role: 'assistant',
                content: `Màu ${variant.color} size ${variant.size} chỉ còn ${variant.stockQty} sản phẩm thôi, bạn lấy ${variant.stockQty} cái được không?`,
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

          // Khach chi neu ten san pham, chua noi size (va co the chua noi mau) -> nhac ro thay vi im lang.
          return res.json({
            role: 'assistant',
            content: `Bạn muốn lấy "${product.name}" size nào? Hiện có size: ${availableSizes.join(', ')}${
              distinctColors.length > 0 ? `, màu: ${distinctColors.join(', ')}` : ''
            }.`,
            context: { ...context, productId: product.id },
          });
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
          content: 'Bạn cho mình biết chiều cao/cân nặng để tư vấn size chính xác hơn nhé. Thông thường 1m58-1m68, 55-70kg hợp size M.',
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
    const products = await prisma.product.findMany({ where: { active: true }, include: productInclude });
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