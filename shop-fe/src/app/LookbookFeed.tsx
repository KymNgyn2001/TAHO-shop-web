// src/components/LookbookFeed.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductCard } from '@/lib/api-contract';

const vnd = (n: number) => n.toLocaleString('vi-VN') + '\u00A0₫';

/**
 * Anh tu doi goc chup khi the dang trong tam nhin.
 * Chi the dang xem moi chay -> khong ton CPU cho ca danh sach.
 */
function Slide({ p, images }: { p: ProductCard; images: string[] }) {
  const ref = useRef<HTMLElement>(null);
  const [idx, setIdx] = useState(0);
  const [active, setActive] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setActive(e.intersectionRatio > 0.6),
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!active || reduced || images.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % images.length), 2600);
    return () => clearInterval(t);
  }, [active, images.length]);

  return (
    <article ref={ref} className="slide">
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt={i === 0 ? p.name : ''}
          className={`slide__img${i === idx ? ' slide__img--on' : ''}`}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}

      {images.length > 1 && (
        <div className="slide__ticks" aria-hidden>
          {images.map((src, i) => <i key={src} data-on={i === idx} />)}
        </div>
      )}

      <div className="slide__scrim" aria-hidden />

      <div className="slide__body">
        {p.categoryName && <span className="slide__cat">{p.categoryName}</span>}
        <h2 className="slide__name">{p.name}</h2>
        <span className="slide__price">{vnd(p.basePrice)}</span>
        <button
          type="button"
          className="slide__cta"
          onClick={() => router.push(`/products/${p.slug}`)}
        >
          Xem chi tiết
        </button>
      </div>
    </article>
  );
}

interface Props {
  products: ProductCard[];
  /** Anh phu theo id san pham, de anh tu doi goc. Thieu thi dung anh chinh. */
  extraImages?: Record<number, string[]>;
}

export default function LookbookFeed({ products, extraImages }: Props) {
  const [showNudge, setShowNudge] = useState(true);

  if (products.length === 0) return null;

  return (
    <div
      className="feed"
      onScroll={() => setShowNudge(false)}
      tabIndex={0}
      aria-label="Danh sách sản phẩm, cuộn dọc"
    >
      {products.map((p) => (
        <Slide
          key={p.id}
          p={p}
          images={
            extraImages?.[p.id]?.length
              ? extraImages[p.id]
              : [p.primaryImageUrl ?? '']
          }
        />
      ))}
      {showNudge && <span className="feed__nudge">Cuộn lên để xem tiếp</span>}
    </div>
  );
}
