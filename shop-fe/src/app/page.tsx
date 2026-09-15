// src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api, ApiException, type Category } from '@/lib/api-client';
import type { ProductCard, Audience } from '@/lib/api-contract';
import ProductGrid from '@/components/ProductGrid';

type Mode =
  | { kind: 'browse' }
  | { kind: 'text'; query: string };

const AUDIENCE_SECTIONS: { key: Audience; title: string }[] = [
  { key: 'MEN', title: 'Dành cho Nam' },
  { key: 'WOMEN', title: 'Dành cho Nữ' },
  { key: 'KIDS', title: 'Trẻ em' },
];

function ProductSection({ title, products }: { title: string; products: ProductCard[] }) {
  if (products.length === 0) return null;
  return (
    <>
      <div className="section-head">
        <h2>{title}</h2>
      </div>
      <ProductGrid products={products} />
    </>
  );
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>({ kind: 'browse' });

  const [browseProducts, setBrowseProducts] = useState<ProductCard[]>([]);
  const [sections, setSections] = useState<Record<Audience, ProductCard[]>>({
    MEN: [], WOMEN: [], KIDS: [], UNISEX: [],
  });
  const [accessories, setAccessories] = useState<ProductCard[]>([]);
  const [searchResults, setSearchResults] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    function load() {
      setLoading(true);
      setError(null);
      api.listProducts(0, 12, categoryId ? { categoryId } : undefined)
        .then((p) => setBrowseProducts(p.items))
        .catch(() => setError('Không tải được sản phẩm.'))
        .finally(() => setLoading(false));
    }
    if (mode.kind === 'browse') load();
  }, [mode.kind, categoryId]);

  useEffect(() => {
    function load() {
      Promise.all(AUDIENCE_SECTIONS.map((s) => api.listProducts(0, 8, { audience: s.key })))
        .then((results) => {
          setSections((prev) => ({
            ...prev,
            MEN: results[0].items,
            WOMEN: results[1].items,
            KIDS: results[2].items,
          }));
        })
        .catch(() => {});

      const accessoryCat = categories.find((c) => c.name.toLowerCase() === 'phụ kiện');
      if (accessoryCat) {
        api.listProducts(0, 8, { categoryId: accessoryCat.id }).then((p) => setAccessories(p.items)).catch(() => {});
      }
    }
    if (categories.length > 0) load();
  }, [categories]);

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setMode({ kind: 'text', query: q });
    setLoading(true);
    setError(null);
    try {
      setSearchResults(await api.semanticSearch(q));
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Có lỗi xảy ra. Thử lại nhé.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }

  function backToBrowse() {
    setMode({ kind: 'browse' });
    setQuery('');
  }

  const showCurated = mode.kind === 'browse' && categoryId === '';

  return (
    <div className="wrap">
      <div className="home-toolbar">
        <select
          className="home-toolbar__select"
          value={categoryId}
          onChange={(e) => {
            setMode({ kind: 'browse' });
            setCategoryId(e.target.value ? Number(e.target.value) : '');
          }}
          aria-label="Lọc theo danh mục"
        >
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <div className="home-toolbar__search">
          <Search size={16} strokeWidth={1.5} aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Tìm sản phẩm…"
            aria-label="Tìm sản phẩm"
          />
        </div>
      </div>

      {error && <p className="error-bar">{error}</p>}

      {mode.kind === 'text' ? (
        <>
          <div className="section-head">
            <h2>Kết quả cho “{mode.query}”</h2>
            <button type="button" className="chip" onClick={backToBrowse}>Xem tất cả sản phẩm</button>
          </div>
          <ProductGrid
            products={searchResults}
            loading={loading}
            emptyMessage="Không tìm thấy món nào khớp. Thử mô tả ngắn hơn xem sao."
          />
        </>
      ) : (
        <>
          <div className="section-head">
            <h2>{categoryId ? categories.find((c) => c.id === categoryId)?.name ?? 'Sản phẩm' : 'Mới về'}</h2>
            {!loading && <span>{browseProducts.length} sản phẩm</span>}
          </div>
          <ProductGrid products={browseProducts} loading={loading} emptyMessage="Chưa có sản phẩm nào ở danh mục này." />

          {showCurated && (
            <>
              {AUDIENCE_SECTIONS.map((s) => (
                <ProductSection key={s.key} title={s.title} products={sections[s.key]} />
              ))}
              <ProductSection title="Phụ kiện" products={accessories} />
            </>
          )}
        </>
      )}
    </div>
  );
}
