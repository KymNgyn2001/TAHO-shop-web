// src/components/SiteHeader.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, ChevronDown, Search, User } from 'lucide-react';
import { useAuth, roleLabel } from '@/lib/auth-context';
import { useCart } from '@/lib/cart-context';
import { api, type Category } from '@/lib/api-client';

const AUDIENCE_LINKS = [
  { audience: 'MEN', label: 'Nam' },
  { audience: 'WOMEN', label: 'Nữ' },
  { audience: 'KIDS', label: 'Trẻ em' },
] as const;

export default function SiteHeader() {
  const { user, loading, logout } = useAuth();
  const { count } = useCart();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    api.categories().then(setCategories).catch(() => {});
  }, []);

  const accessoryCat = categories.find((c) => c.name.toLowerCase() === 'phụ kiện');

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    router.push('/');
    router.refresh();
  }

  function submitSearch() {
    const q = searchValue.trim();
    if (!q) return;
    router.push(`/?q=${encodeURIComponent(q)}`);
    setSearchOpen(false);
  }

  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Link href="/" className="wordmark">TAHO</Link>

        <nav className="header-nav">
          <div className="header-nav__item">
            <button
              type="button"
              className="header-nav__trigger"
              onClick={() => setCatMenuOpen((v) => !v)}
              aria-expanded={catMenuOpen}
            >
              Danh mục <ChevronDown size={13} strokeWidth={1.5} />
            </button>
            {catMenuOpen && (
              <>
                <button type="button" className="user-menu__scrim" aria-label="Đóng menu" onClick={() => setCatMenuOpen(false)} />
                <div className="header-nav__dropdown">
                  {categories.map((c) => (
                    <Link key={c.id} href={`/?categoryId=${c.id}`} onClick={() => setCatMenuOpen(false)}>
                      {c.name}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {AUDIENCE_LINKS.map((a) => (
            <Link key={a.audience} href={`/?audience=${a.audience}`} className="header-nav__item header-nav__link">
              {a.label}
            </Link>
          ))}

          {accessoryCat && (
            <Link href={`/?categoryId=${accessoryCat.id}`} className="header-nav__item header-nav__link">
              Phụ kiện
            </Link>
          )}

          <Link href="/" className="header-nav__item header-nav__link">Cửa hàng</Link>
        </nav>

        <div className="header-actions">
          <div className="header-nav__item">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSearchOpen((v) => !v)}
              aria-expanded={searchOpen}
              aria-label="Tìm sản phẩm"
            >
              <Search size={19} strokeWidth={1.5} />
            </button>
            {searchOpen && (
              <>
                <button type="button" className="user-menu__scrim" aria-label="Đóng tìm kiếm" onClick={() => setSearchOpen(false)} />
                <div className="header-search__dropdown">
                  <Search size={16} strokeWidth={1.5} aria-hidden />
                  <input
                    autoFocus
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
                    placeholder="Tìm sản phẩm…"
                    aria-label="Tìm sản phẩm"
                  />
                </div>
              </>
            )}
          </div>

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
                aria-label="Tài khoản"
              >
                <User size={19} strokeWidth={1.5} />
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
                    <p className="user-menu__role">{roleLabel(user.role)} · {user.name}</p>
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
        </div>
      </div>
    </header>
  );
}
