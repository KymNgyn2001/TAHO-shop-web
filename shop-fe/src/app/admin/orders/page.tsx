// src/app/admin/orders/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import { api, ApiException } from '@/lib/api-client';
import type { Order, OrderStatus } from '@/lib/api-contract';
import { useRequireRole } from '@/lib/require-role';

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

const PAYMENT_VI: Record<string, string> = {
  COD: 'COD', BANK_TRANSFER: 'Chuyển khoản', MOMO: 'Ví MoMo',
};

const STATUS_VI: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã huỷ',
};

/** Trung voi order-detail page — nhan vien chi duoc chuyen toi, khong lui lai.
 * PENDING -> CONFIRMED khong con la thao tac tay: COD tu xac nhan luc tao don,
 * con chuyen khoan/MoMo tu xac nhan qua webhook thanh toan that. */
const NEXT_STATUS: Record<string, { status: 'SHIPPING' | 'COMPLETED'; label: string } | undefined> = {
  CONFIRMED: { status: 'SHIPPING', label: 'Giao hàng' },
  SHIPPING: { status: 'COMPLETED', label: 'Hoàn tất' },
};

const STATUS_FILTERS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PENDING', label: 'Chờ xác nhận' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'SHIPPING', label: 'Đang giao' },
  { value: 'COMPLETED', label: 'Hoàn tất' },
  { value: 'CANCELLED', label: 'Đã huỷ' },
];

export default function AdminOrdersPage() {
  const { ready } = useRequireRole(['EMPLOYEE', 'MANAGER']);
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [advancingCode, setAdvancingCode] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    function load() {
      setLoading(true);
      adminApi.listAllOrders(0, 100, status || undefined)
        .then((p) => setOrders(p.items))
        .finally(() => setLoading(false));
    }
    load();
  }, [ready, status]);

  if (!ready) return null;

  async function confirmNext(order: Order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setAdvancingCode(order.code);
    setRowError(null);
    try {
      const updated = await api.updateOrderStatus(order.code, next.status);
      setOrders((prev) => prev.map((o) => (o.code === updated.code ? updated : o)));
    } catch (e) {
      setRowError(e instanceof ApiException ? e.message : 'Không đổi được trạng thái đơn.');
    } finally {
      setAdvancingCode(null);
    }
  }

  return (
    <div className="wrap admin">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1>Đơn hàng</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')} aria-label="Lọc theo trạng thái">
          {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {rowError && <p className="error-bar">{rowError}</p>}

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : orders.length === 0 ? (
        <div className="empty"><p>Chưa có đơn hàng nào.</p></div>
      ) : (
        <section className="panel">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr><th>Mã đơn</th><th>Người nhận</th><th>Thanh toán</th><th className="num">Tổng tiền</th><th>Trạng thái</th><th>Ngày đặt</th><th></th></tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const next = NEXT_STATUS[o.status];
                  return (
                    <tr key={o.code}>
                      <td><Link href={`/orders/${o.code}`}>{o.code}</Link></td>
                      <td>{o.receiverName}</td>
                      <td>{PAYMENT_VI[o.paymentMethod] ?? o.paymentMethod}</td>
                      <td className="num">{vnd(o.totalAmount)}</td>
                      <td><span className="pill" data-s={o.status}>{STATUS_VI[o.status]}</span></td>
                      <td>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td>
                        {next && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => confirmNext(o)}
                            disabled={advancingCode === o.code}
                          >
                            {advancingCode === o.code ? 'Đang lưu…' : next.label}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
