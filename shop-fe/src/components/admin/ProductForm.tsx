// src/components/admin/ProductForm.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Move, Plus, Trash2, X } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import { ApiException } from '@/lib/api-client';
import type { CategoryWithCount } from '@/lib/api-contract-admin';
import type { ProductDetail } from '@/lib/api-contract';

const MAX_MB = 10;

type Audience = 'MEN' | 'WOMEN' | 'KIDS' | 'UNISEX';
type ColorImage = { url: string; name: string };
type ColorGroup = { id: string; name: string; hex: string; images: ColorImage[] };
type SizeRow = { id: string; value: string };

const rid = () => Math.random().toString(36).slice(2);
const newColor = (): ColorGroup => ({ id: rid(), name: '', hex: '', images: [] });
const newSizeRow = (value = ''): SizeRow => ({ id: rid(), value });

/** Luon giu 1 o trong o cuoi danh sach de nhan vien go tiep — go xong o cuoi thi o moi tu hien ra. */
function withTrailingEmpty<T>(list: T[], isEmpty: (x: T) => boolean, make: () => T): T[] {
  const last = list[list.length - 1];
  return last && isEmpty(last) ? list : [...list, make()];
}
const colorEmpty = (c: ColorGroup) => c.name.trim() === '';
const sizeEmpty = (r: SizeRow) => r.value.trim() === '';
const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Goi y size theo "loai size" nhan vien chon (chi de bam chon nhanh, khong luu vao DB). */
const SIZE_TYPES = [
  { key: 'intl', label: 'Size (Quốc Tế)', presets: ['S', 'M', 'L', 'XL', '2XL', '3XL'] },
  { key: 'us', label: 'Size (US)', presets: ['6', '7', '8', '9', '10', '11', '12'] },
  { key: 'inch', label: 'Size (Inch)', presets: ['28', '29', '30', '31', '32', '33', '34'] },
  { key: 'eu', label: 'Size (EU)', presets: ['36', '37', '38', '39', '40', '41', '42', '43', '44'] },
  { key: 'age', label: 'Size (Tuổi)', presets: ['2', '4', '6', '8', '10', '12'] },
  { key: 'cm', label: 'Size (cm)', presets: ['150', '155', '160', '165', '170', '175', '180'] },
  { key: 'mm', label: 'Size (mm)', presets: ['230', '240', '250', '260', '270', '280'] },
  { key: 'custom', label: 'Tùy chỉnh', presets: [] as string[] },
] as const;

type Cell = { priceOverride: string; stockQty: string; sku: string };
const emptyCell = (): Cell => ({ priceOverride: '', stockQty: '0', sku: '' });

const cellKey = (color: string, size: string) => `${color}::${size}`;

/** "Áo Đen" -> "AO-DEN": dung ghep SKU tu tien to chung + mau + size. */
const skuPart = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');

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
    const hex = initial.variants.find((v) => v.color === colorName)?.colorHex ?? '';
    return { id: rid(), name: colorName, hex, images };
  });

  const sizeOrder: string[] = [];
  for (const v of initial.variants) {
    if (!sizeOrder.includes(v.size)) sizeOrder.push(v.size);
  }

  const cells: Record<string, Cell> = {};
  for (const v of initial.variants) {
    const isOverride = v.price !== initial.basePrice;
    cells[cellKey(v.color, v.size)] = {
      priceOverride: isOverride ? String(v.price) : '',
      stockQty: String(v.stockQty),
      sku: v.sku,
    };
  }

  return {
    generalImages,
    colors: withTrailingEmpty(colors, colorEmpty, newColor),
    sizeRows: withTrailingEmpty(sizeOrder.map((s) => newSizeRow(s)), sizeEmpty, newSizeRow),
    cells,
  };
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
  const [sizeRows, setSizeRows] = useState<SizeRow[]>(seed?.sizeRows ?? [newSizeRow()]);
  const [sizeType, setSizeType] = useState<(typeof SIZE_TYPES)[number]['key']>('intl');
  const dragRef = useRef<{ list: 'color' | 'size'; index: number } | null>(null);

  // --- ma tran gia / ton kho theo (mau, size) ---
  const [cells, setCells] = useState<Record<string, Cell>>(seed?.cells ?? {});
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');
  const [bulkSku, setBulkSku] = useState('');

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
    setColors((prev) =>
      withTrailingEmpty(prev.map((c) => (c.id === id ? { ...c, ...patch } : c)), colorEmpty, newColor),
    );

  const removeColor = (id: string) =>
    setColors((prev) => withTrailingEmpty(prev.filter((c) => c.id !== id), colorEmpty, newColor));

  /** Keo-tha doi cho: dung chung cho danh sach mau va size (thu tu quyet dinh thu tu hien o trang san pham). */
  function moveItem<T>(setList: (fn: (prev: T[]) => T[]) => void, from: number, to: number) {
    if (from === to) return;
    setList((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }
  /** Keo-tha doi cho anh: scope = 'general' (anh chung) hoac id cua mau (anh rieng tung mau). Anh dung dau la anh chinh. */
  const imgDragRef = useRef<{ scope: string; index: number } | null>(null);
  const [imgOver, setImgOver] = useState<string | null>(null);
  const imgKey = (scope: string, i: number) => `${scope}:${i}`;

  function dropImage(scope: string, to: number) {
    const d = imgDragRef.current;
    imgDragRef.current = null;
    setImgOver(null);
    if (!d || d.scope !== scope || d.index === to) return;
    const reorder = <T,>(arr: T[]) => {
      const next = [...arr];
      const [item] = next.splice(d.index, 1);
      next.splice(to, 0, item);
      return next;
    };
    if (scope === 'general') setImages((prev) => reorder(prev));
    else setColors((prev) => prev.map((c) => (c.id === scope ? { ...c, images: reorder(c.images) } : c)));
  }

  /** Thuoc tinh dung chung cho 1 o anh keo-tha duoc. */
  const imgDnd = (scope: string, i: number) => ({
    draggable: true,
    onDragStart: () => { imgDragRef.current = { scope, index: i }; },
    onDragEnd: () => { imgDragRef.current = null; setImgOver(null); },
    onDragOver: (e: React.DragEvent) => {
      if (imgDragRef.current?.scope === scope) { e.preventDefault(); e.stopPropagation(); setImgOver(imgKey(scope, i)); }
    },
    onDrop: (e: React.DragEvent) => {
      if (imgDragRef.current?.scope === scope) { e.preventDefault(); e.stopPropagation(); dropImage(scope, i); }
    },
  });

  const dropOn = (list: 'color' | 'size', to: number) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d || d.list !== list) return;
    if (list === 'color') moveItem<ColorGroup>(setColors, d.index, to);
    else moveItem<SizeRow>(setSizeRows, d.index, to);
  };

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

  const updateSizeRow = (id: string, value: string) =>
    setSizeRows((prev) => withTrailingEmpty(prev.map((r) => (r.id === id ? { ...r, value } : r)), sizeEmpty, newSizeRow));

  const removeSizeRow = (id: string) =>
    setSizeRows((prev) => withTrailingEmpty(prev.filter((r) => r.id !== id), sizeEmpty, newSizeRow));

  /** Nut goi y (S, M, L...): bam lan dau them size, bam lan nua bo size do. */
  const togglePresetSize = (s: string) =>
    setSizeRows((prev) => {
      const has = prev.some((r) => r.value.trim() === s);
      const next = has
        ? prev.filter((r) => r.value.trim() !== s)
        : [...prev.filter((r) => !sizeEmpty(r)), newSizeRow(s)];
      return withTrailingEmpty(next, sizeEmpty, newSizeRow);
    });

  // ---------------- ap dung ton kho hang loat ----------------

  const canApplyBulk = bulkPrice.trim() !== '' || bulkStock.trim() !== '' || bulkSku.trim() !== '';

  /** Chi ghi de o nao nhan vien da nhap o thanh tren; o de trong thi giu nguyen gia tri hien co.
   * SKU nhap o day la TIEN TO — moi phan loai duoc ghep them mau + size de khong trung nhau. */
  function applyBulk() {
    if (!canApplyBulk) return;
    const prefix = skuPart(bulkSku);
    setCells((prev) => {
      const next = { ...prev };
      for (const c of validColors) {
        for (const s of validSizes) {
          const key = cellKey(c.name, s);
          const cur = next[key] ?? emptyCell();
          next[key] = {
            priceOverride: bulkPrice.trim() !== '' ? bulkPrice.trim() : cur.priceOverride,
            stockQty: bulkStock.trim() !== '' ? bulkStock.trim() : cur.stockQty,
            sku: prefix ? [prefix, skuPart(c.name), skuPart(s)].filter(Boolean).join('-') : cur.sku,
          };
        }
      }
      return next;
    });
  }

  const setCell = (key: string, patch: Partial<Cell>) =>
    setCells((prev) => ({ ...prev, [key]: { ...(prev[key] ?? emptyCell()), ...patch } }));

  // ---------------- luu ----------------

  const validColors = colors.filter((c) => !colorEmpty(c)).map((c) => ({ ...c, name: c.name.trim() }));
  const validSizes = sizeRows.filter((r) => !sizeEmpty(r)).map((r) => r.value.trim());
  const activePresets: readonly string[] = SIZE_TYPES.find((t) => t.key === sizeType)?.presets ?? [];
  const hasAnyImage = images.length > 0 || validColors.some((c) => c.images.length > 0);
  const lowerKey = (s: string) => s.toLowerCase();
  const dupColors = new Set(validColors.map((c) => lowerKey(c.name))).size !== validColors.length;
  const dupSizes = new Set(validSizes.map(lowerKey)).size !== validSizes.length;
  const badHex = validColors.some((c) => c.hex.trim() !== '' && !HEX_RE.test(c.hex.trim()));

  // Liet ke cu the con thieu gi de nhan vien khong phai doan vi sao nut Luu bi khoa.
  const missing = [
    name.trim() === '' && 'tên sản phẩm',
    categoryId === null && 'loại quần áo',
    !(Number(basePrice) > 0) && 'giá gốc lớn hơn 0',
    !hasAnyImage && 'ít nhất 1 ảnh',
    validColors.length === 0 && 'ít nhất 1 màu (có tên)',
    validSizes.length === 0 && 'ít nhất 1 size',
    dupColors && 'tên màu không được trùng nhau',
    dupSizes && 'size không được trùng nhau',
    badHex && 'mã màu dạng #RRGGBB (vd #1A1A1A) hoặc để trống',
  ].filter(Boolean) as string[];
  const ready = missing.length === 0;

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
          const cell = cells[cellKey(c.name, s)] ?? emptyCell();
          return {
            size: s,
            color: c.name,
            colorHex: c.hex.trim() || undefined,
            priceOverride: cell.priceOverride ? Number(cell.priceOverride) : undefined,
            stockQty: Number(cell.stockQty || 0),
            sku: cell.sku.trim() || undefined,
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
      setSizeRows([newSizeRow()]);
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

      <div className="error-bar" style={{ borderLeftColor: 'var(--ink)' }}>
        <strong>Điền đúng để sản phẩm hiển thị đẹp:</strong>
        <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
          <li>Ảnh JPG/PNG/WEBP, mỗi ảnh tối đa {MAX_MB}MB; ảnh đầu tiên là ảnh bìa hiện ở trang chủ.</li>
          <li>Giá ghi bằng số, không có dấu chấm (VD 250000). Ô "Giá riêng" để trống nghĩa là dùng giá gốc.</li>
          <li>Mỗi màu ghi 1 tên rõ ràng (VD Đen, Trắng) và chọn ít nhất 1 size; nhập số tồn kho cho từng ô bên dưới.</li>
        </ul>
      </div>

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
                <div
                  className={`thumb thumb--drag${imgOver === imgKey('general', i) ? ' thumb--over' : ''}`}
                  key={im.url}
                  title="Kéo để đổi vị trí ảnh"
                  {...imgDnd('general', i)}
                >
                  <img src={im.url} alt={im.name} draggable={false} />
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
              Kéo ảnh để đổi vị trí — ảnh đứng đầu là ảnh chính, hiện ở trang chủ. Đây là ảnh dùng chung khi khách chưa chọn màu nào cụ thể.
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
            type="button" className="chip chip--solid" style={{ height: 40 }}
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

      {/* ---------- Thông tin bán hàng: phân loại hàng (màu / size) ---------- */}
      <section className="panel">
        <h2>Thông tin bán hàng</h2>
        <p className="variant-label"><i className="req-dot" /> Phân loại hàng</p>

        {/* ----- Phân loại 1: Màu sắc ----- */}
        <div className="vgroup">
          <label className="vgroup__title" htmlFor="vg1">Phân loại 1</label>
          <input id="vg1" className="vgroup__name" value="Màu sắc" readOnly />
          <p className="vgroup__sub">Tùy chọn <i className="req-dot" /></p>
          <datalist id="color-suggest">
            {['Đen', 'Trắng', 'Xám', 'Be', 'Kem', 'Nâu', 'Đỏ', 'Hồng', 'Xanh lá', 'Xanh dương', 'Xanh navy'].map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <div className="opt-grid">
            {colors.map((c, i) => {
              const empty = colorEmpty(c);
              const hexOk = HEX_RE.test(c.hex.trim());
              const hexBad = c.hex.trim() !== '' && !hexOk;
              return (
                <div key={c.id} className="vopt-row" onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn('color', i)}>
                  <div className="opt-cell">
                    <input
                      className="opt-cell__main" list="color-suggest"
                      value={c.name} placeholder="Nhập hoặc chọn" aria-label={`Màu ${i + 1}`}
                      onChange={(e) => updateColor(c.id, { name: e.target.value })}
                    />
                    <div className={`opt-cell__side${hexBad ? ' opt-cell__side--bad' : ''}`}>
                      <label className="opt-swatch" title="Chọn màu hiển thị cho nút màu">
                        <i style={hexOk ? { background: c.hex.trim() } : undefined} />
                        <input
                          type="color" disabled={empty} tabIndex={-1}
                          value={hexOk ? c.hex.trim() : '#000000'}
                          onChange={(e) => updateColor(c.id, { hex: e.target.value.toUpperCase() })}
                        />
                      </label>
                      <input
                        value={c.hex} disabled={empty} maxLength={7}
                        placeholder="Mã màu #RRGGBB" aria-label={`Mã màu ${c.name || i + 1}`}
                        onChange={(e) => updateColor(c.id, { hex: e.target.value })}
                      />
                    </div>
                  </div>
                  {empty ? (
                    <span className="opt-spacer" />
                  ) : (
                    <>
                      <span
                        className="opt-icon opt-icon--drag" draggable title="Kéo để đổi thứ tự"
                        onDragStart={() => { dragRef.current = { list: 'color', index: i }; }}
                      >
                        <Move size={16} />
                      </span>
                      <button type="button" className="opt-icon" aria-label={`Xoá màu ${c.name}`} onClick={() => removeColor(c.id)}>
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="vgroup__hint">
            Gõ xong 1 màu thì ô mới tự hiện ra để nhập màu tiếp theo. Mã màu (không bắt buộc) dùng để vẽ chấm màu trên nút chọn màu ở trang sản phẩm.
            Ảnh riêng của từng màu thêm ở bảng “Danh sách phân loại hàng” bên dưới.
          </p>
        </div>

        {/* ----- Phân loại 2: Size ----- */}
        <div className="vgroup">
          <label className="vgroup__title" htmlFor="vg2">Phân loại 2</label>
          <input id="vg2" className="vgroup__name" value="Size" readOnly />
          <div className="radio-row" role="radiogroup" aria-label="Loại size">
            {SIZE_TYPES.map((t) => (
              <label key={t.key} className="radio">
                <input type="radio" name="sizeType" checked={sizeType === t.key} onChange={() => setSizeType(t.key)} />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
          <p className="vgroup__sub">Tùy chọn <i className="req-dot" /></p>
          {activePresets.length > 0 && (
            <div className="tag-row" style={{ marginBottom: '0.75rem' }}>
              {activePresets.map((s) => (
                <button
                  key={s} type="button" className="tag"
                  aria-pressed={validSizes.some((v) => v.toLowerCase() === s.toLowerCase())}
                  onClick={() => togglePresetSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <datalist id="size-suggest">{activePresets.map((s) => <option key={s} value={s} />)}</datalist>
          <div className="opt-grid">
            {sizeRows.map((r, i) => {
              const empty = sizeEmpty(r);
              return (
                <div key={r.id} className="vopt-row" onDragOver={(e) => e.preventDefault()} onDrop={() => dropOn('size', i)}>
                  <div className="opt-cell">
                    <input
                      className="opt-cell__main" list="size-suggest" maxLength={20}
                      value={r.value} placeholder="Nhập hoặc chọn" aria-label={`Size ${i + 1}`}
                      onChange={(e) => updateSizeRow(r.id, e.target.value)}
                    />
                  </div>
                  {empty ? (
                    <span className="opt-spacer" />
                  ) : (
                    <>
                      <span
                        className="opt-icon opt-icon--drag" draggable title="Kéo để đổi thứ tự"
                        onDragStart={() => { dragRef.current = { list: 'size', index: i }; }}
                      >
                        <Move size={16} />
                      </span>
                      <button type="button" className="opt-icon" aria-label={`Xoá size ${r.value}`} onClick={() => removeSizeRow(r.id)}>
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="vgroup__hint">
            Bấm nút gợi ý (S, M, L…) để thêm/bỏ nhanh, hoặc tự gõ size vào ô trống. Loại size chỉ để gợi ý — sản phẩm lưu đúng những size bạn nhập.
          </p>
        </div>
      </section>

      {/* ---------- Ma tran gia / ton kho ---------- */}
      {validColors.length > 0 && validSizes.length > 0 && (
        <section className="panel">
          <h2>Danh sách phân loại hàng</h2>
          <div className="variant-bulk">
            <div className="variant-bulk__fields">
              <label className="vt-input">
                <span className="vt-input__prefix">đ</span>
                <input
                  type="number" inputMode="numeric" min={0} placeholder="Giá"
                  aria-label="Giá áp dụng cho tất cả"
                  value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyBulk()}
                />
              </label>
              <label className="vt-input">
                <input
                  type="number" inputMode="numeric" min={0} placeholder="Kho hàng"
                  aria-label="Kho hàng áp dụng cho tất cả"
                  value={bulkStock} onChange={(e) => setBulkStock(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyBulk()}
                />
              </label>
              <label className="vt-input">
                <input
                  placeholder="SKU phân loại" maxLength={30}
                  aria-label="SKU (tiền tố) áp dụng cho tất cả"
                  value={bulkSku} onChange={(e) => setBulkSku(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyBulk()}
                />
              </label>
            </div>
            <button type="button" className="btn-dark" onClick={applyBulk} disabled={!canApplyBulk}>
              Áp dụng cho tất cả phân loại
            </button>
          </div>
          <p className="variant-hint">
            Nhập giá / kho hàng / SKU ở hàng trên rồi bấm nút đen để điền xuống toàn bộ bảng (ô nào để trống thì giữ nguyên).
            SKU nhập ở đây là tiền tố, hệ thống ghép thêm màu và size cho mỗi phân loại (VD: TAHO → TAHO-DEN-M).
            Giá để trống = dùng giá gốc. Bấm vào ảnh ở cột Màu sắc để thêm ảnh riêng cho màu đó — khách chọn màu trên trang sản phẩm sẽ thấy đúng ảnh này.
          </p>
          <div className="table-scroll">
            <table className="table variant-table">
              <thead>
                <tr>
                  <th className="center">Màu sắc</th>
                  <th className="center">Size</th>
                  <th>Giá</th>
                  <th>Kho hàng</th>
                  <th>SKU phân loại</th>
                </tr>
              </thead>
              <tbody>
                {validColors.flatMap((c) =>
                  validSizes.map((s, si) => {
                    const key = cellKey(c.name, s);
                    const cell = cells[key] ?? emptyCell();
                    return (
                      <tr key={key} className={si === 0 ? 'variant-table__first' : undefined}>
                        {si === 0 && (
                          <td className="variant-table__color" rowSpan={validSizes.length}>
                            <strong>{c.name}</strong>
                            <div className="variant-table__imgs">
                              {c.images.map((im, ii) => (
                                <div
                                  className={`variant-table__thumb thumb--drag${imgOver === imgKey(c.id, ii) ? ' thumb--over' : ''}`}
                                  key={im.url}
                                  title="Kéo để đổi vị trí ảnh"
                                  {...imgDnd(c.id, ii)}
                                >
                                  <img src={im.url} alt={`${c.name} — ${im.name}`} draggable={false} />
                                  <button type="button" onClick={() => removeColorImage(c.id, im.url)} aria-label={`Xoá ảnh ${im.name}`}>
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                className="variant-table__img variant-table__img--empty"
                                onClick={() => pickColorImages(c.id)}
                                disabled={uploadingColorId === c.id}
                                aria-label={`Thêm ảnh cho màu ${c.name}`}
                                title="Bấm để thêm ảnh cho màu này"
                              >
                                {uploadingColorId === c.id
                                  ? <span>Đang tải…</span>
                                  : <><Plus size={16} /><span>Thêm ảnh</span></>}
                              </button>
                            </div>
                          </td>
                        )}
                        <td className="center">{s}</td>
                        <td>
                          <label className="vt-input">
                            <span className="vt-input__prefix">đ</span>
                            <input
                              type="number" inputMode="numeric" min={0} placeholder={basePrice || '0'}
                              aria-label={`Giá ${c.name} ${s}`}
                              value={cell.priceOverride}
                              onChange={(e) => setCell(key, { priceOverride: e.target.value })}
                            />
                          </label>
                        </td>
                        <td>
                          <label className="vt-input">
                            <input
                              type="number" inputMode="numeric" min={0}
                              aria-label={`Kho hàng ${c.name} ${s}`}
                              value={cell.stockQty}
                              onChange={(e) => setCell(key, { stockQty: e.target.value })}
                            />
                          </label>
                        </td>
                        <td>
                          <label className="vt-input">
                            <input
                              placeholder="Nhập vào" maxLength={40}
                              aria-label={`SKU ${c.name} ${s}`}
                              value={cell.sku}
                              onChange={(e) => setCell(key, { sku: e.target.value })}
                            />
                          </label>
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
          : mode === 'edit' ? 'Lưu thay đổi' : 'Lưu sản phẩm'}
      </button>
      {!ready && (
        <p style={{ fontSize: 'var(--step--1)', color: 'var(--muted)', margin: '0.6rem 0 0' }}>
          Còn thiếu: {missing.join(', ')}.
        </p>
      )}
    </div>
  );
}
