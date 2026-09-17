// src/app/page.tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

/** useSearchParams() bat buoc phai nam trong <Suspense> khi build production
 * (next static prerender), khong thi bi loi "Error occurred prerendering page /". */
export default function HomePage() {
  return (
    <Suspense fallback={<div className="wrap"><div className="skeleton" style={{ height: 300 }} /></div>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [audience, setAudience] = useState<Audience | ''>('');
  const [mode, setMode] = useState<Mode>({ kind: 'browse' });
  const [searchResults, setSearchResults] = useState<ProductCard[]>([]);

  // Header (SiteHeader) dieu huong toi day bang ?categoryId=, ?audience= hoac ?q= —
  // doc lai moi khi URL doi de link/o tim kiem tren header thuc su loc duoc san pham.
  useEffect(() => {
    async function syncFromUrl() {
      const catParam = searchParams.get('categoryId');
      const audParam = searchParams.get('audience') as Audience | null;
      const qParam = searchParams.get('q');

      if (qParam) {
        setMode({ kind: 'text', query: qParam });
        setLoading(true);
        setError(null);
        try {
          setSearchResults(await api.semanticSearch(qParam));
        } catch (e) {
          setError(e instanceof ApiException ? e.message : 'Có lỗi xảy ra. Thử lại nhé.');
          setSearchResults([]);
        } finally {
          setLoading(false);
        }
        return;
      }

      setMode({ kind: 'browse' });
      if (catParam) {
        setCategoryId(Number(catParam));
        setAudience('');
      } else if (audParam) {
        setAudience(audParam);
        setCategoryId('');
      } else {
        setCategoryId('');
        setAudience('');
      }
    }
    syncFromUrl();
  }, [searchParams]);

  const [browseProducts, setBrowseProducts] = useState<ProductCard[]>([]);
  const [sections, setSections] = useState<Record<Audience, ProductCard[]>>({
    MEN: [], WOMEN: [], KIDS: [], UNISEX: [],
  });
  const [accessories, setAccessories] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    function load() {
      setLoading(true);
      setError(null);
      const filters = categoryId ? { categoryId } : audience ? { audience } : undefined;
      api.listProducts(0, 12, filters)
        .then((p) => setBrowseProducts(p.items))
        .catch(() => setError('Không tải được sản phẩm.'))
        .finally(() => setLoading(false));
    }
    if (mode.kind === 'browse') load();
  }, [mode.kind, categoryId, audience]);

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

  function backToBrowse() {
    router.push('/');
  }

  const showCurated = mode.kind === 'browse' && categoryId === '' && audience === '';

  return (
    <div className="wrap">
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
            <h2>
              {categoryId
                ? categories.find((c) => c.id === categoryId)?.name ?? 'Sản phẩm'
                : audience
                ? AUDIENCE_SECTIONS.find((s) => s.key === audience)?.title ?? 'Sản phẩm'
                : 'Mới về'}
            </h2>
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
