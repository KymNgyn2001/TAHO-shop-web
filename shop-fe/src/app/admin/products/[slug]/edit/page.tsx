// src/app/admin/products/[slug]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiException } from '@/lib/api-client';
import { adminApi } from '@/lib/admin-api';
import type { ProductDetail } from '@/lib/api-contract';
import { useRequireRole, STAFF_ROLES } from '@/lib/require-role';
import ProductForm from '@/components/admin/ProductForm';

export default function EditProductPage() {
  const { ready } = useRequireRole(STAFF_ROLES);
  const { slug } = useParams<{ slug: string }>();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    function load() {
      Promise.all([api.getProduct(slug), adminApi.listCategories()])
        .then(([p, cats]) => {
          setProduct(p);
          setCategoryId(cats.find((c) => c.name === p.categoryName)?.id ?? null);
        })
        .catch((e) => setError(e instanceof ApiException ? e.message : 'Không tải được sản phẩm.'));
    }
    load();
  }, [ready, slug]);

  if (!ready) return null;
  if (error) return <div className="wrap admin"><p className="error-bar">{error}</p></div>;
  if (!product) return <div className="wrap admin"><div className="skeleton" style={{ height: 300 }} /></div>;

  return <ProductForm mode="edit" productId={product.id} initial={product} initialCategoryId={categoryId} />;
}
