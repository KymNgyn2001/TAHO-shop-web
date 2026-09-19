// src/app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="empty">
        <h1 style={{ fontWeight: 300 }}>Không tìm thấy trang</h1>
        <p>Đường dẫn này không tồn tại hoặc đã bị gỡ. Bạn quay về trang chủ để xem sản phẩm nhé.</p>
        <Link href="/" className="chip chip--solid">Về trang chủ</Link>
      </div>
    </div>
  );
}
