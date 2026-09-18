// src/app/cart/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { api, ApiException } from '@/lib/api-client';
import type { Cart } from '@/lib/api-contract';
import { useAuth, isStaffRole } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

export default function CartPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const { refresh: refreshHeader } = useCart();

  useEffect(() => {
    if (isStaffRole(user?.role)) router.replace('/');
  }, [user, router]);

  useEffect(() => {
    api.getCart().then(setCart).catch(() => setError('Không tải được giỏ hàng.'));
  }, []);

  if (isStaffRole(user?.role)) return null;

  async function changeQty(itemId: number, quantity: number) {
    setError(null);
    setBusyId(itemId);
    try {
      const updated = quantity <= 0
        ? await api.removeCartItem(itemId)
        : await api.updateCartItem(itemId, quantity);
      setCart(updated);
      await refreshHeader();
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không cập nhật được giỏ hàng.');
    } finally {
      setBusyId(null);
    }
  }

  if (!cart) {
    return (
      <div className="wrap cart-page">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="wrap cart-page">
        <h1>Giỏ hàng</h1>
        <div className="empty">
          <ShoppingBag size={32} strokeWidth={1} style={{ marginBottom: '0.75rem', color: 'var(--muted)' }} />
          <p>Giỏ hàng đang trống.</p>
          <Link href="/" className="chip">Tiếp tục mua sắm</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap cart-page">
      <h1>Giỏ hàng</h1>
      {error && <p className="error-bar">{error}</p>}

      <div className="cart-list">
        {cart.items.map((item) => (
          <div className="cart-row" key={item.id}>
            {item.primaryImageUrl && <img src={item.primaryImageUrl} alt={item.productName} />}
            <div>
              <p className="cart-row__name">{item.productName}</p>
              <p className="cart-row__opts">Màu {item.color} · Size {item.size}</p>
              <p className="cart-row__price">{vnd(item.unitPrice)}</p>
            </div>
            <div className="cart-row__side">
              <div className="qty">
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => changeQty(item.id, item.quantity - 1)}
                  aria-label="Giảm số lượng"
                >
                  <Minus size={14} />
                </button>
                <span>{item.quantity}</span>
                <button
                  type="button"
                  disabled={busyId === item.id || item.quantity >= item.stockQty}
                  onClick={() => changeQty(item.id, item.quantity + 1)}
                  aria-label="Tăng số lượng"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button type="button" className="link-remove" onClick={() => changeQty(item.id, 0)}>
                Xoá
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div className="cart-summary__row">
          <span>Tạm tính</span>
          <span>{vnd(cart.subtotal)}</span>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--muted)' }}>
          Phí vận chuyển và mã giảm giá sẽ tính ở bước thanh toán.
        </p>
        <Link href="/checkout" className="btn-primary" style={{ display: 'block', textAlign: 'center', lineHeight: '52px' }}>
          Tiến hành thanh toán
        </Link>
      </div>
    </div>
  );
}
