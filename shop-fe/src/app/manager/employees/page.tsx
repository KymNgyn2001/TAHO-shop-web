// src/app/manager/employees/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import { ApiException } from '@/lib/api-client';
import type { Employee } from '@/lib/api-contract-admin';
import { useRequireRole } from '@/lib/require-role';

export default function ManagerEmployeesPage() {
  const { ready } = useRequireRole(['MANAGER']);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [autoPassword, setAutoPassword] = useState(true);
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTempPassword, setNewTempPassword] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (ready) adminApi.listEmployees().then(setEmployees).catch(() => {});
  }, [ready]);

  async function create() {
    if (!name.trim() || !email.trim()) return;
    setCreating(true);
    setError(null);
    setNewTempPassword(null);
    try {
      const emp = await adminApi.createEmployee({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password: autoPassword ? undefined : password,
      });
      setEmployees((prev) => [emp, ...prev]);
      if (emp.temporaryPassword) setNewTempPassword({ email: emp.email, password: emp.temporaryPassword });
      setName(''); setEmail(''); setPhone(''); setPassword('');
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không tạo được tài khoản nhân viên.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(emp: Employee) {
    setError(null);
    try {
      const updated = await adminApi.setEmployeeActive(emp.id, !emp.active);
      setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không cập nhật được.');
    }
  }

  if (!ready) return null;

  return (
    <div className="wrap admin">
      <h1>Tài khoản nhân viên</h1>
      {error && <p className="error-bar">{error}</p>}
      {newTempPassword && (
        <p className="error-bar" style={{ borderLeftColor: '#2E6B3E' }}>
          Đã tạo tài khoản cho <strong>{newTempPassword.email}</strong> — mật khẩu tạm thời:{' '}
          <strong>{newTempPassword.password}</strong> (chỉ hiện một lần, hãy gửi cho nhân viên ngay).
        </p>
      )}

      <section className="panel">
        <h2>Tạo tài khoản mới</h2>
        <div className="field-row">
          <div className="field">
            <label htmlFor="ename">Họ tên</label>
            <input id="ename" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="eemail">Email</label>
            <input id="eemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="ephone">Số điện thoại (không bắt buộc)</label>
            <input id="ephone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="epw">Mật khẩu</label>
            <input
              id="epw" type="text" value={password} disabled={autoPassword}
              placeholder={autoPassword ? 'Hệ thống tự sinh' : ''}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 'var(--step--1)', marginBottom: '1rem' }}>
          <input type="checkbox" checked={autoPassword} onChange={(e) => setAutoPassword(e.target.checked)} />
          Tự động sinh mật khẩu
        </label>
        <button
          type="button" className="chip chip--solid"
          onClick={create}
          disabled={creating || !name.trim() || !email.trim() || (!autoPassword && password.length < 6)}
        >
          <Plus size={14} style={{ verticalAlign: '-2px' }} /> {creating ? 'Đang tạo…' : 'Tạo tài khoản'}
        </button>
      </section>

      <section className="panel">
        <h2>Danh sách nhân viên ({employees.length})</h2>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Tên</th><th>Email</th><th>SĐT</th><th className="center">Trạng thái</th><th /></tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.email}</td>
                  <td>{e.phone ?? '—'}</td>
                  <td className="center"><span className="pill" data-s={e.active ? 'COMPLETED' : 'CANCELLED'}>{e.active ? 'Đang làm việc' : 'Đã khoá'}</span></td>
                  <td>
                    <button type="button" className="chip" onClick={() => toggleActive(e)}>
                      {e.active ? 'Khoá' : 'Mở lại'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
