// src/app/products/[slug]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiException } from '@/lib/api-client';
import type { ProductCard, ProductDetail } from '@/lib/api-contract';
import ProductGrid from '@/components/ProductGrid';
import ReviewSection from '@/components/ReviewSection';
import { useCart } from '@/lib/cart-context';

const vnd = (n: number) => n.toLocaleString('vi-VN') + ' ₫';

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { refresh: refreshCart } = useCart();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [similar, setSimilar] = useState<ProductCard[]>([]);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .getProduct(slug)
      .then((p) => {
        if (!alive) return;
        setProduct(p);
        const first = p.variants.find((v) => v.inStock) ?? p.variants[0];
        setColor(first?.color ?? null);
        setSize(first?.size ?? null);
        return api.similar(p.id);
      })
      .then((s) => {
        if (alive && s) setSimilar(s);
      })
      .catch((e) =>
        setError(
          e instanceof ApiException ? e.message : 'Không tải được sản phẩm.',
        ),
      );
    return () => {
      alive = false;
    };
  }, [slug]);

  const colors = useMemo(
    () => [
      ...new Map(product?.variants.map((v) => [v.color, v]) ?? []).values(),
    ],
    [product],
  );
  const sizes = useMemo(
    () => product?.variants.filter((v) => v.color === color) ?? [],
    [product, color],
  );
  const galleryImages = useMemo(() => {
    if (!product) return [];
    const forColor = product.images.filter((im) => im.color === color);
    if (forColor.length > 0) return forColor;
    const general = product.images.filter((im) => !im.color);
    return general.length > 0 ? general : product.images;
  }, [product, color]);

  useEffect(() => {
    function reset() {
      setActiveImage(0);
    }
    reset();
  }, [galleryImages]);
  const selected = useMemo(
    () =>
      product?.variants.find((v) => v.color === color && v.size === size) ??
      null,
    [product, color, size],
  );

  if (error)
    return (
      <div className="wrap">
        <p className="error-bar">{error}</p>
      </div>
    );

  if (!product) {
    return (
      <div className="wrap detail">
        <div className="skeleton" style={{ aspectRatio: '3/4' }} />
      </div>
    );
  }

  async function addToCart() {
    if (!selected) return;
    setAdding(true);
    setError(null);
    try {
      await api.addToCart(selected.id, 1);
      await refreshCart();
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch (e) {
      setError(
        e instanceof ApiException
          ? e.message
          : 'Thêm vào giỏ không thành công.',
      );
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="wrap">
      <div className="detail">
        <div className="detail__gallery">
          <div className="detail__main-image">
            {galleryImages[activeImage] && (
              <img
                src={galleryImages[activeImage].url}
                alt={galleryImages[activeImage].altText ?? product.name}
              />
            )}
          </div>
          {galleryImages.length > 1 && (
            <div className="detail__thumbs">
              {galleryImages.map((im, i) => (
                <button
                  key={im.url + i}
                  type="button"
                  className="detail__thumb"
                  aria-pressed={activeImage === i}
                  aria-label={`Xem ảnh ${i + 1}`}
                  onClick={() => setActiveImage(i)}
                >
                  <img src={im.url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail__info">
          <h1 className="detail__name">{product.name}</h1>
          <p className="detail__price">
            {vnd(selected?.price ?? product.basePrice)}
          </p>

          <p className="opt-label">Màu</p>
          <div className="opt-row">
            {colors.map((v) => (
              <button
                key={v.color}
                type="button"
                className="swatch swatch--color"
                aria-pressed={color === v.color}
                onClick={() => {
                  setColor(v.color);
                  const avail = product.variants.find(
                    (x) => x.color === v.color && x.inStock,
                  );
                  setSize(avail?.size ?? null);
                }}
              >
                <i style={{ background: v.colorHex ?? 'transparent' }} />
                {v.color}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p className="opt-label">Size</p>
            {product.sizeChartUrl && (
              <button
                type="button"
                className="link-remove"
                style={{ marginBottom: '0.5rem' }}
                onClick={() => setShowSizeChart((v) => !v)}
              >
                {showSizeChart ? 'Ẩn bảng size' : 'Xem bảng size'}
              </button>
            )}
          </div>
          <div className="opt-row">
            {sizes.map((v) => (
              <button
                key={v.id}
                type="button"
                className="swatch"
                aria-pressed={size === v.size}
                disabled={!v.inStock}
                title={v.inStock ? undefined : 'Hết hàng'}
                onClick={() => setSize(v.size)}
              >
                {v.size}
              </button>
            ))}
          </div>

          {showSizeChart && product.sizeChartUrl && (
            <img src={product.sizeChartUrl} alt="Bảng size" style={{ width: '100%', marginBottom: '1.25rem' }} />
          )}

          <button
            type="button"
            className="btn-primary"
            disabled={!selected?.inStock || adding}
            onClick={addToCart}
          >
            {adding
              ? 'Đang thêm…'
              : added
                ? 'Đã thêm vào giỏ'
                : !selected
                  ? 'Chọn màu và size'
                  : !selected.inStock
                    ? 'Hết hàng'
                    : 'Thêm vào giỏ'}
          </button>

          {selected?.inStock && selected.stockQty <= 5 && (
            <p className="stock-note">
              Chỉ còn {selected.stockQty} sản phẩm size {selected.size}.
            </p>
          )}
          {error && <p className="error-bar">{error}</p>}

          <dl className="detail__meta">
            {product.description && (
              <>
                <dt>Mô tả</dt>
                <dd>{product.description}</dd>
              </>
            )}
            {product.material && (
              <>
                <dt>Chất liệu</dt>
                <dd>{product.material}</dd>
              </>
            )}
            {product.brand && (
              <>
                <dt>Thương hiệu</dt>
                <dd>{product.brand}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      <ReviewSection productId={product.id} />

      {similar.length > 0 && (
        <>
          <div className="section-head">
            <h2>Kiểu tương tự</h2>
            <span>gợi ý theo hình ảnh và mô tả</span>
          </div>
          <ProductGrid products={similar} />
        </>
      )}
    </div>
  );
}
