// src/app/orders/[code]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiException } from '@/lib/api-client';
import type { Order } from '@/lib/api-contract';
import { useRequireRole } from '@/lib/require-role';
import { useAuth } from '@/lib/auth-context';
import { vietQrImageUrl, bankInfo } from '@/lib/bankQr';

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

const STATUS_VI: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã huỷ',
};

/** Nhan vien/quan ly xac nhan tay sau khi tu kiem tra da nhan duoc tien (QR chi la
 * goi y chuyen khoan, khong phai cong thanh toan nen he thong khong tu biet). */
const NEXT_STATUS: Record<string, { status: 'CONFIRMED' | 'SHIPPING' | 'COMPLETED'; label: string } | undefined> = {
  PENDING: { status: 'CONFIRMED', label: 'Xác nhận đã nhận thanh toán' },
  CONFIRMED: { status: 'SHIPPING', label: 'Chuyển sang Đang giao' },
  SHIPPING: { status: 'COMPLETED', label: 'Đánh dấu Hoàn tất' },
};

export default function OrderDetailPage() {
  const { ready } = useRequireRole(['CUSTOMER', 'EMPLOYEE', 'MANAGER']);
  const { user } = useAuth();
  const { code } = useParams<{ code: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [reason, setReason] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const isStaff = user?.role === 'EMPLOYEE' || user?.role === 'MANAGER';

  useEffect(() => {
    if (!ready) return;
    function load() {
      api.getOrder(code).then(setOrder).catch((e) =>
        setError(e instanceof ApiException ? e.message : 'Không tìm thấy đơn hàng.'));
    }
    load();
  }, [ready, code]);

  if (!ready) return null;

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

  async function advanceStatus() {
    const next = order && NEXT_STATUS[order.status];
    if (!next) return;
    setAdvancing(true);
    setError(null);
    try {
      const updated = await api.updateOrderStatus(code, next.status);
      setOrder(updated);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không đổi được trạng thái đơn.');
    } finally {
      setAdvancing(false);
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
        <div className="bank-qr">
          <div className="error-bar" style={{ borderLeftColor: 'var(--ink)' }}>
            Vui lòng chuyển khoản số tiền <strong>{vnd(order.totalAmount)}</strong> và ghi nội dung
            <strong> {order.code}</strong> để đơn được xác nhận nhanh hơn.
          </div>
          <img
            src={vietQrImageUrl(order.totalAmount, order.code)}
            alt={`QR chuyển khoản ${bankInfo.bankName} ${bankInfo.accountNo}`}
            className="bank-qr__img"
          />
          <p className="bank-qr__note">Quét mã bằng app ngân hàng bất kỳ — số tiền và nội dung đã được điền sẵn.</p>
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
        {order.email && (<><dt>Email</dt><dd>{order.email}</dd></>)}
        <dt>Địa chỉ</dt>
        <dd>{order.shippingAddress}</dd>
        {order.note && (<><dt>Ghi chú</dt><dd>{order.note}</dd></>)}
        {order.cancelReason && (<><dt>Lý do huỷ</dt><dd>{order.cancelReason}</dd></>)}
      </dl>

      {isStaff && NEXT_STATUS[order.status] && (
        <button
          type="button"
          className="btn-primary"
          style={{ marginBottom: '0.75rem' }}
          onClick={advanceStatus}
          disabled={advancing}
        >
          {advancing ? 'Đang cập nhật…' : NEXT_STATUS[order.status]!.label}
        </button>
      )}

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
