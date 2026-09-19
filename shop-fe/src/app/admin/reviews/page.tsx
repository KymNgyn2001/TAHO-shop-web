// src/app/admin/reviews/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import { ApiException, errorMessage } from '@/lib/api-client';
import type { ReviewForAdmin } from '@/lib/api-contract-admin';
import { useRequireRole, STAFF_ROLES } from '@/lib/require-role';

function ReviewRow({ review, onReplied }: { review: ReviewForAdmin; onReplied: (r: ReviewForAdmin) => void }) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!content.trim()) return;
    setSending(true);
    setError(null);
    try {
      const updated = await adminApi.replyReview(review.id, content.trim());
      onReplied(updated);
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không gửi được phản hồi.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="review">
      <div className="review__head">
        <span className="review__author">{review.customerName} — {review.productName}</span>
        <span className="review__date">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</span>
      </div>
      <span className="review__stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
      <p className="review__content">{review.content}</p>

      {review.reply ? (
        <div className="review__reply">
          <strong>Đã trả lời</strong>
          {review.reply.content}
        </div>
      ) : (
        <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.4rem', maxWidth: 480 }}>
          {error && <p className="error-bar">{error}</p>}
          <textarea rows={2} placeholder="Trả lời khách hàng…" value={content} onChange={(e) => setContent(e.target.value)} />
          <button type="button" className="chip" style={{ justifySelf: 'start' }} onClick={send} disabled={sending || !content.trim()}>
            {sending ? 'Đang gửi…' : 'Gửi phản hồi'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminReviewsPage() {
  const { ready } = useRequireRole(STAFF_ROLES);
  const [reviews, setReviews] = useState<ReviewForAdmin[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'replied'>('pending');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    function load() {
      setLoading(true);
      setLoadError(null);
      const replied = filter === 'all' ? undefined : filter === 'replied';
      adminApi.listReviews(replied)
        .then((p) => setReviews(p.items))
        .catch((e) => setLoadError(errorMessage(e, 'Không tải được đánh giá.')))
        .finally(() => setLoading(false));
    }
    load();
  }, [ready, filter]);

  if (!ready) return null;

  return (
    <div className="wrap admin">
      <h1>Đánh giá khách hàng</h1>

      <div className="view-toggle">
        <button type="button" aria-pressed={filter === 'pending'} onClick={() => setFilter('pending')}>Chưa trả lời</button>
        <button type="button" aria-pressed={filter === 'replied'} onClick={() => setFilter('replied')}>Đã trả lời</button>
        <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Tất cả</button>
      </div>

      {loadError && <p className="error-bar">{loadError}</p>}

      {loading ? (
        <div className="skeleton" style={{ height: 160 }} />
      ) : reviews.length === 0 ? (
        <div className="empty"><p>Không có đánh giá nào ở mục này.</p></div>
      ) : (
        <section className="panel">
          {reviews.map((r) => (
            <ReviewRow
              key={r.id}
              review={r}
              onReplied={(updated) => setReviews((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
            />
          ))}
        </section>
      )}
    </div>
  );
}
