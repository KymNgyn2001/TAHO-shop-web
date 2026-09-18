// =====================================================================
// LOP GOI API  —  phan QUAN TRI
// Cung quy uoc voi src/lib/api-client.ts: NEXT_PUBLIC_USE_MOCK=true -> du lieu gia.
// =====================================================================

import { ApiException, getToken, sessionId, BASE_URL } from './api-client';
import type {
  UploadedImage,
  CategoryWithCount,
  CreateProductRequest,
  MonthlyStats,
  Transaction,
  ProductCard,
  Employee,
  CreateEmployeeRequest,
  CreateEmployeeResponse,
  ReviewForAdmin,
} from './api-contract-admin';
import type { CategoryGroup, Order, OrderStatus } from './api-contract';

type Page<T> = {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

type ProductDetail = ProductCard & {
  description: string | null;
  brand: string | null;
  material: string | null;
  sizeChartUrl: string | null;
};

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    let code = 'UNKNOWN';
    let message = 'Không kết nối được máy chủ. Thử lại sau ít phút.';
    try {
      const body = await res.json();
      code = body.code ?? code;
      message = body.message ?? message;
    } catch { /* body rong */ }
    throw new ApiException(code, message, res.status);
  }

  return res.status === 204 ? (undefined as T) : res.json();
}

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------
// Du lieu gia
// ---------------------------------------------------------------------

let mockCategories: CategoryWithCount[] = [
  { id: 1, name: 'Áo sơ mi', slug: 'ao-so-mi', group: 'Áo', productCount: 4 },
  { id: 2, name: 'Quần', slug: 'quan', group: 'Quần', productCount: 6 },
  { id: 3, name: 'Áo thun', slug: 'ao-thun', group: 'Áo', productCount: 9 },
];

const mockMonthlyStats: MonthlyStats = {
  month: '2026-09',
  totalOrders: 128,
  cancelledOrders: 11,
  totalRevenue: 86_400_000,
  avgOrderValue: 675_000,
  revenueChangePct: 8.4,
  daily: Array.from({ length: 15 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    orders: 4 + (i % 6),
    revenue: 2_000_000 + (i % 6) * 350_000,
  })),
  topProducts: [
    { productId: 1, productName: 'Áo sơ mi linen tay dài', quantitySold: 42, revenue: 19_278_000 },
    { productId: 3, productName: 'Áo thun cotton bo gân', quantitySold: 35, revenue: 8_715_000 },
    { productId: 2, productName: 'Quần âu ống suông', quantitySold: 21, revenue: 13_020_000 },
  ],
  categoryShare: [
    { categoryName: 'Áo sơ mi', quantitySold: 42 },
    { categoryName: 'Quần', quantitySold: 21 },
    { categoryName: 'Áo thun', quantitySold: 35 },
  ],
  mostViewed: [
    { productId: 1, productName: 'Áo sơ mi linen tay dài', viewCount: 214 },
    { productId: 3, productName: 'Áo thun cotton bo gân', viewCount: 178 },
    { productId: 2, productName: 'Quần âu ống suông', viewCount: 133 },
  ],
};

const mockTransactions: Transaction[] = Array.from({ length: 8 }, (_, i) => ({
  orderCode: `ORD-20260915-${String(i + 1).padStart(4, '0')}`,
  customerName: `Khách hàng ${i + 1}`,
  itemCount: 1 + (i % 3),
  totalAmount: 300_000 + i * 45_000,
  status: (['PENDING', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED'] as const)[i % 5],
  paymentMethod: i % 2 === 0 ? 'COD' : 'BANK_TRANSFER',
  createdAt: new Date(2026, 8, 1 + i).toISOString(),
}));

let mockEmployees: Employee[] = [
  { id: 2, name: 'Nhân Viên Ban Hàng', email: 'employee@shop.test', phone: null, role: 'EMPLOYEE', active: true, createdAt: new Date().toISOString() },
];

const mockReviewsAdmin: ReviewForAdmin[] = [
  {
    id: 1, productId: 1, productName: 'Áo sơ mi linen tay dài', customerName: 'Khách Hàng Demo',
    rating: 5, content: 'Vải mát, mặc rất thoải mái.', createdAt: new Date().toISOString(), reply: null,
  },
];

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');

// ---------------------------------------------------------------------
// API cong khai — UI chi goi nhung ham nay
// ---------------------------------------------------------------------

export const adminApi = {
  async uploadImage(file: File): Promise<UploadedImage> {
    if (!USE_MOCK) {
      const fd = new FormData();
      fd.append('file', file);
      const token = getToken();
      const res = await fetch(`${BASE_URL}/api/admin/uploads`, {
        method: 'POST', body: fd,
        headers: { 'X-Session-Id': sessionId(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        throw new ApiException(
          res.status === 413 ? 'FILE_TOO_LARGE' : 'UNSUPPORTED_TYPE',
          res.status === 413 ? 'Ảnh vượt quá 5MB.' : 'Định dạng ảnh không được hỗ trợ.',
          res.status,
        );
      }
      return res.json();
    }
    await delay(500);
    return { url: URL.createObjectURL(file), fileName: file.name, sizeBytes: file.size };
  },

  async listCategories(): Promise<CategoryWithCount[]> {
    if (!USE_MOCK) return request('/api/categories');
    await delay();
    return structuredClone(mockCategories);
  },

  async createCategory(name: string, group?: CategoryGroup): Promise<CategoryWithCount> {
    if (!USE_MOCK) {
      return request('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name, group }) });
    }
    await delay();
    if (mockCategories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      throw new ApiException('CATEGORY_EXISTS', 'Loại này đã tồn tại.', 409);
    }
    const c: CategoryWithCount = {
      id: Math.max(0, ...mockCategories.map((x) => x.id)) + 1,
      name,
      slug: slugify(name),
      group: group ?? null,
      productCount: 0,
    };
    mockCategories = [...mockCategories, c];
    return c;
  },

  async updateCategoryGroup(id: number, group: CategoryGroup | null): Promise<CategoryWithCount> {
    if (!USE_MOCK) {
      return request(`/api/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ group }) });
    }
    await delay();
    const c = mockCategories.find((x) => x.id === id);
    if (!c) throw new ApiException('NOT_FOUND', 'Không tìm thấy danh mục.', 404);
    c.group = group;
    return c;
  },

  async deleteCategory(id: number): Promise<void> {
    if (!USE_MOCK) return request(`/api/admin/categories/${id}`, { method: 'DELETE' });
    await delay();
    const c = mockCategories.find((x) => x.id === id);
    if (c && c.productCount > 0) {
      throw new ApiException('CATEGORY_NOT_EMPTY', 'Còn sản phẩm trong danh mục này.', 409);
    }
    mockCategories = mockCategories.filter((x) => x.id !== id);
  },

  async createProduct(body: CreateProductRequest): Promise<ProductDetail> {
    if (!USE_MOCK) return request('/api/admin/products', { method: 'POST', body: JSON.stringify(body) });
    await delay(600);
    const category = mockCategories.find((c) => c.id === body.categoryId);
    mockCategories = mockCategories.map((c) =>
      c.id === body.categoryId ? { ...c, productCount: c.productCount + 1 } : c,
    );
    return {
      id: Date.now(),
      name: body.name,
      slug: slugify(body.name),
      basePrice: body.basePrice,
      primaryImageUrl: body.images[0]?.url ?? null,
      categoryName: category?.name ?? null,
      audience: body.audience ?? 'UNISEX',
      description: body.description ?? null,
      brand: body.brand ?? null,
      material: body.material ?? null,
      sizeChartUrl: body.sizeChartImageUrl ?? null,
    };
  },

  async updateProduct(id: number, body: CreateProductRequest): Promise<ProductDetail> {
    if (!USE_MOCK) return request(`/api/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    await delay(600);
    const category = mockCategories.find((c) => c.id === body.categoryId);
    return {
      id,
      name: body.name,
      slug: slugify(body.name),
      basePrice: body.basePrice,
      primaryImageUrl: body.images[0]?.url ?? null,
      categoryName: category?.name ?? null,
      audience: body.audience ?? 'UNISEX',
      description: body.description ?? null,
      brand: body.brand ?? null,
      material: body.material ?? null,
      sizeChartUrl: body.sizeChartImageUrl ?? null,
    };
  },

  async deleteProduct(id: number): Promise<void> {
    if (!USE_MOCK) return request(`/api/admin/products/${id}`, { method: 'DELETE' });
    await delay(300);
  },

  async monthlyStats(month: string): Promise<MonthlyStats> {
    if (!USE_MOCK) return request(`/api/admin/stats/monthly?month=${month}`);
    await delay();
    return structuredClone({ ...mockMonthlyStats, month });
  },

  async transactions(page = 0, size = 20, status?: string): Promise<Page<Transaction>> {
    if (!USE_MOCK) {
      const q = new URLSearchParams({ page: String(page), size: String(size), ...(status ? { status } : {}) });
      return request(`/api/admin/transactions?${q}`);
    }
    await delay();
    const items = status ? mockTransactions.filter((t) => t.status === status) : mockTransactions;
    return { items: structuredClone(items), page, size, totalItems: items.length, totalPages: 1 };
  },

  // ---------- Don hang (toan bo, khac voi api.listOrders() chi tra don cua chinh minh) ----------

  async listAllOrders(page = 0, size = 20, status?: OrderStatus): Promise<Page<Order>> {
    if (!USE_MOCK) {
      const q = new URLSearchParams({ page: String(page), size: String(size), ...(status ? { status } : {}) });
      return request(`/api/admin/orders?${q}`);
    }
    await delay();
    return { items: [], page, size, totalItems: 0, totalPages: 1 };
  },

  // ---------- Danh gia ----------

  async listReviews(replied?: boolean): Promise<Page<ReviewForAdmin>> {
    if (!USE_MOCK) {
      const q = replied === undefined ? '' : `?replied=${replied}`;
      return request(`/api/admin/reviews${q}`);
    }
    await delay();
    const items = replied === undefined ? mockReviewsAdmin : mockReviewsAdmin.filter((r) => !!r.reply === replied);
    return { items: structuredClone(items), page: 0, size: 20, totalItems: items.length, totalPages: 1 };
  },

  async replyReview(reviewId: number, content: string): Promise<ReviewForAdmin> {
    if (!USE_MOCK) {
      return request(`/api/admin/reviews/${reviewId}/reply`, { method: 'POST', body: JSON.stringify({ content }) });
    }
    await delay(300);
    const review = mockReviewsAdmin.find((r) => r.id === reviewId);
    if (!review) throw new ApiException('NOT_FOUND', 'Không tìm thấy đánh giá.', 404);
    if (review.reply) throw new ApiException('ALREADY_REPLIED', 'Đánh giá này đã được trả lời.', 409);
    review.reply = { id: Date.now(), employeeName: 'Bạn', content, createdAt: new Date().toISOString() };
    return structuredClone(review);
  },

  // ---------- Nhan vien (MANAGER) ----------

  async listEmployees(): Promise<Employee[]> {
    if (!USE_MOCK) return request('/api/manager/employees');
    await delay();
    return structuredClone(mockEmployees);
  },

  async createEmployee(body: CreateEmployeeRequest): Promise<CreateEmployeeResponse> {
    if (!USE_MOCK) return request('/api/manager/employees', { method: 'POST', body: JSON.stringify(body) });
    await delay(400);
    if (mockEmployees.some((e) => e.email === body.email)) {
      throw new ApiException('EMAIL_EXISTS', 'Email này đã được sử dụng.', 409);
    }
    const employee: Employee = {
      id: Math.max(0, ...mockEmployees.map((e) => e.id)) + 1,
      name: body.name, email: body.email, phone: body.phone ?? null,
      role: 'EMPLOYEE', active: true, createdAt: new Date().toISOString(),
    };
    mockEmployees = [...mockEmployees, employee];
    return { ...employee, temporaryPassword: body.password ? null : Math.random().toString(36).slice(2, 10) };
  },

  async setEmployeeActive(id: number, active: boolean): Promise<Employee> {
    if (!USE_MOCK) return request(`/api/manager/employees/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) });
    await delay();
    mockEmployees = mockEmployees.map((e) => (e.id === id ? { ...e, active } : e));
    return mockEmployees.find((e) => e.id === id)!;
  },
};
