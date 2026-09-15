// src/components/admin/ProductForm.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import { ApiException } from '@/lib/api-client';
import type { CategoryWithCount } from '@/lib/api-contract-admin';
import type { ProductDetail } from '@/lib/api-contract';

const MAX_MB = 5;

type Audience = 'MEN' | 'WOMEN' | 'KIDS' | 'UNISEX';
type ColorImage = { url: string; name: string };
type ColorGroup = { id: string; name: string; images: ColorImage[] };

const newColor = (): ColorGroup => ({
  id: Math.random().toString(36).slice(2),
  name: '',
  images: [],
});

const cellKey = (color: string, size: string) => `${color}::${size}`;

const fileNameOf = (url: string) => url.split('/').pop() ?? url;

function buildInitialState(initial: ProductDetail) {
  const generalImages = initial.images
    .filter((im) => !im.color)
    .map((im) => ({ url: im.url, name: fileNameOf(im.url) }));

  const colorOrder: string[] = [];
  for (const v of initial.variants) {
    if (!colorOrder.includes(v.color)) colorOrder.push(v.color);
  }
  const colors: ColorGroup[] = colorOrder.map((colorName) => {
    const images = initial.images
      .filter((im) => im.color === colorName)
      .map((im) => ({ url: im.url, name: fileNameOf(im.url) }));
    return {
      id: Math.random().toString(36).slice(2),
      name: colorName,
      images,
    };
  });

  const sizeOrder: string[] = [];
  for (const v of initial.variants) {
    if (!sizeOrder.includes(v.size)) sizeOrder.push(v.size);
  }

  const cells: Record<string, { priceOverride: string; stockQty: string }> = {};
  for (const v of initial.variants) {
    const isOverride = v.price !== initial.basePrice;
    cells[cellKey(v.color, v.size)] = {
      priceOverride: isOverride ? String(v.price) : '',
      stockQty: String(v.stockQty),
    };
  }

  return { generalImages, colors: colors.length > 0 ? colors : [newColor()], sizes: sizeOrder, cells };
}

interface ProductFormProps {
  mode: 'create' | 'edit';
  productId?: number;
  initial?: ProductDetail;
  initialCategoryId?: number | null;
}

export default function ProductForm({ mode, productId, initial, initialCategoryId }: ProductFormProps) {
  const router = useRouter();
  const seed = initial ? buildInitialState(initial) : null;

  // --- anh chung (mac dinh / anh bia) ---
  const [images, setImages] = useState<{ url: string; name: string }[]>(seed?.generalImages ?? []);
  const [uploading, setUploading] = useState(false);
  const [hot, setHot] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- bang size ---
  const [sizeChart, setSizeChart] = useState<{ url: string; name: string } | null>(
    initial?.sizeChartUrl ? { url: initial.sizeChartUrl, name: fileNameOf(initial.sizeChartUrl) } : null,
  );
  const [uploadingChart, setUploadingChart] = useState(false);
  const chartFileRef = useRef<HTMLInputElement>(null);

  // --- danh muc ---
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(initialCategoryId ?? null);
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  // --- thong tin ---
  const [name, setName] = useState(initial?.name ?? '');
  const [basePrice, setBasePrice] = useState(initial ? String(initial.basePrice) : '');
  const [material, setMaterial] = useState(initial?.material ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [audience, setAudience] = useState<Audience>((initial?.audience as Audience) ?? 'UNISEX');

  // --- mau sac + anh rieng tung mau ---
  const [colors, setColors] = useState<ColorGroup[]>(seed?.colors ?? [newColor()]);
  const [uploadingColorId, setUploadingColorId] = useState<string | null>(null);

  // --- size ---
  const [sizes, setSizes] = useState<string[]>(seed?.sizes ?? []);
  const [sizeInput, setSizeInput] = useState('');

  // --- ma tran gia / ton kho theo (mau, size) ---
  const [cells, setCells] = useState<Record<string, { priceOverride: string; stockQty: string }>>(seed?.cells ?? {});

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    adminApi.listCategories().then((list) => {
      setCategories(list);
      if (categoryId === null && !initial) {
        // khong tu chon danh muc mac dinh — bat buoc nguoi dung bam chon
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- anh chung ----------------

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

  // ---------------- mau sac ----------------

  const updateColor = (id: string, patch: Partial<ColorGroup>) =>
    setColors((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  function pickColorImages(colorId: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => uploadColorImages(colorId, input.files);
    input.click();
  }

  async function uploadColorImages(colorId: string, files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploadingColorId(colorId);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_MB * 1024 * 1024) {
          setError(`${file.name} nặng hơn ${MAX_MB}MB. Nén lại rồi thử tiếp.`);
          continue;
        }
        const up = await adminApi.uploadImage(file);
        setColors((prev) =>
          prev.map((c) => (c.id === colorId ? { ...c, images: [...c.images, { url: up.url, name: up.fileName }] } : c)),
        );
      }
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Tải ảnh màu thất bại.');
    } finally {
      setUploadingColorId(null);
    }
  }

  const removeColorImage = (colorId: string, url: string) =>
    setColors((prev) => prev.map((c) => (c.id === colorId ? { ...c, images: c.images.filter((i) => i.url !== url) } : c)));

  // ---------------- size ----------------

  function addSizes() {
    const parts = sizeInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    setSizes((prev) => {
      const existingLower = new Set(prev.map((s) => s.toLowerCase()));
      const additions = parts.filter((p) => !existingLower.has(p.toLowerCase()));
      return [...prev, ...additions];
    });
    setSizeInput('');
  }

  const removeSize = (s: string) => setSizes((prev) => prev.filter((x) => x !== s));

  // ---------------- luu ----------------

  const validColors = colors.filter((c) => c.name.trim() !== '');
  const validSizes = sizes.filter(Boolean);
  const hasAnyImage = images.length > 0 || validColors.some((c) => c.images.length > 0);

  const ready =
    name.trim() !== '' &&
    categoryId !== null &&
    Number(basePrice) > 0 &&
    hasAnyImage &&
    validColors.length > 0 &&
    validSizes.length > 0;

  async function save() {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      const payloadImages = [
        ...images.map((i) => ({ url: i.url })),
        ...validColors.flatMap((c) => c.images.map((im) => ({ url: im.url, color: c.name }))),
      ];
      const variants = validColors.flatMap((c) =>
        validSizes.map((s) => {
          const cell = cells[cellKey(c.name, s)] ?? { priceOverride: '', stockQty: '0' };
          return {
            size: s,
            color: c.name,
            priceOverride: cell.priceOverride ? Number(cell.priceOverride) : undefined,
            stockQty: Number(cell.stockQty || 0),
          };
        }),
      );

      const payload = {
        name: name.trim(),
        categoryId: categoryId!,
        basePrice: Number(basePrice),
        material: material || undefined,
        description: description || undefined,
        images: payloadImages,
        sizeChartImageUrl: sizeChart?.url,
        audience,
        variants,
      };

      if (mode === 'edit' && productId) {
        await adminApi.updateProduct(productId, payload);
        setSaved(name.trim());
        setTimeout(() => router.push('/admin/products'), 900);
        return;
      }

      const p = await adminApi.createProduct(payload);
      setSaved(p.name);
      setName(''); setBasePrice(''); setMaterial(''); setDescription('');
      setImages([]);
      setSizeChart(null);
      setAudience('UNISEX');
      setColors([newColor()]);
      setSizes([]);
      setCells({});
      setCategoryId(null);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Lưu sản phẩm thất bại.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wrap admin">
      <h1>{mode === 'edit' ? `Sửa sản phẩm${initial ? `: ${initial.name}` : ''}` : 'Thêm sản phẩm'}</h1>

      {saved && (
        <p className="error-bar" style={{ borderLeftColor: '#2E6B3E' }}>
          {mode === 'edit'
            ? `Đã lưu thay đổi cho “${saved}”. Đang quay lại danh sách…`
            : `Đã lưu “${saved}”. Sản phẩm đã xuất hiện trong tìm kiếm.`}
        </p>
      )}
      {error && <p className="error-bar">{error}</p>}

      {/* ---------- Ảnh chung ---------- */}
      <section className="panel">
        <h2>Ảnh chung (ảnh bìa mặc định)</h2>
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
              Ảnh đầu tiên hiện ở trang chủ. Đây là ảnh dùng chung khi khách chưa chọn màu nào cụ thể.
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
          <select id="audience" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
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

      {/* ---------- Màu sắc ---------- */}
      <section className="panel">
        <h2>Màu sắc</h2>
        <p style={{ fontSize: 'var(--step--1)', color: 'var(--muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
          Mỗi màu có thể có ảnh riêng — khách chọn màu nào thì trang sản phẩm đổi sang ảnh của màu đó.
        </p>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {colors.map((c) => (
            <div key={c.id} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                <input
                  value={c.name}
                  onChange={(e) => updateColor(c.id, { name: e.target.value })}
                  placeholder="Tên màu, vd: Đen"
                  style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 4, padding: '0.5rem 0.7rem', font: 'inherit' }}
                />
                {colors.length > 1 && (
                  <button
                    type="button" className="icon-btn" aria-label={`Xoá màu ${c.name || ''}`}
                    onClick={() => setColors((prev) => prev.filter((x) => x.id !== c.id))}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="thumbs">
                {c.images.map((im) => (
                  <div className="thumb" key={im.url}>
                    <img src={im.url} alt={im.name} />
                    <button type="button" onClick={() => removeColorImage(c.id, im.url)} aria-label={`Xoá ${im.name}`}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="thumb thumb--add"
                  onClick={() => pickColorImages(c.id)}
                  disabled={uploadingColorId === c.id}
                  aria-label={`Thêm ảnh cho màu ${c.name || ''}`}
                >
                  <Plus size={18} />
                  <span>{uploadingColorId === c.id ? 'Đang tải…' : 'Thêm ảnh'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="chip" style={{ marginTop: '0.85rem' }} onClick={() => setColors((p) => [...p, newColor()])}>
          <Plus size={14} style={{ verticalAlign: '-2px' }} /> Thêm màu
        </button>
      </section>

      {/* ---------- Size ---------- */}
      <section className="panel">
        <h2>Size</h2>
        <div className="tag-row" style={{ marginBottom: '0.85rem' }}>
          {sizes.map((s) => (
            <span key={s} className="tag" aria-pressed="true">
              {s}
              <button type="button" onClick={() => removeSize(s)} aria-label={`Xoá size ${s}`} style={{ border: 0, background: 'none', cursor: 'pointer', display: 'inline-flex' }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div className="field-row" style={{ alignItems: 'end' }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="sizeInput">Thêm size (cách nhau bằng dấu phẩy)</label>
            <input
              id="sizeInput"
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSizes()}
              placeholder="S, M, L, XL"
            />
          </div>
          <button type="button" className="chip" style={{ height: 40 }} onClick={addSizes} disabled={!sizeInput.trim()}>
            <Plus size={14} style={{ verticalAlign: '-2px' }} /> Thêm
          </button>
        </div>
      </section>

      {/* ---------- Ma tran gia / ton kho ---------- */}
      {validColors.length > 0 && validSizes.length > 0 && (
        <section className="panel">
          <h2>Số lượng &amp; giá riêng theo màu / size</h2>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr><th>Màu</th><th>Size</th><th>Giá riêng (để trống = giá gốc)</th><th>Tồn kho</th></tr>
              </thead>
              <tbody>
                {validColors.flatMap((c) =>
                  validSizes.map((s) => {
                    const key = cellKey(c.name, s);
                    const cell = cells[key] ?? { priceOverride: '', stockQty: '0' };
                    return (
                      <tr key={key}>
                        <td>{c.name}</td>
                        <td>{s}</td>
                        <td>
                          <input
                            type="number" min={0} placeholder={basePrice || '0'}
                            value={cell.priceOverride}
                            onChange={(e) => setCells((prev) => ({ ...prev, [key]: { ...cell, priceOverride: e.target.value } }))}
                            style={{ width: 110 }}
                          />
                        </td>
                        <td>
                          <input
                            type="number" min={0}
                            value={cell.stockQty}
                            onChange={(e) => setCells((prev) => ({ ...prev, [key]: { ...cell, stockQty: e.target.value } }))}
                            style={{ width: 80 }}
                          />
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <button type="button" className="btn-primary" disabled={!ready || saving} onClick={save}>
        {saving
          ? 'Đang lưu…'
          : !ready
            ? 'Điền đủ tên, giá, loại, ảnh, ít nhất 1 màu và 1 size'
            : mode === 'edit' ? 'Lưu thay đổi' : 'Lưu sản phẩm'}
      </button>
    </div>
  );
}
