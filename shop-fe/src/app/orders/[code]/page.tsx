// src/app/orders/[code]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiException } from '@/lib/api-client';
import type { Order } from '@/lib/api-contract';

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

const STATUS_VI: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã huỷ',
};

export default function OrderDetailPage() {
  const { code } = useParams<{ code: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    api.getOrder(code).then(setOrder).catch((e) =>
      setError(e instanceof ApiException ? e.message : 'Không tìm thấy đơn hàng.'));
  }, [code]);

  async function cancel() {
    if (!reason.trim()) return;
    setCancelling(true);
    setError(null);
    try {
      const updated = await api.cancelOrder(code, reason.trim());
      setOrder(updated);
      setShowCancelForm(false);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không huỷ được đơn hàng.');
    } finally {
      setCancelling(false);
    }
  }

  if (error) return <div className="wrap"><p className="error-bar">{error}</p></div>;
  if (!order) return <div className="wrap order-detail"><div className="skeleton" style={{ height: 240 }} /></div>;

  return (
    <div className="wrap order-detail">
      <div className="order-detail__head">
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--step-2)', fontWeight: 300 }}>{order.code}</h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)', fontSize: 'var(--step--1)' }}>
            Đặt ngày {new Date(order.createdAt).toLocaleString('vi-VN')}
          </p>
        </div>
        <span className="pill" data-s={order.status}>{STATUS_VI[order.status]}</span>
      </div>

      {error && <p className="error-bar">{error}</p>}

      {order.paymentMethod === 'BANK_TRANSFER' && order.status === 'PENDING' && (
        <div className="error-bar" style={{ borderLeftColor: 'var(--ink)' }}>
          Vui lòng chuyển khoản số tiền <strong>{vnd(order.totalAmount)}</strong> và ghi nội dung
          <strong> {order.code}</strong> để đơn được xác nhận nhanh hơn.
        </div>
      )}

      <div className="order-detail__list">
        {order.items.map((i, idx) => (
          <div className="order-detail__row" key={idx}>
            <span>{i.productName} — {i.color} / {i.size} × {i.quantity}</span>
            <span>{vnd(i.lineTotal)}</span>
          </div>
        ))}
        <div className="order-detail__row"><span>Tạm tính</span><span>{vnd(order.subtotal)}</span></div>
        <div className="order-detail__row">
          <span>Vận chuyển{order.shippingMethodName ? ` — ${order.shippingMethodName}` : ''}</span>
          <span>{order.shippingFee === 0 ? 'Miễn phí' : vnd(order.shippingFee)}</span>
        </div>
        {order.discountAmount > 0 && (
          <div className="order-detail__row">
            <span>Giảm giá{order.discountCode ? ` — ${order.discountCode}` : ''}</span>
            <span>-{vnd(order.discountAmount)}</span>
          </div>
        )}
        <div className="order-detail__row" style={{ fontWeight: 500 }}>
          <span>Tổng cộng</span><span>{vnd(order.totalAmount)}</span>
        </div>
      </div>

      <dl className="detail__meta" style={{ marginTop: 0 }}>
        <dt>Người nhận</dt>
        <dd>{order.receiverName} · {order.receiverPhone}</dd>
        <dt>Địa chỉ</dt>
        <dd>{order.shippingAddress}</dd>
        {order.note && (<><dt>Ghi chú</dt><dd>{order.note}</dd></>)}
        {order.cancelReason && (<><dt>Lý do huỷ</dt><dd>{order.cancelReason}</dd></>)}
      </dl>

      {order.cancellable && (
        showCancelForm ? (
          <div className="field">
            <label htmlFor="reason">Lý do huỷ đơn</label>
            <textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn-secondary" onClick={cancel} disabled={cancelling || !reason.trim()}>
                {cancelling ? 'Đang huỷ…' : 'Xác nhận huỷ đơn'}
              </button>
              <button type="button" className="chip" onClick={() => setShowCancelForm(false)}>Thôi</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-secondary" onClick={() => setShowCancelForm(true)}>
            Huỷ đơn hàng
          </button>
        )
      )}
    </div>
  );
}
