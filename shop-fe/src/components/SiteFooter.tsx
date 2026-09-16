// src/components/SiteFooter.tsx
import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__inner">
        <div>
          <Link href="/" className="wordmark">TAHO</Link>
          {/* CHO SUA SAU: dong mo ta ngan duoi logo (da bo theo yeu cau).
              Neu muon them lai, dat <p className="site-footer__tag">noi dung</p> ngay o day. */}
        </div>

        <div className="site-footer__contact">
          {/* CHO SUA SAU: email/SDT lien he cua TAHO */}
          <a href="mailto:tahowear@gmail.com">tahowear@gmail.com</a>
          <a href="tel:0939299099">0939 299 099</a>
        </div>
      </div>

      <div className="wrap site-footer__bottom">
        © {new Date().getFullYear()} TAHO. Mọi quyền được bảo lưu.
      </div>
    </footer>
  );
}
