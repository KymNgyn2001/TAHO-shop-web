// src/app/layout.tsx
import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';
import './motion.css';
import './shop.css';
import { AuthProvider } from '@/lib/auth-context';
import { CartProvider } from '@/lib/cart-context';
import SiteHeader from '@/components/SiteHeader';
import ChatWidget from '@/components/ChatWidget';

const sans = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['300', '500', '700'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Nếp — quần áo cơ bản',
  description: 'Tìm quần áo bằng câu mô tả hoặc bằng ảnh.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={sans.variable}>
      <body>
        <AuthProvider>
          <CartProvider>
            <SiteHeader />
            <main>{children}</main>
            <ChatWidget />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
