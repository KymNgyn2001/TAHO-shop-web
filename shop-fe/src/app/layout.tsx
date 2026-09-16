// src/app/layout.tsx
import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Baloo_2 } from 'next/font/google';
import './globals.css';
import './motion.css';
import './shop.css';
import { AuthProvider } from '@/lib/auth-context';
import { CartProvider } from '@/lib/cart-context';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import ChatWidget from '@/components/ChatWidget';

const sans = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['300', '500', '700'],
  variable: '--font-sans',
  display: 'swap',
});

/** Font rieng cho wordmark "TAHO" — net tron, mem hon font chinh cua trang. */
const wordmarkFont = Baloo_2({
  subsets: ['vietnamese', 'latin'],
  weight: ['700'],
  variable: '--font-wordmark',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TAHO — quần áo cơ bản',
  description: 'Tìm quần áo bằng câu mô tả hoặc bằng ảnh.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${sans.variable} ${wordmarkFont.variable}`}>
      <body>
        <AuthProvider>
          <CartProvider>
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
            <ChatWidget />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
