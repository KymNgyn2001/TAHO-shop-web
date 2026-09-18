// src/app/admin/orders/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/admin-api';
import type { Order, OrderStatus } from '@/lib/api-contract';
import { useRequireRole } from '@/lib/require-role';

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

const STATUS_VI: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã huỷ',
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

  return (
    <div className="wrap admin">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1>Đơn hàng</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')} aria-label="Lọc theo trạng thái">
          {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : orders.length === 0 ? (
        <div className="empty"><p>Chưa có đơn hàng nào.</p></div>
      ) : (
        <section className="panel">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr><th>Mã đơn</th><th>Người nhận</th><th>Thanh toán</th><th className="num">Tổng tiền</th><th>Trạng thái</th><th>Ngày đặt</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.code}>
                    <td><Link href={`/orders/${o.code}`}>{o.code}</Link></td>
                    <td>{o.receiverName}</td>
                    <td>{o.paymentMethod === 'COD' ? 'COD' : 'Chuyển khoản'}</td>
                    <td className="num">{vnd(o.totalAmount)}</td>
                    <td><span className="pill" data-s={o.status}>{STATUS_VI[o.status]}</span></td>
                    <td>{new Date(o.createdAt).toLocaleDateString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
