// src/app/account/password/page.tsx
'use client';

import { useState } from 'react';
import { api, ApiException } from '@/lib/api-client';
import { useRequireRole, ALL_ROLES } from '@/lib/require-role';

export default function ChangePasswordPage() {
  const { ready } = useRequireRole(ALL_ROLES);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!ready) return null;

  const mismatch = confirm !== '' && password !== confirm;
  const canSubmit = current !== '' && password.length >= 6 && password === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api.changePassword(current, password);
      setDone(true);
      setCurrent('');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof ApiException ? err.message : 'Không đổi được mật khẩu.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <div className="auth-page">
        <h1>Đổi mật khẩu</h1>
        {error && <p className="error-bar">{error}</p>}
        {done && (
          <p className="error-bar" style={{ borderLeftColor: '#2E6B3E' }}>Đã đổi mật khẩu thành công.</p>
        )}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="current">Mật khẩu hiện tại</label>
            <input id="current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="newpw">Mật khẩu mới (ít nhất 6 ký tự)</label>
            <input id="newpw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="confirm">Nhập lại mật khẩu mới</label>
            <input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {mismatch && (
            <p style={{ color: 'var(--accent)', fontSize: 'var(--step--1)', margin: '-0.5rem 0 1rem' }}>
              Mật khẩu nhập lại không khớp.
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={busy || !canSubmit}>
            {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}
