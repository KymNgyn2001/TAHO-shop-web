// src/components/ReviewSection.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { api, ApiException, type Review } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';

function Stars({ value }: { value: number }) {
  return <span className="review__stars">{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span>;
}

export default function ReviewSection({ productId }: { productId: number }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    api.listReviews(productId).then((r) => alive && setReviews(r)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [productId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSending(true);
    setError(null);
    try {
      const review = await api.createReview(productId, { rating, content: content.trim() });
      setReviews((prev) => [review, ...prev]);
      setContent('');
      setRating(5);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Không gửi được đánh giá.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="reviews">
      <h2>Đánh giá từ khách hàng {reviews.length > 0 && `(${reviews.length})`}</h2>

      {user?.role === 'CUSTOMER' ? (
        <form className="review-form" onSubmit={submit}>
          <div className="star-input">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" data-on={n <= rating} onClick={() => setRating(n)} aria-label={`${n} sao`}>
                <Star size={20} fill={n <= rating ? 'currentColor' : 'none'} strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            placeholder="Sản phẩm mặc thế nào, chất liệu ra sao, có lên đồ đúng ý không…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          {error && <p className="error-bar">{error}</p>}
          <button type="submit" className="btn-secondary" disabled={sending || !content.trim()} style={{ width: 'auto', padding: '0 1.5rem' }}>
            {sending ? 'Đang gửi…' : 'Gửi đánh giá'}
          </button>
        </form>
      ) : !user ? (
        <p style={{ fontSize: 'var(--step--1)', color: 'var(--muted)', marginBottom: '1.25rem' }}>
          <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Đăng nhập</Link> để viết đánh giá cho sản phẩm này.
        </p>
      ) : null}

      {loading ? (
        <div className="skeleton" style={{ height: 80 }} />
      ) : reviews.length === 0 ? (
        <p style={{ fontSize: 'var(--step--1)', color: 'var(--muted)' }}>Chưa có đánh giá nào cho sản phẩm này.</p>
      ) : (
        reviews.map((r) => (
          <div className="review" key={r.id}>
            <div className="review__head">
              <span className="review__author">{r.customerName}</span>
              <span className="review__date">{new Date(r.createdAt).toLocaleDateString('vi-VN')}</span>
            </div>
            <Stars value={r.rating} />
            <p className="review__content">{r.content}</p>
            {r.reply && (
              <div className="review__reply">
                <strong>Phản hồi từ shop</strong>
                {r.reply.content}
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );
}
