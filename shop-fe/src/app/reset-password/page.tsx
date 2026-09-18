// src/app/reset-password/page.tsx
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiException } from '@/lib/api-client';

/** useSearchParams() bat buoc phai nam trong <Suspense> khi build production
 * (next static prerender), khong thi bi loi "Error occurred prerendering page /". */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="wrap"><div className="skeleton" style={{ height: 240 }} /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const ready = token && password.length >= 6 && password === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Không đặt lại được mật khẩu.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="wrap">
        <div className="auth-page">
          <h1>Đặt lại mật khẩu</h1>
          <p className="error-bar">Link không hợp lệ — thiếu token. Bạn yêu cầu lại link mới nhé.</p>
          <p className="auth-page__foot"><Link href="/forgot-password">Quên mật khẩu</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="auth-page">
        <h1>Đặt lại mật khẩu</h1>
        {error && <p className="error-bar">{error}</p>}
        {done ? (
          <p className="error-bar" style={{ borderLeftColor: '#2E6B3E' }}>
            Đã đặt lại mật khẩu. Đang chuyển sang trang đăng nhập…
          </p>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="password">Mật khẩu mới</label>
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="confirm">Nhập lại mật khẩu mới</label>
              <input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {confirm && password !== confirm && (
              <p style={{ color: 'var(--accent)', fontSize: 'var(--step--1)', margin: '-0.5rem 0 1rem' }}>
                Mật khẩu nhập lại không khớp.
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={busy || !ready}>
              {busy ? 'Đang lưu…' : 'Đặt lại mật khẩu'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
