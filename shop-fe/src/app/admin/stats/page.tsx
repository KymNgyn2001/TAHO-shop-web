// src/app/admin/stats/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { adminApi } from "@/lib/admin-api";
import { ApiException } from "@/lib/api-client";
import type { MonthlyStats, Transaction } from "@/lib/api-contract-admin";
import { useRequireRole } from "@/lib/require-role";

const vnd = (n: number) => n.toLocaleString("vi-VN") + " ₫";
const short = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}tr`
    : `${Math.round(n / 1000)}k`;

const INK = "#22201C";
const ACCENT = "#6E2B4E";
const SLICES = ["#6E2B4E", "#22201C", "#7A766E", "#B08CA0", "#C9C5BC"];

const STATUS_VI: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã huỷ",
};

function thisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function StatsPage() {
  const { ready } = useRequireRole(["MANAGER"]);
  const [month, setMonth] = useState(thisMonth());
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [tx, setTx] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    function load() {
      setLoading(true);
      setError(null);
      Promise.all([adminApi.monthlyStats(month), adminApi.transactions()])
        .then(([s, t]) => {
          if (!alive) return;
          setStats(s);
          setTx(t.items);
        })
        .catch((e) =>
          setError(
            e instanceof ApiException ? e.message : "Không tải được số liệu.",
          ),
        )
        .finally(() => alive && setLoading(false));
    }
    load();
    return () => {
      alive = false;
    };
  }, [ready, month]);

  if (!ready) return null;

  if (loading) {
    return (
      <div className="wrap admin">
        <div className="skeleton" style={{ height: 320 }} />
      </div>
    );
  }
  if (error || !stats) {
    return (
      <div className="wrap admin">
        <p className="error-bar">{error}</p>
      </div>
    );
  }

  const dir =
    stats.revenueChangePct === null
      ? null
      : stats.revenueChangePct >= 0
        ? "up"
        : "down";

  return (
    <div className="wrap admin">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h1>Báo cáo bán hàng</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{
            border: "1px solid var(--line)",
            borderRadius: 4,
            padding: "0.5rem 0.7rem",
            font: "inherit",
          }}
          aria-label="Chọn tháng"
        />
      </div>

      {/* ---------- Bốn con số ---------- */}
      <div className="stat-row">
        <div className="stat">
          <p className="stat__label">Doanh thu</p>
          <div className="stat__value">{vnd(stats.totalRevenue)}</div>
          {dir && (
            <span className="stat__delta" data-dir={dir}>
              {dir === "up" ? "▲" : "▼"}{" "}
              {Math.abs(stats.revenueChangePct!).toFixed(1)}% so với tháng trước
            </span>
          )}
        </div>
        <div className="stat">
          <p className="stat__label">Đơn thành công</p>
          <div className="stat__value">{stats.totalOrders}</div>
        </div>
        <div className="stat">
          <p className="stat__label">Đơn bị huỷ</p>
          <div className="stat__value">{stats.cancelledOrders}</div>
          <span
            className="stat__delta"
            data-dir={
              stats.cancelledOrders > stats.totalOrders * 0.1
                ? "down"
                : undefined
            }
          >
            {stats.totalOrders + stats.cancelledOrders > 0
              ? `${((stats.cancelledOrders / (stats.totalOrders + stats.cancelledOrders)) * 100).toFixed(0)}% tổng đơn`
              : "—"}
          </span>
        </div>
        <div className="stat">
          <p className="stat__label">Giá trị đơn trung bình</p>
          <div className="stat__value">
            {vnd(Math.round(stats.avgOrderValue))}
          </div>
        </div>
      </div>

      {/* ---------- Doanh thu theo ngày ---------- */}
      <section className="panel">
        <h2>Doanh thu theo ngày</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={stats.daily} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid stroke="#ECEDEA" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => d.slice(8)}
              stroke="#7A766E"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={short}
              stroke="#7A766E"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              formatter={(v) => vnd(Number(v))}
              labelFormatter={(d) => `Ngày ${String(d).slice(8)}`}
              contentStyle={{
                border: "1px solid #DDDAD3",
                borderRadius: 4,
                fontSize: 13,
              }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={ACCENT}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* ---------- Duoc quan tam nhieu (theo luot xem) ---------- */}
      <section className="panel">
        <h2>Sản phẩm được quan tâm nhiều</h2>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Sản phẩm</th><th className="num">Lượt xem</th></tr></thead>
            <tbody>
              {stats.mostViewed.map((p) => (
                <tr key={p.productId}>
                  <td>{p.productName}</td>
                  <td className="num">{p.viewCount.toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- Bán chạy + tỉ trọng ---------- */}
      <section className="panel">
        <h2>Mặt hàng bán chạy</h2>
        <ResponsiveContainer
          width="100%"
          height={Math.max(200, stats.topProducts.length * 42)}
        >
          <BarChart
            data={stats.topProducts}
            layout="vertical"
            margin={{ left: 4, right: 16 }}
          >
            <CartesianGrid stroke="#ECEDEA" horizontal={false} />
            <XAxis
              type="number"
              stroke="#7A766E"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="productName"
              width={130}
              stroke={INK}
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(v, k) =>
                k === "quantitySold" ? `${v} sản phẩm` : vnd(Number(v))
              }
              contentStyle={{
                border: "1px solid #DDDAD3",
                borderRadius: 4,
                fontSize: 13,
              }}
            />
            <Bar dataKey="quantitySold" fill={INK} radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel">
        <h2>Tỉ trọng theo loại</h2>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={stats.categoryShare}
              dataKey="quantitySold"
              nameKey="categoryName"
              innerRadius={54}
              outerRadius={92}
              paddingAngle={2}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label={(e: any) => e.categoryName}
            >
              {stats.categoryShare.map((_, i) => (
                <Cell key={i} fill={SLICES[i % SLICES.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => `${v} sản phẩm`}
              contentStyle={{
                border: "1px solid #DDDAD3",
                borderRadius: 4,
                fontSize: 13,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </section>

      {/* ---------- Lịch sử giao dịch ---------- */}
      <section className="panel">
        <h2>Lịch sử giao dịch</h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách</th>
                <th className="num">SP</th>
                <th className="center">Tổng tiền</th>
                <th className="center">Trạng thái</th>
                <th>Ngày</th>
              </tr>
            </thead>
            <tbody>
              {tx.map((t) => (
                <tr key={t.orderCode}>
                  <td>{t.orderCode}</td>
                  <td>{t.customerName}</td>
                  <td className="num">{t.itemCount}</td>
                  <td className="center">{vnd(t.totalAmount)}</td>
                  <td className="center">
                    <span className="pill" data-s={t.status}>
                      {STATUS_VI[t.status]}
                    </span>
                  </td>
                  <td>{new Date(t.createdAt).toLocaleDateString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tx.length === 0 && (
          <div className="empty">
            <p>Tháng này chưa có giao dịch nào.</p>
          </div>
        )}
      </section>
    </div>
  );
}
