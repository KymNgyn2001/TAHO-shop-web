import { Audience } from '@prisma/client';
import { prisma } from './prisma';
import { uniqueSlug } from './slug';

export interface ProductDraftInput {
  name: string;
  categoryId: number;
  basePrice: number;
  audience: Audience;
  material?: string;
  description?: string;
  images: { url: string; color?: string }[];
  colors: string[];
  sizes: string[];
  /** Ap dung dong loat cho moi bien the (mau x size) — sua rieng tung o sau trong
   * trang quan tri neu can. */
  stockQty: number;
}

/**
 * Dung chung cho POST /admin/products (form) va lenh "them san pham" qua chatbot —
 * tranh lap lai logic sinh slug/sku o 2 noi.
 */
export async function createProductFromDraft(input: ProductDraftInput) {
  const slug = await uniqueSlug(input.name, async (s) => {
    const found = await prisma.product.findUnique({ where: { slug: s } });
    return !!found;
  });

  const variants = input.colors.flatMap((color, ci) =>
    input.sizes.map((size, si) => ({
      sku: `${slug.slice(0, 12).toUpperCase()}-${size}-${ci}${si}${Date.now().toString(36).slice(-4)}`
        .replace(/\s+/g, '')
        .slice(0, 40)
        .toUpperCase(),
      size,
      color,
      stockQty: input.stockQty,
    })),
  );

  return prisma.product.create({
    data: {
      name: input.name,
      slug,
      categoryId: input.categoryId,
      basePrice: input.basePrice,
      audience: input.audience,
      material: input.material,
      description: input.description,
      images: {
        create: input.images.map((img, i) => ({
          url: img.url,
          color: img.color,
          isPrimary: i === 0,
          sortOrder: i,
        })),
      },
      variants: { create: variants },
    },
    include: { images: true, category: true, variants: true },
  });
}
