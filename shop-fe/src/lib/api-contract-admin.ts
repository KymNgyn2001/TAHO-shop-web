// =====================================================================
// BO SUNG HOP DONG API  —  phan QUAN TRI
// Dan noi dung file nay vao CUOI src/lib/api-contract.ts
// va gui lai cho ban lam backend.
// =====================================================================

import type { ProductCard, Review, Role, CategoryGroup } from './api-contract';

// ---------------------------------------------------------------------
// Upload anh
// ---------------------------------------------------------------------

export interface UploadedImage {
  url: string;          // duong dan cuoi cung, vd /uploads/2026/09/abc.jpg
  fileName: string;
  sizeBytes: number;
}

// ---------------------------------------------------------------------
// Danh muc (nhan vien tu them duoc)
// ---------------------------------------------------------------------

export interface CategoryWithCount {
  id: number;
  name: string;
  slug: string;
  group: CategoryGroup | null;
  productCount: number;
}

export interface CreateCategoryRequest {
  name: string;         // BE tu sinh slug tu name, FE khong gui slug
  group?: CategoryGroup;
}

export interface UpdateCategoryGroupRequest {
  group: CategoryGroup | null;
}

// ---------------------------------------------------------------------
// Tao san pham
// ---------------------------------------------------------------------

export interface CreateVariantInput {
  size: string;
  color: string;
  colorHex?: string;
  priceOverride?: number;
  stockQty: number;
}

export interface CreateProductImageInput {
  url: string;             // lay tu ket qua uploadImage
  /** Bo trong = anh chung. Dat ten mau = anh chi hien khi khach chon mau do. */
  color?: string;
}

export interface CreateProductRequest {
  name: string;
  categoryId: number;
  basePrice: number;
  description?: string;
  brand?: string;
  material?: string;
  images: CreateProductImageInput[]; // phan tu [0] la anh chinh (anh bia)
  sizeChartImageUrl?: string; // anh bang size, cung lay tu uploadImage
  /** Bo trong -> BE mac dinh UNISEX. */
  audience?: 'MEN' | 'WOMEN' | 'KIDS' | 'UNISEX';
  variants: CreateVariantInput[];
}

// ---------------------------------------------------------------------
// Thong ke cho quan ly
// ---------------------------------------------------------------------

export interface DailyPoint {
  date: string;         // 2026-09-01
  orders: number;
  revenue: number;
}

export interface TopProduct {
  productId: number;
  productName: string;
  quantitySold: number;
  revenue: number;
}

/** "San pham dang duoc quan tam nhieu" — xep theo luot xem trang chi tiet. */
export interface MostViewedProduct {
  productId: number;
  productName: string;
  viewCount: number;
}

export interface CategoryShare {
  categoryName: string;
  quantitySold: number;
}

export interface MonthlyStats {
  month: string;             // 2026-09
  totalOrders: number;       // khong tinh don CANCELLED
  cancelledOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  /** So sanh voi thang truoc, don vi %. Am la giam. null neu khong co du lieu. */
  revenueChangePct: number | null;
  daily: DailyPoint[];
  topProducts: TopProduct[];
  categoryShare: CategoryShare[];
  /** KPI cho Manager: san pham duoc quan tam nhieu nhat (theo luot xem, tinh toan bo). */
  mostViewed: MostViewedProduct[];
}

export interface Transaction {
  orderCode: string;
  customerName: string;
  itemCount: number;
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';
  paymentMethod: 'COD' | 'BANK_TRANSFER';
  createdAt: string;
}

// ---------------------------------------------------------------------
// Nhan vien (chi MANAGER duoc tao/quan ly)
// ---------------------------------------------------------------------

export interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;           // luon la 'EMPLOYEE'
  active: boolean;
  createdAt: string;
}

export interface CreateEmployeeRequest {
  name: string;
  email: string;
  phone?: string;
  /** Bo trong -> BE tu sinh mat khau ngau nhien (auto). */
  password?: string;
}

export interface CreateEmployeeResponse extends Employee {
  /** Chi tra ve DUY NHAT 1 lan luc tao, khi BE tu sinh mat khau. */
  temporaryPassword: string | null;
}

// ---------------------------------------------------------------------
// Quan ly danh gia — Employee/Manager xem va tra loi
// ---------------------------------------------------------------------

export interface ReviewForAdmin extends Review {
  productName: string;
}

export interface ReplyReviewRequest {
  content: string;
}

// =====================================================================
// ENDPOINT MOI  —  tat ca deu can dang nhap + dung role
// =====================================================================
//
// POST   /api/admin/uploads          multipart: file  -> UploadedImage   [EMPLOYEE, MANAGER]
//        Gioi han 10MB, chi nhan jpeg/png/webp.
//        Loi: 413 FILE_TOO_LARGE, 415 UNSUPPORTED_TYPE
//
// GET    /api/categories                        -> CategoryWithCount[]  [cong khai]
// POST   /api/admin/categories  CreateCategoryRequest -> CategoryWithCount [EMPLOYEE, MANAGER]
//        Loi: 409 CATEGORY_EXISTS
// PATCH  /api/admin/categories/{id}  UpdateCategoryGroupRequest -> CategoryWithCount [EMPLOYEE, MANAGER]
//        Doi/go nhom cua 1 danh muc da co (VD gan "Ao" cho danh muc "Hoodie").
// DELETE /api/admin/categories/{id}             -> 204                  [EMPLOYEE, MANAGER]
//        Loi: 409 CATEGORY_NOT_EMPTY (con san pham thi khong cho xoa)
//
// POST   /api/admin/products  CreateProductRequest -> ProductDetail (201) [EMPLOYEE, MANAGER]
//        BE phai sinh embedding/chi muc tim kiem cho san pham moi NGAY trong luong nay,
//        neu khong san pham se khong bao gio xuat hien trong tim kiem.
// PATCH  /api/admin/products/{id}  CreateProductRequest -> ProductDetail  [EMPLOYEE, MANAGER]
//        Gui lai TOAN BO thong tin (nhu tao moi) — anh bi thay het, bien the doi chieu
//        theo cap (size, color): trung thi cap nhat gia/ton kho, khong trung thi tao/xoa.
//        Bien the da tung ban/dang trong gio khach khac se khong bi xoa, chi tat ton kho ve 0.
// DELETE /api/admin/products/{id}                 -> 204                  [EMPLOYEE, MANAGER]
//        Loi: 409 PRODUCT_HAS_ORDERS (san pham da nam trong don hang, khong xoa duoc)
//
// GET    /api/admin/reviews?page=&size=&replied= -> Page<ReviewForAdmin>  [EMPLOYEE, MANAGER]
// POST   /api/admin/reviews/{id}/reply  ReplyReviewRequest -> ReviewForAdmin (201) [EMPLOYEE, MANAGER]
//        Loi: 409 ALREADY_REPLIED
//
// GET    /api/admin/stats/monthly?month=2026-09 -> MonthlyStats          [MANAGER]
// GET    /api/admin/transactions?page=&size=&status= -> Page<Transaction> [MANAGER]
//
// POST   /api/manager/employees  CreateEmployeeRequest -> CreateEmployeeResponse (201) [MANAGER]
//        Loi: 409 EMAIL_EXISTS
// GET    /api/manager/employees                         -> Employee[]    [MANAGER]
// PATCH  /api/manager/employees/{id}  {active: boolean} -> Employee      [MANAGER]
// =====================================================================

export type { ProductCard };
