// src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { api, ApiException } from '@/lib/api-client';
import type { ProductCard } from '@/lib/api-contract';
import SearchField from '@/components/SearchField';
import ProductGrid from '@/components/ProductGrid';

type Mode =
  | { kind: 'all' }
  | { kind: 'text'; query: string }
  | { kind: 'image'; fileName: string };

export default function HomePage() {
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'all' });

  async function run(job: () => Promise<ProductCard[]>) {
    setLoading(true);
    setError(null);
    try {
      setProducts(await job());
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Có lỗi xảy ra. Thử lại nhé.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  const loadAll = () => {
    setMode({ kind: 'all' });
    run(async () => (await api.listProducts(0, 12)).items);
  };

  useEffect(() => {
    function init() { loadAll(); }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const heading =
    mode.kind === 'all' ? 'Mới về'
      : mode.kind === 'text' ? `Kết quả cho “${mode.query}”`
        : `Giống với ${mode.fileName}`;

  return (
    <>
      <SearchField
        busy={loading}
        onSearchText={(q) => {
          setMode({ kind: 'text', query: q });
          run(() => api.semanticSearch(q));
        }}
        onSearchImage={(file) => {
          setMode({ kind: 'image', fileName: file.name });
          run(() => api.imageSearch(file));
        }}
      />

      <div className="wrap">
        {error && <p className="error-bar">{error}</p>}

        <div className="section-head">
          <h2>{heading}</h2>
          {!loading && products.length > 0 && (
            <span>{products.length} sản phẩm</span>
          )}
        </div>

        <ProductGrid
          products={products}
          loading={loading}
          emptyMessage="Không tìm thấy món nào khớp. Thử mô tả ngắn hơn xem sao."
          onReset={mode.kind === 'all' ? undefined : loadAll}
        />
      </div>
    </>
  );
}
