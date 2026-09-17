// src/components/SiteFooter.tsx
import Link from 'next/link';
import { Package, ShieldCheck } from 'lucide-react';

/** lucide-react khong co icon thuong hieu (Facebook/TikTok/YouTube/Instagram) —
 * tu ve SVG toi gian, dung currentColor de an theo mau chu footer. */
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94Z" />
    </svg>
  );
}
function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M16.6 2h-3.1v13.2a2.9 2.9 0 1 1-2.05-2.77V9.2a6.1 6.1 0 1 0 5.15 6.03V8.4a7.6 7.6 0 0 0 4.4 1.4V6.7A4.5 4.5 0 0 1 16.6 2Z" />
    </svg>
  );
}
function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M21.6 7.2s-.21-1.5-.86-2.16c-.82-.87-1.74-.87-2.16-.92C15.6 4 12 4 12 4h-.01s-3.59 0-6.57.12c-.42.05-1.34.05-2.16.92C2.6 5.7 2.4 7.2 2.4 7.2S2.18 9 2.18 10.8v1.4c0 1.8.22 3.6.22 3.6s.21 1.5.85 2.16c.83.87 1.9.84 2.38.94C7.4 19 12 19 12 19s3.6-.01 6.58-.13c.42-.05 1.34-.05 2.16-.92.65-.66.86-2.16.86-2.16s.22-1.8.22-3.6v-1.4c0-1.8-.22-3.6-.22-3.6ZM9.96 14.6V8.8l5.4 2.9-5.4 2.9Z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__inner">
        <div className="site-footer__brand">
          <Link href="/" className="wordmark">TAHO</Link>
          {/* CHO SUA SAU: dong mo ta ngan duoi logo (da bo theo yeu cau).
              Neu muon them lai, dat <p className="site-footer__tag">noi dung</p> ngay o day. */}
          <div className="site-footer__contact">
            {/* CHO SUA SAU: email/SDT lien he cua TAHO */}
            <a href="mailto:tahowear@gmail.com">tahowear@gmail.com</a>
            <a href="tel:0939299099">0939 299 099</a>
          </div>

          <div className="site-footer__perks">
            <div className="site-footer__perk">
              <Package size={22} strokeWidth={1.5} />
              <div>
                <strong>Miễn phí ship</strong>
                <span>Toàn quốc</span>
              </div>
            </div>
            <div className="site-footer__perk">
              <ShieldCheck size={22} strokeWidth={1.5} />
              <div>
                <strong>Bảo hành</strong>
                <span>365 ngày</span>
              </div>
            </div>
          </div>
        </div>

        <div className="site-footer__community">
          <span className="site-footer__community-label">Cộng đồng TAHO</span>
          <div className="site-footer__social">
            {/* CHO SUA SAU: thay href="#" bang link mang xa hoi that cua TAHO */}
            <a href="#" aria-label="Facebook"><FacebookIcon /></a>
            <a href="#" aria-label="TikTok"><TikTokIcon /></a>
            <a href="#" aria-label="YouTube"><YoutubeIcon /></a>
            <a href="#" aria-label="Instagram"><InstagramIcon /></a>
          </div>
        </div>
      </div>

      <div className="wrap site-footer__bottom">
        © {new Date().getFullYear()} TAHO. Mọi quyền được bảo lưu.
      </div>
    </footer>
  );
}
