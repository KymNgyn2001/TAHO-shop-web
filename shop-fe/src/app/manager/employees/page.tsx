// src/app/manager/employees/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import { ApiException, errorMessage } from '@/lib/api-client';
import type { Employee } from '@/lib/api-contract-admin';
import { useRequireRole, MANAGER_ROLES } from '@/lib/require-role';
import { roleLabel } from '@/lib/auth-context';

export default function ManagerEmployeesPage() {
  const { ready, user } = useRequireRole(MANAGER_ROLES);
  const isAdmin = user?.role === 'ADMIN';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'EMPLOYEE' | 'MANAGER'>('EMPLOYEE');
  const [autoPassword, setAutoPassword] = useState(true);
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTempPassword, setNewTempPassword] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (ready) adminApi.listEmployees(showDeleted).then(setEmployees).catch((e) => setError(errorMessage(e, 'Không tải được danh sách tài khoản.')));
  }, [ready, showDeleted]);

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
        role: isAdmin ? role : undefined,
      });
      if (!showDeleted) setEmployees((prev) => [emp, ...prev]);
      if (emp.temporaryPassword) setNewTempPassword({ email: emp.email, password: emp.temporaryPassword });
      setName(''); setEmail(''); setPhone(''); setPassword('');
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không tạo được tài khoản.');
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

  async function setDeleted(emp: Employee, deleted: boolean) {
    if (deleted && !window.confirm(`Xoá tài khoản "${emp.name}"? Tài khoản sẽ bị ẩn và không đăng nhập được (chỉ xoá mềm, có thể khôi phục).`)) return;
    setError(null);
    try {
      await adminApi.setEmployeeDeleted(emp.id, deleted);
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
    } catch (e) {
      setError(e instanceof ApiException ? e.message : 'Không cập nhật được.');
    }
  }

  if (!ready) return null;

  return (
    <div className="wrap admin">
      <h1>{isAdmin ? 'Quản lý tài khoản' : 'Tài khoản nhân viên'}</h1>
      {error && <p className="error-bar">{error}</p>}
      {newTempPassword && (
        <p className="error-bar" style={{ borderLeftColor: '#2E6B3E' }}>
          Đã tạo tài khoản cho <strong>{newTempPassword.email}</strong> — mật khẩu tạm thời:{' '}
          <strong>{newTempPassword.password}</strong> (chỉ hiện một lần, hãy gửi cho người dùng ngay).
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
        {isAdmin && (
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="erole">Vai trò</label>
            <select id="erole" value={role} onChange={(e) => setRole(e.target.value as 'EMPLOYEE' | 'MANAGER')}>
              <option value="EMPLOYEE">Nhân viên</option>
              <option value="MANAGER">Quản lý</option>
            </select>
          </div>
        )}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>
            {showDeleted ? 'Tài khoản đã xoá' : 'Danh sách'} ({employees.length})
          </h2>
          <button type="button" className="chip" onClick={() => setShowDeleted((v) => !v)}>
            {showDeleted ? 'Xem tài khoản đang dùng' : 'Xem tài khoản đã xoá'}
          </button>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Tên</th><th>Email</th><th>SĐT</th><th>Vai trò</th>
                <th className="center">Trạng thái</th><th />
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.email}</td>
                  <td>{e.phone ?? '—'}</td>
                  <td>{roleLabel(e.role)}</td>
                  <td className="center">
                    <span className="pill" data-s={e.active ? 'COMPLETED' : 'CANCELLED'}>
                      {e.deleted ? 'Đã xoá' : e.active ? 'Đang làm việc' : 'Đã khoá'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {e.deleted ? (
                        <button type="button" className="chip" onClick={() => setDeleted(e, false)}>Khôi phục</button>
                      ) : (
                        <>
                          <button type="button" className="chip" onClick={() => toggleActive(e)}>
                            {e.active ? 'Khoá' : 'Mở lại'}
                          </button>
                          <button type="button" className="chip" onClick={() => setDeleted(e, true)}>Xoá</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {employees.length === 0 && (
          <div className="empty"><p>{showDeleted ? 'Chưa có tài khoản nào bị xoá.' : 'Chưa có tài khoản nào.'}</p></div>
        )}
      </section>
    </div>
  );
}
