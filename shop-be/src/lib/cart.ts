import { Request } from 'express';
import { prisma } from './prisma';
import { Errors } from './apiError';
import { variantPrice } from './mappers';
import { toAbsoluteUrlOrNull } from './url';

export async function resolveCart(req: Request) {
  if (req.userId) {
    let cart = await prisma.cart.findUnique({ where: { userId: req.userId } });
    if (!cart) cart = await prisma.cart.create({ data: { userId: req.userId } });

    // Gop gio hang khach vang lai (neu co) vao gio hang cua tai khoan vua dang nhap.
    if (req.sessionId) {
      const guestCart = await prisma.cart.findUnique({
        where: { sessionId: req.sessionId },
        include: { items: true },
      });
      if (guestCart && guestCart.id !== cart.id) {
        for (const item of guestCart.items) {
          await prisma.cartItem.upsert({
            where: { cartId_variantId: { cartId: cart.id, variantId: item.variantId } },
            update: { quantity: { increment: item.quantity } },
            create: { cartId: cart.id, variantId: item.variantId, quantity: item.quantity },
          });
        }
        await prisma.cart.delete({ where: { id: guestCart.id } });
      }
    }
    return cart;
  }

  if (!req.sessionId) {
    throw Errors.validation('Thieu header X-Session-Id cho khach vang lai.');
  }
  let cart = await prisma.cart.findUnique({ where: { sessionId: req.sessionId } });
  if (!cart) cart = await prisma.cart.create({ data: { sessionId: req.sessionId } });
  return cart;
}

export async function loadCartPayload(cartId: number) {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    include: {
      variant: { include: { product: { include: { images: true } } } },
    },
    orderBy: { id: 'asc' },
  });

  const payloadItems = items.map((i) => {
    const price = variantPrice(i.variant, i.variant.product.basePrice);
    const primary = i.variant.product.images.find((im) => im.isPrimary) ?? i.variant.product.images[0];
    return {
      id: i.id,
      variantId: i.variantId,
      productId: i.variant.productId,
      productName: i.variant.product.name,
      primaryImageUrl: toAbsoluteUrlOrNull(primary?.url),
      size: i.variant.size,
      color: i.variant.color,
      unitPrice: price,
      quantity: i.quantity,
      lineTotal: price * i.quantity,
      stockQty: i.variant.stockQty,
    };
  });

  return {
    id: cartId,
    items: payloadItems,
    subtotal: payloadItems.reduce((s, i) => s + i.lineTotal, 0),
  };
}

export async function clearCart(cartId: number) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
}
