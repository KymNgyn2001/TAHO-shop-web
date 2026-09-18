// src/app/admin/categories/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import { ApiException } from '@/lib/api-client';
import type { CategoryWithCount } from '@/lib/api-contract-admin';
import type { CategoryGroup } from '@/lib/api-contract';
import { useRequireRole } from '@/lib/require-role';

const CATEGORY_GROUPS: CategoryGroup[] = ['Áo', 'Quần', 'Váy & Đầm', 'Phụ kiện'];

export default function AdminCategoriesPage() {
  const { ready } = useRequireRole(['EMPLOYEE', 'MANAGER']);
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<CategoryGroup | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready) adminApi.listCategories().then(setCategories).catch(() => {});
  }, [ready]);

  async function add() {
    const label = name.trim();
    if (!label) return;
    setBusy(true);
    setError(null);
    try {
      const c = await adminApi.createCategory(label, group || undefined);
      setCategories((prev) => [...prev, c]);
      setName('');
      setGroup('');
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không thêm được danh mục.');
    } finally {
      setBusy(false);
    }
  }

  async function changeGroup(id: number, newGroup: CategoryGroup | '') {
    setError(null);
    try {
      const updated = await adminApi.updateCategoryGroup(id, newGroup || null);
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, group: updated.group } : c)));
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không đổi được nhóm.');
    }
  }

  async function remove(id: number) {
    setError(null);
    try {
      await adminApi.deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không xoá được danh mục.');
    }
  }

  if (!ready) return null;

  return (
    <div className="wrap admin">
      <h1>Danh mục sản phẩm</h1>
      {error && <p className="error-bar">{error}</p>}

      <section className="panel">
        <h2>Thêm danh mục mới</h2>
        <div className="field-row" style={{ alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="cat-name">Tên danh mục</label>
            <input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="cat-group">Nhóm hiển thị trên menu</label>
            <select id="cat-group" value={group} onChange={(e) => setGroup(e.target.value as CategoryGroup | '')}>
              <option value="">— Chưa xếp nhóm —</option>
              {CATEGORY_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <button type="button" className="chip chip--solid" style={{ height: 40 }} onClick={add} disabled={busy || !name.trim()}>
            <Plus size={14} style={{ verticalAlign: '-2px' }} /> Thêm
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Danh sách ({categories.length})</h2>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Tên</th><th>Slug</th><th>Nhóm menu</th><th className="num">Số sản phẩm</th><th /></tr></thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.slug}</td>
                  <td>
                    <select value={c.group ?? ''} onChange={(e) => changeGroup(c.id, e.target.value as CategoryGroup | '')}>
                      <option value="">— Chưa xếp nhóm —</option>
                      {CATEGORY_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </td>
                  <td className="num">{c.productCount}</td>
                  <td>
                    <button
                      type="button" className="icon-btn" aria-label={`Xoá ${c.name}`}
                      disabled={c.productCount > 0}
                      title={c.productCount > 0 ? 'Còn sản phẩm, không xoá được' : 'Xoá danh mục'}
                      onClick={() => remove(c.id)}
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
    </div>
  );
}
