import {
  Order as OrderModel,
  OrderItem as OrderItemModel,
  Product as ProductModel,
  ProductImage,
  Review as ReviewModel,
  ReviewReply as ReviewReplyModel,
  ShippingMethod,
  User,
  Variant,
  DiscountCode,
} from '@prisma/client';
import { toAbsoluteUrl, toAbsoluteUrlOrNull } from './url';

type ProductWithRelations = ProductModel & {
  images: ProductImage[];
  variants?: Variant[];
  category: { name: string } | null;
};

export function variantPrice(v: Variant, basePrice: number): number {
  return v.priceOverride ?? basePrice;
}

export function toVariant(v: Variant, basePrice: number) {
  return {
    id: v.id,
    sku: v.sku,
    size: v.size,
    color: v.color,
    colorHex: v.colorHex,
    price: variantPrice(v, basePrice),
    stockQty: v.stockQty,
    inStock: v.stockQty > 0,
  };
}

function primaryImageUrl(images: ProductImage[]): string | null {
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  return toAbsoluteUrlOrNull(primary?.url);
}

export function toProductCard(p: ProductWithRelations, score?: number) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    basePrice: p.basePrice,
    primaryImageUrl: primaryImageUrl(p.images),
    categoryName: p.category?.name ?? null,
    audience: p.audience,
    ...(score !== undefined ? { score } : {}),
  };
}

export function toProductDetail(p: ProductWithRelations & { variants: Variant[] }) {
  return {
    ...toProductCard(p),
    description: p.description,
    brand: p.brand,
    material: p.material,
    sizeChartUrl: toAbsoluteUrlOrNull(p.sizeChartUrl),
    images: p.images
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => ({ url: toAbsoluteUrl(i.url), altText: i.altText, isPrimary: i.isPrimary, color: i.color })),
    variants: p.variants.map((v) => toVariant(v, p.basePrice)),
  };
}

export function toAuthUser(u: User) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role };
}

export function toEmployee(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toShippingMethod(s: ShippingMethod) {
  return { id: s.id, name: s.name, fee: s.fee, etaDays: s.etaDays };
}

export function toOrder(
  o: OrderModel & {
    items: OrderItemModel[];
    shippingMethod: ShippingMethod | null;
    discountCode: DiscountCode | null;
  },
) {
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    items: o.items.map((i) => ({
      productName: i.productName,
      size: i.size,
      color: i.color,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    subtotal: o.subtotal,
    shippingFee: o.shippingFee,
    shippingMethodName: o.shippingMethod?.name ?? null,
    discountCode: o.discountCode?.code ?? null,
    discountAmount: o.discountAmount,
    totalAmount: o.totalAmount,
    paymentMethod: o.paymentMethod,
    receiverName: o.receiverName,
    receiverPhone: o.receiverPhone,
    shippingAddress: o.shippingAddress,
    note: o.note,
    createdBy: o.createdBy,
    createdAt: o.createdAt.toISOString(),
    cancelledAt: o.cancelledAt ? o.cancelledAt.toISOString() : null,
    cancelReason: o.cancelReason,
    cancellable: o.status === 'PENDING' || o.status === 'CONFIRMED',
  };
}

export function toReviewReply(r: ReviewReplyModel & { employee: User }) {
  return {
    id: r.id,
    employeeName: r.employee.name,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toReview(
  r: ReviewModel & { user: User; reply: (ReviewReplyModel & { employee: User }) | null },
) {
  return {
    id: r.id,
    productId: r.productId,
    customerName: r.user.name,
    rating: r.rating,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    reply: r.reply ? toReviewReply(r.reply) : null,
  };
}
