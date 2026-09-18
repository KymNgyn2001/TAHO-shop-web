// src/app/admin/products/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, ApiException } from '@/lib/api-client';
import type { ProductCard } from '@/lib/api-contract';
import { adminApi } from '@/lib/admin-api';
import { useRequireRole } from '@/lib/require-role';

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

const AUDIENCE_VI: Record<string, string> = {
  MEN: 'Nam', WOMEN: 'Nữ', KIDS: 'Trẻ em', UNISEX: 'Unisex',
};

export default function AdminProductsPage() {
  const { ready } = useRequireRole(['EMPLOYEE', 'MANAGER']);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    function load() {
      setLoading(true);
      api.listProducts(0, 100).then((p) => setProducts(p.items)).finally(() => setLoading(false));
    }
    load();
  }, [ready]);

  async function toggleActive(id: number, name: string, active: boolean) {
    setError(null);
    setTogglingId(id);
    try {
      await adminApi.toggleProductActive(id, active);
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, active } : p)));
    } catch (e) {
      setError(e instanceof ApiException ? e.message : `Không ${active ? 'hiện' : 'ẩn'} được "${name}".`);
    } finally {
      setTogglingId(null);
    }
  }

  async function remove(id: number, name: string) {
    if (!confirm(`Xoá sản phẩm "${name}"? Không thể hoàn tác.`)) return;
    setError(null);
    setDeletingId(id);
    try {
      await adminApi.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không xoá được sản phẩm.');
    } finally {
      setDeletingId(null);
    }
  }

  if (!ready) return null;

  return (
    <div className="wrap admin">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Sản phẩm</h1>
        <Link href="/admin/products/new" className="chip">
          <Plus size={14} style={{ verticalAlign: '-2px' }} /> Đăng sản phẩm mới
        </Link>
      </div>

      {error && <p className="error-bar">{error}</p>}

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : products.length === 0 ? (
        <div className="empty"><p>Chưa có sản phẩm nào.</p></div>
      ) : (
        <section className="panel">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr><th /><th>Tên</th><th>Danh mục</th><th>Đối tượng</th><th className="num">Giá</th><th>Trạng thái</th><th /></tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td style={{ width: 48 }}>
                      {p.primaryImageUrl && (
                        <img src={p.primaryImageUrl} alt={p.name} style={{ width: 36, height: 48, objectFit: 'cover', display: 'block' }} />
                      )}
                    </td>
                    <td>
                      <Link href={`/products/${p.slug}`} target="_blank">{p.name}</Link>
                    </td>
                    <td>{p.categoryName ?? '—'}</td>
                    <td>{AUDIENCE_VI[p.audience] ?? p.audience}</td>
                    <td className="num">{vnd(p.basePrice)}</td>
                    <td>
                      <span className="pill" data-s={p.active ? 'COMPLETED' : 'CANCELLED'}>
                        {p.active ? 'Đang bán' : 'Đã ẩn'}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '0.25rem' }}>
                      <Link href={`/admin/products/${p.slug}/edit`} className="icon-btn" aria-label={`Sửa ${p.name}`}>
                        <Pencil size={14} />
                      </Link>
                      <button
                        type="button" className="icon-btn"
                        aria-label={p.active ? `Ẩn ${p.name}` : `Hiện ${p.name}`}
                        title={p.active ? 'Ẩn sản phẩm' : 'Hiện sản phẩm'}
                        disabled={togglingId === p.id}
                        onClick={() => toggleActive(p.id, p.name, !p.active)}
                      >
                        {p.active ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        type="button" className="icon-btn" aria-label={`Xoá ${p.name}`}
                        disabled={deletingId === p.id}
                        onClick={() => remove(p.id, p.name)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
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
