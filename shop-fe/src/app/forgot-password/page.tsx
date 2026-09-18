// src/app/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, ApiException } from '@/lib/api-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.forgotPassword(email.trim());
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Có lỗi xảy ra, bạn thử lại sau nhé.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <div className="auth-page">
        <h1>Quên mật khẩu</h1>
        <p style={{ color: 'var(--muted)', fontSize: 'var(--step--1)', marginTop: '-0.5rem' }}>
          Nhập email đã đăng ký — mình sẽ gửi link đặt lại mật khẩu.
        </p>
        {error && <p className="error-bar">{error}</p>}
        {message ? (
          <p className="error-bar" style={{ borderLeftColor: '#2E6B3E' }}>{message}</p>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary" disabled={busy || !email.trim()}>
              {busy ? 'Đang gửi…' : 'Gửi link đặt lại mật khẩu'}
            </button>
          </form>
        )}
        <p className="auth-page__foot">
          Nhớ mật khẩu rồi? <Link href="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
