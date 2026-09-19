// src/app/orders/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import type { Order } from '@/lib/api-contract';
import { useRequireRole, ALL_ROLES } from '@/lib/require-role';

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

const STATUS_VI: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã huỷ',
};

export default function OrdersPage() {
  const { ready } = useRequireRole(ALL_ROLES);
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    function load() {
      api.listOrders().then((p) => setOrders(p.items)).catch(() => setOrders([]));
    }
    load();
  }, [ready]);

  if (!ready) return null;

  if (orders === null) {
    return <div className="wrap orders-page"><div className="skeleton" style={{ height: 200 }} /></div>;
  }

  return (
    <div className="wrap orders-page">
      <h1>Đơn hàng của tôi</h1>

      {orders.length === 0 ? (
        <div className="empty">
          <p>Bạn chưa có đơn hàng nào.</p>
          <Link href="/" className="chip">Bắt đầu mua sắm</Link>
        </div>
      ) : (
        orders.map((o) => (
          <Link href={`/orders/${o.code}`} key={o.code} className="order-card">
            <div className="order-card__head">
              <span className="order-card__code">{o.code}</span>
              <span className="pill" data-s={o.status}>{STATUS_VI[o.status]}</span>
            </div>
            <p className="order-card__items">
              {o.items.map((i) => i.productName).join(', ')}
            </p>
            <div className="order-card__foot">
              <span className="order-card__date">{new Date(o.createdAt).toLocaleDateString('vi-VN')}</span>
              <span className="order-card__total">{vnd(o.totalAmount)}</span>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
