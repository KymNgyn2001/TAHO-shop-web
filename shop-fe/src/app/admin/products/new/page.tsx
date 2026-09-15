// src/app/admin/products/new/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import { ApiException } from '@/lib/api-client';
import type { CategoryWithCount, CreateVariantInput } from '@/lib/api-contract-admin';
import { useRequireRole } from '@/lib/require-role';

const MAX_MB = 5;

export default function NewProductPage() {
  const { ready: roleReady } = useRequireRole(['EMPLOYEE', 'MANAGER']);

  // --- anh ---
  const [images, setImages] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [hot, setHot] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- bang size ---
  const [sizeChart, setSizeChart] = useState<{ url: string; name: string } | null>(null);
  const [uploadingChart, setUploadingChart] = useState(false);
  const chartFileRef = useRef<HTMLInputElement>(null);

  // --- danh muc ---
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  // --- thong tin ---
  const [name, setName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [material, setMaterial] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<'MEN' | 'WOMEN' | 'KIDS' | 'UNISEX'>('UNISEX');
  const [variants, setVariants] = useState<CreateVariantInput[]>([
    { size: 'M', color: 'Đen', stockQty: 10 },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (roleReady) adminApi.listCategories().then(setCategories).catch(() => {});
  }, [roleReady]);

  // ---------------- anh ----------------

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_MB * 1024 * 1024) {
          setError(`${file.name} nặng hơn ${MAX_MB}MB. Nén lại rồi thử tiếp.`);
          continue;
        }
        const up = await adminApi.uploadImage(file);
        setImages((prev) => [...prev, { url: up.url, name: up.fileName }]);
      }
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Tải ảnh lên thất bại.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const makeMain = (i: number) =>
    setImages((prev) => [prev[i], ...prev.filter((_, j) => j !== i)]);

  async function uploadSizeChart(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`${file.name} nặng hơn ${MAX_MB}MB. Nén lại rồi thử tiếp.`);
      return;
    }
    setUploadingChart(true);
    try {
      const up = await adminApi.uploadImage(file);
      setSizeChart({ url: up.url, name: up.fileName });
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Tải ảnh bảng size thất bại.');
    } finally {
      setUploadingChart(false);
      if (chartFileRef.current) chartFileRef.current.value = '';
    }
  }

  // ---------------- danh muc ----------------

  async function addCategory() {
    const label = newCat.trim();
    if (!label) return;
    setAddingCat(true);
    setError(null);
    try {
      const c = await adminApi.createCategory(label);
      setCategories((prev) => [...prev, c]);
      setCategoryId(c.id);
      setNewCat('');
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không thêm được loại này.');
    } finally {
      setAddingCat(false);
    }
  }

  // ---------------- bien the ----------------

  const setVariant = (i: number, patch: Partial<CreateVariantInput>) =>
    setVariants((prev) => prev.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  // ---------------- luu ----------------

  const ready =
    name.trim() !== '' &&
    categoryId !== null &&
    Number(basePrice) > 0 &&
    images.length > 0 &&
    variants.every((v) => v.size && v.color);

  async function save() {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      const p = await adminApi.createProduct({
        name: name.trim(),
        categoryId: categoryId!,
        basePrice: Number(basePrice),
        material: material || undefined,
        description: description || undefined,
        imageUrls: images.map((i) => i.url),
        sizeChartImageUrl: sizeChart?.url,
        audience,
        variants,
      });
      setSaved(p.name);
      setName(''); setBasePrice(''); setMaterial(''); setDescription('');
      setImages([]);
      setSizeChart(null);
      setAudience('UNISEX');
      setVariants([{ size: 'M', color: 'Đen', stockQty: 10 }]);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Lưu sản phẩm thất bại.');
    } finally {
      setSaving(false);
    }
  }

  if (!roleReady) return null;

  return (
    <div className="wrap admin">
      <h1>Thêm sản phẩm</h1>

      {saved && (
        <p className="error-bar" style={{ borderLeftColor: '#2E6B3E' }}>
          Đã lưu “{saved}”. Sản phẩm đã xuất hiện trong tìm kiếm.
        </p>
      )}
      {error && <p className="error-bar">{error}</p>}

      {/* ---------- Ảnh ---------- */}
      <section className="panel">
        <h2>Ảnh sản phẩm</h2>
        <div
          className={`dropbox${hot ? ' dropbox--hot' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setHot(true); }}
          onDragLeave={() => setHot(false)}
          onDrop={(e) => { e.preventDefault(); setHot(false); upload(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        >
          {uploading
            ? 'Đang tải lên…'
            : `Kéo ảnh vào đây hoặc bấm để chọn. JPG, PNG, WEBP, tối đa ${MAX_MB}MB mỗi tấm.`}
        </div>
        <input
          ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => upload(e.target.files)}
        />

        {images.length > 0 && (
          <>
            <div className="thumbs">
              {images.map((im, i) => (
                <div className="thumb" key={im.url}>
                  <img src={im.url} alt={im.name} />
                  <button
                    type="button"
                    onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                    aria-label={`Xoá ${im.name}`}
                  >
                    <X size={12} />
                  </button>
                  {i === 0
                    ? <span className="thumb__main">Ảnh chính</span>
                    : <span
                        className="thumb__main"
                        style={{ background: 'transparent', color: '#fff', cursor: 'pointer' }}
                        onClick={() => makeMain(i)}
                      >Đặt chính</span>}
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              Ảnh đầu tiên hiện ở trang chủ. Thêm ít nhất hai góc chụp để ảnh tự đổi trong feed.
            </p>
          </>
        )}
      </section>

      {/* ---------- Bảng size ---------- */}
      <section className="panel">
        <h2>Bảng size (không bắt buộc)</h2>
        <div
          className={`dropbox${uploadingChart ? ' dropbox--hot' : ''}`}
          onClick={() => chartFileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && chartFileRef.current?.click()}
        >
          {uploadingChart ? 'Đang tải lên…' : sizeChart ? `Đã chọn: ${sizeChart.name} — bấm để đổi ảnh khác` : 'Bấm để chọn ảnh bảng size (JPG, PNG, WEBP)'}
        </div>
        <input ref={chartFileRef} type="file" accept="image/*" hidden onChange={(e) => uploadSizeChart(e.target.files)} />
        {sizeChart && (
          <div className="thumbs">
            <div className="thumb">
              <img src={sizeChart.url} alt="Bảng size" />
              <button type="button" onClick={() => setSizeChart(null)} aria-label="Xoá bảng size">
                <X size={12} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---------- Loại ---------- */}
      <section className="panel">
        <h2>Loại quần áo</h2>
        <div className="tag-row">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className="tag"
              aria-pressed={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name} <small>{c.productCount}</small>
            </button>
          ))}
        </div>

        <div className="field-row" style={{ marginTop: '1rem', alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="newcat">Thêm loại mới</label>
            <input
              id="newcat"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
              placeholder="Áo khoác"
            />
          </div>
          <button
            type="button" className="chip" style={{ height: 40 }}
            onClick={addCategory} disabled={addingCat || !newCat.trim()}
          >
            <Plus size={14} style={{ verticalAlign: '-2px' }} /> Thêm
          </button>
        </div>
      </section>

      {/* ---------- Thông tin ---------- */}
      <section className="panel">
        <h2>Thông tin</h2>
        <div className="field">
          <label htmlFor="name">Tên sản phẩm</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="price">Giá gốc (đ)</label>
            <input
              id="price" type="number" inputMode="numeric" min={0}
              value={basePrice} onChange={(e) => setBasePrice(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="mat">Chất liệu</label>
            <input id="mat" value={material} onChange={(e) => setMaterial(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="audience">Đối tượng</label>
          <select id="audience" value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
            <option value="UNISEX">Unisex</option>
            <option value="MEN">Nam</option>
            <option value="WOMEN">Nữ</option>
            <option value="KIDS">Trẻ em</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="desc">Mô tả</label>
          <textarea
            id="desc" rows={3}
            value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Chất liệu, form dáng, gợi ý phối đồ — mô tả càng rõ thì tìm kiếm càng chính xác."
          />
        </div>
      </section>

      {/* ---------- Biến thể ---------- */}
      <section className="panel">
        <h2>Size, màu và tồn kho</h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Size</th><th>Màu</th><th>Mã màu</th><th>Tồn</th><th /></tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={i}>
                  <td><input value={v.size} onChange={(e) => setVariant(i, { size: e.target.value })} style={{ width: 64 }} /></td>
                  <td><input value={v.color} onChange={(e) => setVariant(i, { color: e.target.value })} style={{ width: 110 }} /></td>
                  <td><input type="color" value={v.colorHex ?? '#000000'} onChange={(e) => setVariant(i, { colorHex: e.target.value })} style={{ width: 44, padding: 2 }} /></td>
                  <td><input type="number" min={0} value={v.stockQty} onChange={(e) => setVariant(i, { stockQty: Number(e.target.value) })} style={{ width: 72 }} /></td>
                  <td>
                    {variants.length > 1 && (
                      <button type="button" className="icon-btn" aria-label="Xoá dòng"
                        onClick={() => setVariants((p) => p.filter((_, j) => j !== i))}>
                        <X size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button" className="chip" style={{ marginTop: '0.75rem' }}
          onClick={() => setVariants((p) => [...p, { size: '', color: '', stockQty: 0 }])}
        >
          <Plus size={14} style={{ verticalAlign: '-2px' }} /> Thêm size / màu
        </button>
      </section>

      <button type="button" className="btn-primary" disabled={!ready || saving} onClick={save}>
        {saving ? 'Đang lưu…' : !ready ? 'Điền đủ tên, giá, loại và ít nhất một ảnh' : 'Lưu sản phẩm'}
      </button>
    </div>
  );
}
