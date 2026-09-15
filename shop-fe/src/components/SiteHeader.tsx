// src/components/SiteHeader.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, ChevronDown } from 'lucide-react';
import { useAuth, roleLabel } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';

export default function SiteHeader() {
  const { user, loading, logout } = useAuth();
  const { count } = useCart();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.push('/');
    router.refresh();
  }

  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Link href="/" className="wordmark">TAHO</Link>

        <nav className="header-actions">
          <Link href="/orders">Đơn hàng</Link>

          {(user?.role === 'EMPLOYEE' || user?.role === 'MANAGER') && (
            <Link href="/admin/products">Quản trị</Link>
          )}

          <Link href="/cart" className="cart-link" aria-label="Giỏ hàng">
            <ShoppingBag size={20} strokeWidth={1.5} />
            {count > 0 && <span className="cart-count">{count > 99 ? '99+' : count}</span>}
          </Link>

          {loading ? null : user ? (
            <div className="user-menu">
              <button
                type="button"
                className="user-menu__trigger"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
              >
                {user.name.split(' ').slice(-1)[0]}
                <ChevronDown size={14} strokeWidth={1.5} />
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    className="user-menu__scrim"
                    aria-label="Đóng menu"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="user-menu__panel">
                    <p className="user-menu__role">{roleLabel(user.role)}</p>
                    <p className="user-menu__email">{user.email}</p>
                    <hr />
                    <Link href="/orders" onClick={() => setMenuOpen(false)}>Đơn hàng của tôi</Link>
                    {user.role === 'MANAGER' && (
                      <>
                        <Link href="/admin/stats" onClick={() => setMenuOpen(false)}>Báo cáo KPI</Link>
                        <Link href="/manager/employees" onClick={() => setMenuOpen(false)}>Nhân viên</Link>
                      </>
                    )}
                    {(user.role === 'EMPLOYEE' || user.role === 'MANAGER') && (
                      <>
                        <Link href="/admin/products" onClick={() => setMenuOpen(false)}>Sản phẩm</Link>
                        <Link href="/admin/products/new" onClick={() => setMenuOpen(false)}>Đăng sản phẩm</Link>
                        <Link href="/admin/categories" onClick={() => setMenuOpen(false)}>Danh mục</Link>
                        <Link href="/admin/reviews" onClick={() => setMenuOpen(false)}>Đánh giá khách hàng</Link>
                      </>
                    )}
                    <button type="button" onClick={handleLogout}>Đăng xuất</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link href="/login" className="btn-ghost">Đăng nhập</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
