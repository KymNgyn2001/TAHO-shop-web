// =====================================================================
// HOP DONG API  —  FE <-> BE
// Gui file nay cho ban lam backend. Moi thay doi phai sua o day truoc.
// Quy uoc chung:
//   - Tien: number, don vi VND, khong co dau cham phan cach.
//   - Thoi gian: chuoi ISO 8601 (2026-09-15T10:30:00+07:00).
//   - Id: number.
//   - Loi: HTTP status + body ApiError.
// =====================================================================

// ---------------------------------------------------------------------
// Kieu chung
// ---------------------------------------------------------------------

export interface Page<T> {
  items: T[];
  page: number;        // bat dau tu 0
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface ApiError {
  code: string;        // OUT_OF_STOCK, ORDER_NOT_CANCELLABLE, VALIDATION_FAILED...
  message: string;     // tieng Viet, hien thang cho user duoc
  field?: string;
}

// ---------------------------------------------------------------------
// San pham
// ---------------------------------------------------------------------

export interface ProductImage {
  url: string;
  altText: string | null;
  isPrimary: boolean;
  /** Null = anh chung. Co gia tri = chi hien khi khach chon dung mau nay. */
  color: string | null;
}

export interface Variant {
  id: number;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  price: number;       // BE da tinh price_override ?? base_price
  stockQty: number;
  inStock: boolean;
}

export type Audience = 'MEN' | 'WOMEN' | 'KIDS' | 'UNISEX';

/** Dung cho luoi san pham — KHONG kem variants cho nhe payload. */
export interface ProductCard {
  id: number;
  name: string;
  slug: string;
  basePrice: number;
  primaryImageUrl: string | null;
  categoryName: string | null;
  audience: Audience;
  /** false = nhan vien da an, khong hien cong khai nua. */
  active: boolean;
  /** Chi co khi tra ve tu /search/semantic hoac /recommend. 0..1 */
  score?: number;
}

/** Dung cho trang chi tiet. */
export interface ProductDetail extends ProductCard {
  description: string | null;
  brand: string | null;
  material: string | null;
  /** Anh bang size, null neu san pham chua co. */
  sizeChartUrl: string | null;
  images: ProductImage[];
  variants: Variant[];
}

// ---------------------------------------------------------------------
// Gio hang
// ---------------------------------------------------------------------

export interface CartItem {
  id: number;
  variantId: number;
  productId: number;
  productName: string;
  primaryImageUrl: string | null;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stockQty: number;    // de FE chan khi tang qua ton kho
}

export interface Cart {
  id: number;
  items: CartItem[];
  subtotal: number;
}

// ---------------------------------------------------------------------
// Don hang
// ---------------------------------------------------------------------

export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';

export interface OrderItem {
  productName: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  code: string;                 // ORD-20260915-0001
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  shippingMethodName: string | null;
  discountCode: string | null;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: 'COD' | 'BANK_TRANSFER' | 'MOMO';
  receiverName: string;
  receiverPhone: string;
  /** Email nhan thong bao don hang — null cho don dat truoc khi co tinh nang nay. */
  email: string | null;
  shippingAddress: string;
  note: string | null;
  createdBy: 'WEB' | 'CHATBOT';
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** BE tinh san, FE khong tu suy luan tu status. */
  cancellable: boolean;
  /** Link thanh toan MoMo/PayOS — con dung lai duoc ke ca khi quay lai xem don sau. */
  payUrl?: string | null;
  /** Chuoi QR VietQR goc tu PayOS — FE tu ve anh QR tu day (xem payosQrImageUrl). */
  payQrData?: string | null;
  /** Chi co ngay sau khi tao don MOMO/PayOS neu bi tu choi tao thanh toan. */
  payError?: string | null;
}

export interface CreateOrderRequest {
  items: { variantId: number; quantity: number }[];
  shippingMethodId: number;
  discountCode?: string;
  receiverName: string;
  receiverPhone: string;
  /** Dung de gui email xac nhan don hang. Bat buoc, ke ca khach vang lai. */
  email: string;
  shippingAddress: string;
  note?: string;
  paymentMethod: 'COD' | 'BANK_TRANSFER' | 'MOMO';
}

// ---------------------------------------------------------------------
// Chatbot
// ---------------------------------------------------------------------

export interface ChatContext {
  /** San pham dang duoc nhac den trong doan chat (tu ket qua goi y gan nhat). */
  productId?: number;
  /** Muc gio hang bot vua them — de xu ly "huỷ"/"khỏi lấy" ngay sau do. */
  lastCartItemId?: number;
  /** Size bot vua tu van (tu chieu cao/can nang) — dung lai neu khach "lấy" ma khong lap lai size. */
  recommendedSize?: string;
  /** Hanh dong dang cho khach xac nhan dong y/tu choi (them gio hang, xoa san pham...). */
  pendingConfirm?:
    | { kind: 'ADD_TO_CART'; variantId: number; quantity: number; productName: string; size: string; color: string }
    | { kind: 'DELETE_PRODUCT'; productId: number; productName: string };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** San pham bot dinh kem -> FE render thanh the, khong in link tho. */
  products?: ProductCard[];
  /** Don bot vua tao hoac huy. */
  order?: Order;
  /** true neu bot vua them/xoa gio hang -> FE nen goi lai GET /cart de cap nhat badge. */
  cartUpdated?: boolean;
  /** true -> FE hien 2 nut "Đồng ý"/"Không" thay vi o nhap thuong. */
  confirm?: boolean;
  /** FE luu lai va gui kem o luot chat tiep theo, khong tu suy doan. */
  context?: ChatContext;
}

export interface ChatRequest {
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  context?: ChatContext;
}

// =====================================================================
// DANH SACH ENDPOINT  —  phan ban BE phai hien thuc
// =====================================================================
//
// GET  /api/categories                       -> Category[]
// GET  /api/products?page=&size=&categoryId=&audience= -> Page<ProductCard>
//      audience: MEN | WOMEN | KIDS | UNISEX
// GET  /api/products/{slug}                  -> ProductDetail | 404
//
// POST /api/search/semantic  {query, limit}   -> ProductCard[]  (co score)
// POST /api/search/image     multipart: file  -> ProductCard[]  (co score)
// GET  /api/products/{id}/similar?limit=8     -> ProductCard[]
// GET  /api/recommend?limit=8                 -> ProductCard[]
//
// GET    /api/cart                            -> Cart
// POST   /api/cart/items   {variantId, quantity}   -> Cart
// PATCH  /api/cart/items/{itemId} {quantity}       -> Cart
// DELETE /api/cart/items/{itemId}                  -> Cart
//
// POST /api/orders            CreateOrderRequest -> Order (201)  [khach vang lai duoc]
//                             409 OUT_OF_STOCK
// GET  /api/orders                               -> Page<Order>  [BAT BUOC dang nhap] — don cua chinh tai khoan
// GET  /api/orders/{code}                        -> Order | 404  [BAT BUOC dang nhap]
//      Chu don hang HOAC EMPLOYEE/MANAGER moi xem duoc; nguoi khac -> 404 (khong lo thong tin).
// POST /api/orders/{code}/cancel  {reason}       -> Order        [BAT BUOC dang nhap]
//      Chi chu don hang hoac MANAGER moi huy duoc.
//                             409 ORDER_NOT_CANCELLABLE
//
// PATCH /api/admin/orders/{code}/status  {status}  -> Order      [EMPLOYEE/MANAGER]
//      status: CONFIRMED | SHIPPING | COMPLETED — chi tien toi, khong lui lai duoc.
//      Dung sau khi nhan vien tu kiem tra da nhan duoc tien chuyen khoan (QR chi la
//      goi y chuyen khoan, khong phai cong thanh toan nen he thong khong tu biet).
//                             409 ORDER_CANCELLED
//
// POST /api/chat              ChatRequest -> ChatMessage
//      FE luu `context` tu response gan nhat va gui lai o request tiep theo —
//      nho vay bot moi hieu duoc "lay mau den size L 2 cai" sau khi vua goi y san pham,
//      va "khoi lay"/"huy" ngay sau khi bot vua them gio hang.
//
// Xac thuc: header  Authorization: Bearer <jwt>
// Khach vang lai:   header  X-Session-Id: <uuid luu o localStorage>
// =====================================================================

/** Nhom co dinh de menu danh muc on dinh khi hien thi phan cap. */
export type CategoryGroup = 'Áo' | 'Quần' | 'Váy & Đầm' | 'Phụ kiện';

export interface Category {
  id: number;
  name: string;
  slug: string;
  /** null = chua xep nhom, se hien o muc "Khac" trong menu. */
  group: CategoryGroup | null;
}

// ---------------------------------------------------------------------
// Xac thuc (auth) — 3 role: MANAGER, EMPLOYEE, CUSTOMER
// ---------------------------------------------------------------------

export type Role = 'MANAGER' | 'EMPLOYEE' | 'CUSTOMER';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

// ---------------------------------------------------------------------
// Danh gia san pham (review) + tra loi cua nhan vien
// ---------------------------------------------------------------------

export interface ReviewReply {
  id: number;
  employeeName: string;
  content: string;
  createdAt: string;
}

export interface Review {
  id: number;
  productId: number;
  customerName: string;
  rating: number;              // 1..5
  content: string;
  createdAt: string;
  reply: ReviewReply | null;
}

export interface CreateReviewRequest {
  rating: number;
  content: string;
}

// ---------------------------------------------------------------------
// Van chuyen & ma giam gia
// ---------------------------------------------------------------------

export interface ShippingMethod {
  id: number;
  name: string;        // Giao hang tieu chuan, Giao hang nhanh...
  fee: number;
  etaDays: string;      // "2-4 ngay"
}

export interface DiscountPreview {
  code: string;
  valid: boolean;
  discountAmount: number;
  message: string;
}

// =====================================================================
// ENDPOINT BO SUNG — auth, review, van chuyen, ma giam gia
// =====================================================================
//
// POST /api/auth/register  RegisterRequest -> AuthResponse (201)
//                          409 EMAIL_EXISTS
// POST /api/auth/login     LoginRequest -> AuthResponse
//                          401 INVALID_CREDENTIALS
// POST /api/auth/logout                     -> 204
// GET  /api/auth/me                         -> AuthUser
//
// GET  /api/shipping-methods                -> ShippingMethod[]
// POST /api/discounts/validate {code, subtotal} -> DiscountPreview
//
// GET  /api/products/{id}/reviews           -> Review[]
// POST /api/products/{id}/reviews  CreateReviewRequest -> Review (201) [CUSTOMER]
//                          409 ALREADY_REVIEWED (moi khach 1 review / san pham)
// =====================================================================
