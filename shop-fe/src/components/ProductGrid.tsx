// src/components/ProductGrid.tsx
'use client';

import Link from 'next/link';
import type { ProductCard } from '@/lib/api-contract';

const vnd = (n: number) => n.toLocaleString('vi-VN') + '\u00A0₫';

function Card({ p }: { p: ProductCard }) {
  return (
    <Link href={`/products/${p.slug}`} className="pcard">
      <div className="pcard__media">
        {p.primaryImageUrl && (
          <img src={p.primaryImageUrl} alt={p.name} loading="lazy" />
        )}
        {p.score !== undefined && p.score > 0.6 && (
          <span className="pcard__badge">Khớp {Math.round(p.score * 100)}%</span>
        )}
      </div>
      <div className="pcard__body">
        <p className="pcard__name">{p.name}</p>
        <span className="pcard__price">{vnd(p.basePrice)}</span>
      </div>
    </Link>
  );
}

function Placeholder() {
  return (
    <div className="pcard" aria-hidden>
      <div className="pcard__media skeleton" />
      <div className="pcard__body">
        <span className="skeleton" style={{ height: 14, width: '70%' }} />
      </div>
    </div>
  );
}

interface Props {
  products: ProductCard[];
  loading?: boolean;
  emptyMessage?: string;
  onReset?: () => void;
}

export default function ProductGrid({
  products, loading, emptyMessage, onReset,
}: Props) {
  if (loading) {
    return (
      <div className="grid-products">
        {Array.from({ length: 8 }, (_, i) => <Placeholder key={i} />)}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="empty">
        <p>{emptyMessage ?? 'Chưa có sản phẩm nào khớp với mô tả này.'}</p>
        {onReset && (
          <button type="button" className="chip" onClick={onReset}>
            Xem toàn bộ sản phẩm
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid-products">
      {products.map((p) => <Card key={p.id} p={p} />)}
    </div>
  );
}
