// src/app/checkout/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiException } from '@/lib/api-client';
import type { Cart, ShippingMethod } from '@/lib/api-contract';
import { useAuth } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

type PaymentMethod = 'COD' | 'BANK_TRANSFER';

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { refresh: refreshHeader } = useCart();

  const [cart, setCart] = useState<Cart | null>(null);
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [shippingMethodId, setShippingMethodId] = useState<number | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('COD');

  const [receiverName, setReceiverName] = useState(user?.name ?? '');
  const [receiverPhone, setReceiverPhone] = useState(user?.phone ?? '');
  const [shippingAddress, setShippingAddress] = useState('');
  const [note, setNote] = useState('');

  const [discountInput, setDiscountInput] = useState('');
  const [discount, setDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [discountMsg, setDiscountMsg] = useState<string | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    Promise.all([api.getCart(), api.shippingMethods()]).then(([c, m]) => {
      setCart(c);
      setMethods(m);
      setShippingMethodId(m[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    function fillFromUser() {
      if (!user) return;
      setReceiverName((v) => v || user.name);
      setReceiverPhone((v) => v || user.phone || '');
    }
    fillFromUser();
  }, [user]);

  const shippingFee = useMemo(
    () => methods.find((m) => m.id === shippingMethodId)?.fee ?? 0,
    [methods, shippingMethodId],
  );
  const subtotal = cart?.subtotal ?? 0;
  const discountAmount = discount?.amount ?? 0;
  const total = Math.max(0, subtotal + shippingFee - discountAmount);

  async function applyDiscount() {
    const code = discountInput.trim();
    if (!code) return;
    setCheckingDiscount(true);
    setDiscountMsg(null);
    try {
      const preview = await api.validateDiscount(code, subtotal);
      if (preview.valid) {
        setDiscount({ code: preview.code, amount: preview.discountAmount });
      } else {
        setDiscount(null);
      }
      setDiscountMsg(preview.message);
    } catch (e) {
      setDiscount(null);
      setDiscountMsg(e instanceof ApiException ? e.message : 'Không kiểm tra được mã giảm giá.');
    } finally {
      setCheckingDiscount(false);
    }
  }

  const ready = !!cart?.items.length && !!shippingMethodId && receiverName.trim() && receiverPhone.trim() && shippingAddress.trim();

  async function placeOrder() {
    if (!ready || !shippingMethodId) return;
    setPlacing(true);
    setError(null);
    try {
      const order = await api.createOrder({
        items: cart!.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        shippingMethodId,
        discountCode: discount?.code,
        paymentMethod: payment,
        receiverName: receiverName.trim(),
        receiverPhone: receiverPhone.trim(),
        shippingAddress: shippingAddress.trim(),
        note: note.trim() || undefined,
      });
      await refreshHeader();
      router.push(`/orders/${order.code}`);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Đặt hàng không thành công.');
    } finally {
      setPlacing(false);
    }
  }

  if (!cart) return <div className="wrap checkout"><div className="skeleton" style={{ height: 300 }} /></div>;

  if (cart.items.length === 0) {
    return (
      <div className="wrap checkout">
        <div className="empty"><p>Giỏ hàng đang trống, chưa có gì để thanh toán.</p></div>
      </div>
    );
  }

  return (
    <div className="wrap checkout">
      <h1>Thanh toán</h1>
      {error && <p className="error-bar">{error}</p>}

      <div className="checkout__grid">
        <div>
          <section className="panel" style={{ marginBottom: '1.25rem' }}>
            <h2>Thông tin nhận hàng</h2>
            <div className="field">
              <label htmlFor="rn">Tên người nhận</label>
              <input id="rn" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="rp">Số điện thoại</label>
              <input id="rp" value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="addr">Địa chỉ giao hàng</label>
              <textarea id="addr" rows={2} value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="note">Ghi chú (không bắt buộc)</label>
              <input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </section>

          <section className="panel" style={{ marginBottom: '1.25rem' }}>
            <h2>Phương thức vận chuyển</h2>
            <div className="option-list">
              {methods.map((m) => (
                <div
                  key={m.id}
                  className="option-card"
                  role="button"
                  tabIndex={0}
                  aria-pressed={shippingMethodId === m.id}
                  onClick={() => setShippingMethodId(m.id)}
                  onKeyDown={(e) => e.key === 'Enter' && setShippingMethodId(m.id)}
                >
                  <span>
                    <span className="option-card__title">{m.name}</span>
                    <span className="option-card__sub">{m.etaDays}</span>
                  </span>
                  <strong>{m.fee === 0 ? 'Miễn phí' : vnd(m.fee)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="panel" style={{ marginBottom: '1.25rem' }}>
            <h2>Mã giảm giá</h2>
            <div className="discount-row">
              <input
                placeholder="Nhập mã, vd WELCOME10"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
              />
              <button type="button" className="chip" onClick={applyDiscount} disabled={checkingDiscount || !discountInput.trim()}>
                {checkingDiscount ? 'Đang kiểm tra…' : 'Áp dụng'}
              </button>
            </div>
            {discountMsg && (
              <p style={{ fontSize: 'var(--step--1)', marginTop: '0.5rem', color: discount ? '#2E6B3E' : 'var(--accent)' }}>
                {discountMsg}
              </p>
            )}
          </section>

          <section className="panel">
            <h2>Thanh toán</h2>
            <div className="option-list">
              <div
                className="option-card"
                role="button" tabIndex={0}
                aria-pressed={payment === 'COD'}
                onClick={() => setPayment('COD')}
                onKeyDown={(e) => e.key === 'Enter' && setPayment('COD')}
              >
                <span className="option-card__title">Thanh toán khi nhận hàng (COD)</span>
              </div>
              <div
                className="option-card"
                role="button" tabIndex={0}
                aria-pressed={payment === 'BANK_TRANSFER'}
                onClick={() => setPayment('BANK_TRANSFER')}
                onKeyDown={(e) => e.key === 'Enter' && setPayment('BANK_TRANSFER')}
              >
                <span className="option-card__title">Chuyển khoản ngân hàng</span>
              </div>
            </div>
            {payment === 'BANK_TRANSFER' && (
              <p style={{ fontSize: 'var(--step--1)', color: 'var(--muted)', marginTop: '0.75rem' }}>
                Sau khi đặt hàng, thông tin chuyển khoản sẽ hiện ở trang chi tiết đơn hàng.
              </p>
            )}
          </section>
        </div>

        <aside className="checkout__summary">
          <h2>Đơn hàng ({cart.items.length} sản phẩm)</h2>
          {cart.items.map((i) => (
            <div className="checkout__line checkout__line--item" key={i.id}>
              <span>{i.productName} × {i.quantity}</span>
              <span>{vnd(i.lineTotal)}</span>
            </div>
          ))}
          <div className="checkout__line">
            <span>Tạm tính</span>
            <span>{vnd(subtotal)}</span>
          </div>
          <div className="checkout__line">
            <span>Phí vận chuyển</span>
            <span>{shippingFee === 0 ? 'Miễn phí' : vnd(shippingFee)}</span>
          </div>
          {discount && (
            <div className="checkout__line">
              <span>Giảm giá ({discount.code})</span>
              <span>-{vnd(discount.amount)}</span>
            </div>
          )}
          <div className="checkout__total">
            <span>Tổng cộng</span>
            <span>{vnd(total)}</span>
          </div>
          <button type="button" className="btn-primary" disabled={!ready || placing} onClick={placeOrder}>
            {placing ? 'Đang đặt hàng…' : 'Đặt hàng'}
          </button>
        </aside>
      </div>
    </div>
  );
}
