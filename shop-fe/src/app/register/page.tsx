// src/app/register/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiException } from '@/lib/api-client';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phoneClean = phone.replace(/[\s.\-()]/g, '');
  const phoneOk = phone.trim() === '' || /^(0|\+84)\d{9}$/.test(phoneClean);
  const passwordOk = password.length >= 6;
  const confirmOk = password === confirm;
  const canSubmit = name.trim().length >= 2 && phoneOk && passwordOk && confirmOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await register(name, email, password, phone || undefined);
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Đăng ký thất bại.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <div className="auth-page">
        <h1>Tạo tài khoản</h1>
        <p style={{ color: 'var(--muted)', fontSize: 'var(--step--1)', marginTop: '-0.5rem' }}>
          Dùng email thật để nhận xác nhận đơn hàng và đặt lại mật khẩu khi cần.
        </p>
        {error && <p className="error-bar">{error}</p>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Họ tên</label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="phone">Số điện thoại (không bắt buộc)</label>
            <input id="phone" inputMode="tel" placeholder="0901234567" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {!phoneOk && <small className="field-error">Số điện thoại cần đúng 10 chữ số, bắt đầu bằng 0 (hoặc để trống).</small>}
          </div>
          <div className="field">
            <label htmlFor="password">Mật khẩu</label>
            <input id="password" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
            {password !== '' && !passwordOk && <small className="field-error">Mật khẩu cần ít nhất 6 ký tự.</small>}
          </div>
          <div className="field">
            <label htmlFor="confirm">Nhập lại mật khẩu</label>
            <input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {confirm !== '' && !confirmOk && <small className="field-error">Mật khẩu nhập lại chưa khớp.</small>}
          </div>
          <button type="submit" className="btn-primary" disabled={busy || !canSubmit}>
            {busy ? 'Đang tạo…' : 'Đăng ký'}
          </button>
        </form>
        <p className="auth-page__foot">
          Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
