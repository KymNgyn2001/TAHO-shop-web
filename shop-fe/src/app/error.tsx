// src/app/error.tsx
'use client';

import Link from 'next/link';

/** Loi khong bat duoc trong luc ve trang — hien thong bao than thien thay vi man hinh trang/loi ky thuat. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap">
      <div className="empty">
        <h1 style={{ fontWeight: 300 }}>Có lỗi xảy ra</h1>
        <p>Trang này tạm thời không hiển thị được. Bạn thử tải lại, hoặc quay về trang chủ nhé.</p>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
          <button type="button" className="chip chip--solid" onClick={reset}>Thử lại</button>
          <Link href="/" className="chip">Về trang chủ</Link>
        </div>
      </div>
    </div>
  );
}
