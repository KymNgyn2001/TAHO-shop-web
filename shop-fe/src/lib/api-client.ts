// =====================================================================
// LOP GOI API
// Ngay hom nay: NEXT_PUBLIC_USE_MOCK=true  -> chay bang du lieu gia.
// Khi BE xong:  NEXT_PUBLIC_USE_MOCK=false -> KHONG sua mot dong UI nao.
// Moi component chi duoc import tu file nay, tuyet doi khong fetch() truc tiep.
// =====================================================================

type ProductImage = {
  url: string;
  altText: string | null;
  isPrimary: boolean;
  color: string | null;
};

type ProductVariant = {
  id: number;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  price: number;
  stockQty: number;
  inStock: boolean;
};

export type Audience = 'MEN' | 'WOMEN' | 'KIDS' | 'UNISEX';

type ProductDetail = {
  id: number;
  name: string;
  slug: string;
  basePrice: number;
  primaryImageUrl: string;
  categoryName: string;
  audience: Audience;
  description: string;
  brand: string;
  material: string;
  sizeChartUrl: string | null;
  images: ProductImage[];
  variants: ProductVariant[];
};

type ProductCard = Pick<
  ProductDetail,
  'id' | 'name' | 'slug' | 'basePrice' | 'primaryImageUrl' | 'categoryName' | 'audience'
> & {
  score?: number;
};

export type CategoryGroup = 'Áo' | 'Quần' | 'Váy & Đầm' | 'Phụ kiện';
export type Category = { id: number; name: string; slug: string; group: CategoryGroup | null; productCount: number };

type CartItem = {
  id: number;
  variantId: number;
  productId: number;
  productName: string;
  primaryImageUrl: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stockQty: number;
};

type Cart = {
  id: number;
  items: CartItem[];
  subtotal: number;
};

type CreateOrderItemRequest = {
  variantId: number;
  quantity: number;
};

type CreateOrderRequest = {
  items: CreateOrderItemRequest[];
  shippingMethodId: number;
  discountCode?: string;
  paymentMethod: 'COD' | 'BANK_TRANSFER';
  receiverName: string;
  receiverPhone: string;
  email: string;
  shippingAddress: string;
  note?: string | null;
};

type OrderItem = {
  productName: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'COMPLETED' | 'CANCELLED';

type Order = {
  id: number;
  code: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  shippingMethodName: string | null;
  discountCode: string | null;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: 'COD' | 'BANK_TRANSFER';
  receiverName: string;
  receiverPhone: string;
  email: string | null;
  shippingAddress: string;
  note: string | null;
  createdBy: 'WEB' | 'CHATBOT';
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  cancellable: boolean;
};

type Page<T> = {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

export type ChatContext = {
  productId?: number;
  lastCartItemId?: number;
  recommendedSize?: string;
  pendingConfirm?:
    | { kind: 'ADD_TO_CART'; variantId: number; quantity: number; productName: string; size: string; color: string }
    | { kind: 'DELETE_PRODUCT'; productId: number; productName: string };
};

type ChatRequest = {
  message: string;
};

type ChatMessage = {
  role: 'assistant' | 'user';
  content: string;
  products?: ProductCard[];
  order?: Order;
  cartUpdated?: boolean;
  confirm?: boolean;
  context?: ChatContext;
};

export type Role = 'MANAGER' | 'EMPLOYEE' | 'CUSTOMER';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
};

type AuthResponse = { token: string; user: AuthUser };

export type ReviewReply = {
  id: number;
  employeeName: string;
  content: string;
  createdAt: string;
};

export type Review = {
  id: number;
  productId: number;
  customerName: string;
  rating: number;
  content: string;
  createdAt: string;
  reply: ReviewReply | null;
};

export type ShippingMethod = {
  id: number;
  name: string;
  fee: number;
  etaDays: string;
};

export type DiscountPreview = {
  code: string;
  valid: boolean;
  discountAmount: number;
  message: string;
};

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

/**
 * Neu khong khai bao NEXT_PUBLIC_API_URL, tu suy ra dia chi BE tu chinh dia chi
 * dang mo trang (cung host, port 8080) — nho vay doi wifi (nha/truong) khong can
 * sua .env, vi trinh duyet luon biet dang truy cap qua IP/host nao.
 */
function resolveBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  return 'http://localhost:8080';
}

export const BASE_URL = resolveBaseUrl();

// ---------------------------------------------------------------------
// Ha tang
// ---------------------------------------------------------------------

export class ApiException extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

/**
 * crypto.randomUUID() chi chay duoc trong "secure context" (HTTPS hoac localhost) —
 * mo bang IP LAN thuong (http://192.168.x.x) se bi undefined va nem loi ngay, khien
 * moi request (ke ca dang nhap) chet truoc khi kip goi fetch. Dung getRandomValues
 * (khong bi han che nay) de tu ghep UUID khi randomUUID khong co san.
 */
export function genUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function sessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('sid');
  if (!id) {
    id = genUuid();
    localStorage.setItem('sid', id);
  }
  return id;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function storeSession(auth: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

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

const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/800`;

export const MOCK_PRODUCTS: ProductDetail[] = [
  {
    id: 1, name: 'Áo sơ mi linen tay dài', slug: 'ao-so-mi-linen-tay-dai',
    basePrice: 459000, primaryImageUrl: img('linen1'), categoryName: 'Áo sơ mi', audience: 'UNISEX',
    description: 'Linen pha cotton, form suông, ít nhăn hơn linen nguyên chất.',
    brand: 'Local Studio', material: 'Linen 70% / Cotton 30%', sizeChartUrl: null,
    images: [
      { url: img('linen1'), altText: 'Mặt trước', isPrimary: true, color: null },
      { url: img('linen2'), altText: 'Mặt sau', isPrimary: false, color: null },
    ],
    variants: [
      { id: 101, sku: 'SM-LIN-S-WHT', size: 'S', color: 'Trắng', colorHex: '#FFFFFF', price: 459000, stockQty: 8, inStock: true },
      { id: 102, sku: 'SM-LIN-M-WHT', size: 'M', color: 'Trắng', colorHex: '#FFFFFF', price: 459000, stockQty: 0, inStock: false },
      { id: 103, sku: 'SM-LIN-M-BEI', size: 'M', color: 'Be', colorHex: '#D9CBB3', price: 479000, stockQty: 5, inStock: true },
    ],
  },
  {
    id: 2, name: 'Quần âu ống suông', slug: 'quan-au-ong-suong',
    basePrice: 620000, primaryImageUrl: img('trouser1'), categoryName: 'Quần', audience: 'MEN',
    description: 'Ống suông, cạp cao, có ly. Vải tuyết mưa ít nhăn.',
    brand: 'Local Studio', material: 'Polyester 65% / Viscose 35%', sizeChartUrl: null,
    images: [{ url: img('trouser1'), altText: null, isPrimary: true, color: null }],
    variants: [
      { id: 201, sku: 'QA-SUO-29-BLK', size: '29', color: 'Đen', colorHex: '#1A1A1A', price: 620000, stockQty: 12, inStock: true },
      { id: 202, sku: 'QA-SUO-30-BLK', size: '30', color: 'Đen', colorHex: '#1A1A1A', price: 620000, stockQty: 3, inStock: true },
    ],
  },
  {
    id: 3, name: 'Áo thun cotton bo gân', slug: 'ao-thun-cotton-bo-gan',
    basePrice: 249000, primaryImageUrl: img('tee1'), categoryName: 'Áo thun', audience: 'UNISEX',
    description: 'Cotton 100% dệt bo gân, dày dặn, không xuyên thấu.',
    brand: 'Basics', material: 'Cotton 100%', sizeChartUrl: null,
    images: [{ url: img('tee1'), altText: null, isPrimary: true, color: null }],
    variants: [
      { id: 301, sku: 'AT-GAN-M-NAV', size: 'M', color: 'Xanh navy', colorHex: '#26344D', price: 249000, stockQty: 20, inStock: true },
      { id: 302, sku: 'AT-GAN-L-NAV', size: 'L', color: 'Xanh navy', colorHex: '#26344D', price: 249000, stockQty: 15, inStock: true },
    ],
  },
  {
    id: 4, name: 'Chân váy xếp ly midi', slug: 'chan-vay-xep-ly-midi',
    basePrice: 535000, primaryImageUrl: img('skirt1'), categoryName: 'Chân váy', audience: 'WOMEN',
    description: 'Dài qua gối, ly giữ nếp sau nhiều lần giặt.',
    brand: 'Local Studio', material: 'Polyester 100%', sizeChartUrl: null,
    images: [{ url: img('skirt1'), altText: null, isPrimary: true, color: null }],
    variants: [
      { id: 401, sku: 'CV-LY-S-CRM', size: 'S', color: 'Kem', colorHex: '#EDE3D2', price: 535000, stockQty: 6, inStock: true },
    ],
  },
  {
    id: 5, name: 'Áo khoác blazer một lớp', slug: 'ao-khoac-blazer-mot-lop',
    basePrice: 890000, primaryImageUrl: img('blazer1'), categoryName: 'Áo khoác', audience: 'WOMEN',
    description: 'Không lót, mặc được mùa nóng. Vai nhẹ, không độn dày.',
    brand: 'Local Studio', material: 'Linen 55% / Viscose 45%', sizeChartUrl: null,
    images: [{ url: img('blazer1'), altText: null, isPrimary: true, color: null }],
    variants: [
      { id: 501, sku: 'BL-1L-M-GRY', size: 'M', color: 'Xám', colorHex: '#8A8A85', price: 890000, stockQty: 4, inStock: true },
    ],
  },
  {
    id: 6, name: 'Đầm lụa cổ vuông', slug: 'dam-lua-co-vuong',
    basePrice: 720000, primaryImageUrl: img('dress1'), categoryName: 'Đầm', audience: 'WOMEN',
    description: 'Lụa nhân tạo mềm rủ, cổ vuông, tay ngắn.',
    brand: 'Local Studio', material: 'Viscose 100%', sizeChartUrl: null,
    images: [{ url: img('dress1'), altText: null, isPrimary: true, color: null }],
    variants: [
      { id: 601, sku: 'DM-LUA-S-RED', size: 'S', color: 'Đỏ đô', colorHex: '#6E2B2B', price: 720000, stockQty: 7, inStock: true },
    ],
  },
];

const MOCK_SHIPPING: ShippingMethod[] = [
  { id: 1, name: 'Giao hàng tiêu chuẩn', fee: 30000, etaDays: '3-5 ngày' },
  { id: 2, name: 'Giao hàng nhanh', fee: 50000, etaDays: '1-2 ngày' },
  { id: 3, name: 'Nhận tại cửa hàng', fee: 0, etaDays: 'Trong ngày' },
];

const mockReviews = new Map<number, Review[]>();
let mockReviewSeq = 1;

const toCard = (p: ProductDetail): ProductCard => ({
  id: p.id, name: p.name, slug: p.slug, basePrice: p.basePrice,
  primaryImageUrl: p.primaryImageUrl, categoryName: p.categoryName, audience: p.audience,
});

const MOCK_CATEGORIES: Category[] = [
  { id: 1, name: 'Áo sơ mi', slug: 'ao-so-mi', group: 'Áo', productCount: 1 },
  { id: 2, name: 'Quần', slug: 'quan', group: 'Quần', productCount: 1 },
  { id: 3, name: 'Áo thun', slug: 'ao-thun', group: 'Áo', productCount: 1 },
  { id: 4, name: 'Chân váy', slug: 'chan-vay', group: 'Váy & Đầm', productCount: 1 },
  { id: 5, name: 'Áo khoác', slug: 'ao-khoac', group: 'Áo', productCount: 1 },
  { id: 6, name: 'Đầm', slug: 'dam', group: 'Váy & Đầm', productCount: 1 },
  { id: 7, name: 'Phụ kiện', slug: 'phu-kien', group: 'Phụ kiện', productCount: 0 },
];

let mockCart: Cart = { id: 1, items: [], subtotal: 0 };
const mockOrders: Order[] = [];
let mockUser: AuthUser | null = null;

function recalc() {
  mockCart.subtotal = mockCart.items.reduce((s, i) => s + i.lineTotal, 0);
}

function findVariant(variantId: number) {
  for (const p of MOCK_PRODUCTS) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return { product: p, variant: v };
  }
  throw new ApiException('NOT_FOUND', 'Không tìm thấy sản phẩm.', 404);
}

// ---------------------------------------------------------------------
// API cong khai — UI chi goi nhung ham nay
// ---------------------------------------------------------------------

export const api = {

  // ---------- Auth ----------

  async register(body: { name: string; email: string; password: string; phone?: string }): Promise<AuthResponse> {
    if (!USE_MOCK) {
      const auth = await request<AuthResponse>('/api/auth/register', {
        method: 'POST', body: JSON.stringify(body),
      });
      storeSession(auth);
      return auth;
    }
    await delay(400);
    mockUser = { id: 1, name: body.name, email: body.email, phone: body.phone ?? null, role: 'CUSTOMER' };
    const auth = { token: 'mock-token', user: mockUser };
    storeSession(auth);
    return auth;
  },

  async login(body: { email: string; password: string }): Promise<AuthResponse> {
    if (!USE_MOCK) {
      const auth = await request<AuthResponse>('/api/auth/login', {
        method: 'POST', body: JSON.stringify(body),
      });
      storeSession(auth);
      return auth;
    }
    await delay(400);
    mockUser = { id: 1, name: body.email.split('@')[0], email: body.email, phone: null, role: 'CUSTOMER' };
    const auth = { token: 'mock-token', user: mockUser };
    storeSession(auth);
    return auth;
  },

  async logout(): Promise<void> {
    if (!USE_MOCK) {
      try { await request('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    }
    mockUser = null;
    clearSession();
  },

  async me(): Promise<AuthUser> {
    if (!USE_MOCK) return request('/api/auth/me');
    await delay(150);
    if (!mockUser) throw new ApiException('UNAUTHORIZED', 'Vui lòng đăng nhập.', 401);
    return mockUser;
  },

  // ---------- San pham ----------

  async listProducts(
    page = 0,
    size = 12,
    filters?: { categoryId?: number; audience?: Audience },
  ): Promise<Page<ProductCard>> {
    if (!USE_MOCK) {
      const q = new URLSearchParams({ page: String(page), size: String(size) });
      if (filters?.categoryId) q.set('categoryId', String(filters.categoryId));
      if (filters?.audience) q.set('audience', filters.audience);
      return request(`/api/products?${q}`);
    }
    await delay();
    let pool = MOCK_PRODUCTS;
    if (filters?.categoryId) {
      const cat = MOCK_CATEGORIES.find((c) => c.id === filters.categoryId);
      pool = pool.filter((p) => p.categoryName === cat?.name);
    }
    if (filters?.audience) pool = pool.filter((p) => p.audience === filters.audience);
    const items = pool.slice(page * size, page * size + size).map(toCard);
    return { items, page, size, totalItems: pool.length, totalPages: Math.max(1, Math.ceil(pool.length / size)) };
  },

  async categories(): Promise<Category[]> {
    if (!USE_MOCK) return request('/api/categories');
    await delay(150);
    return structuredClone(MOCK_CATEGORIES);
  },

  async getProduct(slug: string): Promise<ProductDetail> {
    if (!USE_MOCK) return request(`/api/products/${slug}`);
    await delay();
    const p = MOCK_PRODUCTS.find((x) => x.slug === slug);
    if (!p) throw new ApiException('NOT_FOUND', 'Sản phẩm không còn nữa.', 404);
    return p;
  },

  async semanticSearch(query: string, limit = 12): Promise<ProductCard[]> {
    if (!USE_MOCK) {
      return request('/api/search/semantic', {
        method: 'POST', body: JSON.stringify({ query, limit }),
      });
    }
    await delay(700);
    const q = query.toLowerCase();
    return MOCK_PRODUCTS
      .map((p) => ({
        ...toCard(p),
        score: [p.name, p.description, p.material, p.categoryName]
          .join(' ').toLowerCase().includes(q) ? 0.82 : 0.31,
      }))
      .sort((a, b) => b.score! - a.score!)
      .slice(0, limit);
  },

  async imageSearch(file: File, limit = 12): Promise<ProductCard[]> {
    if (!USE_MOCK) {
      const fd = new FormData();
      fd.append('file', file);
      const token = getToken();
      const res = await fetch(`${BASE_URL}/api/search/image?limit=${limit}`, {
        method: 'POST', body: fd,
        headers: { 'X-Session-Id': sessionId(), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new ApiException('UPLOAD_FAILED', 'Không đọc được ảnh.', res.status);
      return res.json();
    }
    await delay(1200);
    return MOCK_PRODUCTS.slice(0, limit).map((p, i) => ({
      ...toCard(p), score: 0.9 - i * 0.07,
    }));
  },

  async similar(productId: number, limit = 8): Promise<ProductCard[]> {
    if (!USE_MOCK) return request(`/api/products/${productId}/similar?limit=${limit}`);
    await delay();
    return MOCK_PRODUCTS.filter((p) => p.id !== productId).slice(0, limit).map(toCard);
  },

  // ---------- Danh gia ----------

  async listReviews(productId: number): Promise<Review[]> {
    if (!USE_MOCK) return request(`/api/products/${productId}/reviews`);
    await delay();
    return structuredClone(mockReviews.get(productId) ?? []);
  },

  async createReview(productId: number, body: { rating: number; content: string }): Promise<Review> {
    if (!USE_MOCK) {
      return request(`/api/products/${productId}/reviews`, {
        method: 'POST', body: JSON.stringify(body),
      });
    }
    await delay(400);
    const list = mockReviews.get(productId) ?? [];
    if (list.some((r) => r.customerName === (mockUser?.name ?? 'Bạn'))) {
      throw new ApiException('ALREADY_REVIEWED', 'Bạn đã đánh giá sản phẩm này rồi.', 409);
    }
    const review: Review = {
      id: mockReviewSeq++, productId, customerName: mockUser?.name ?? 'Bạn',
      rating: body.rating, content: body.content, createdAt: new Date().toISOString(), reply: null,
    };
    mockReviews.set(productId, [review, ...list]);
    return review;
  },

  // ---------- Van chuyen & giam gia ----------

  async shippingMethods(): Promise<ShippingMethod[]> {
    if (!USE_MOCK) return request('/api/shipping-methods');
    await delay(150);
    return structuredClone(MOCK_SHIPPING);
  },

  async validateDiscount(code: string, subtotal: number): Promise<DiscountPreview> {
    if (!USE_MOCK) {
      return request('/api/discounts/validate', {
        method: 'POST', body: JSON.stringify({ code, subtotal }),
      });
    }
    await delay(300);
    if (code.trim().toUpperCase() === 'WELCOME10' && subtotal >= 300000) {
      return { code, valid: true, discountAmount: Math.round(subtotal * 0.1), message: 'Áp dụng mã giảm giá thành công.' };
    }
    return { code, valid: false, discountAmount: 0, message: 'Mã giảm giá không hợp lệ hoặc chưa đủ điều kiện.' };
  },

  // ---------- Gio hang ----------

  async getCart(): Promise<Cart> {
    if (!USE_MOCK) return request('/api/cart');
    await delay(150);
    return structuredClone(mockCart);
  },

  async addToCart(variantId: number, quantity: number): Promise<Cart> {
    if (!USE_MOCK) {
      return request('/api/cart/items', {
        method: 'POST', body: JSON.stringify({ variantId, quantity }),
      });
    }
    await delay();
    const { product, variant } = findVariant(variantId);
    if (variant.stockQty < quantity) {
      throw new ApiException('OUT_OF_STOCK',
        `Size ${variant.size} chỉ còn ${variant.stockQty} sản phẩm.`, 409);
    }
    const existing = mockCart.items.find((i) => i.variantId === variantId);
    if (existing) {
      existing.quantity += quantity;
      existing.lineTotal = existing.quantity * existing.unitPrice;
    } else {
      mockCart.items.push({
        id: Date.now(), variantId, productId: product.id,
        productName: product.name, primaryImageUrl: product.primaryImageUrl,
        size: variant.size, color: variant.color, unitPrice: variant.price,
        quantity, lineTotal: variant.price * quantity, stockQty: variant.stockQty,
      });
    }
    recalc();
    return structuredClone(mockCart);
  },

  async updateCartItem(itemId: number, quantity: number): Promise<Cart> {
    if (!USE_MOCK) {
      return request(`/api/cart/items/${itemId}`, {
        method: 'PATCH', body: JSON.stringify({ quantity }),
      });
    }
    await delay(150);
    const it = mockCart.items.find((i) => i.id === itemId);
    if (it) { it.quantity = quantity; it.lineTotal = quantity * it.unitPrice; }
    recalc();
    return structuredClone(mockCart);
  },

  async removeCartItem(itemId: number): Promise<Cart> {
    if (!USE_MOCK) return request(`/api/cart/items/${itemId}`, { method: 'DELETE' });
    await delay(150);
    mockCart.items = mockCart.items.filter((i) => i.id !== itemId);
    recalc();
    return structuredClone(mockCart);
  },

  // ---------- Don hang ----------

  async createOrder(body: CreateOrderRequest): Promise<Order> {
    if (!USE_MOCK) {
      return request('/api/orders', { method: 'POST', body: JSON.stringify(body) });
    }
    await delay(600);
    const items = body.items.map(({ variantId, quantity }) => {
      const { product, variant } = findVariant(variantId);
      if (variant.stockQty < quantity) {
        throw new ApiException('OUT_OF_STOCK',
          `${product.name} size ${variant.size} vừa hết hàng.`, 409);
      }
      return {
        productName: product.name, size: variant.size, color: variant.color,
        unitPrice: variant.price, quantity, lineTotal: variant.price * quantity,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const shipping = MOCK_SHIPPING.find((s) => s.id === body.shippingMethodId) ?? MOCK_SHIPPING[0];
    let discountAmount = 0;
    if (body.discountCode) {
      const preview = await api.validateDiscount(body.discountCode, subtotal);
      if (preview.valid) discountAmount = preview.discountAmount;
    }
    const order: Order = {
      id: mockOrders.length + 1,
      code: `ORD-20260915-${String(mockOrders.length + 1).padStart(4, '0')}`,
      status: 'PENDING', items, subtotal, shippingFee: shipping.fee,
      shippingMethodName: shipping.name, discountCode: body.discountCode ?? null, discountAmount,
      totalAmount: subtotal + shipping.fee - discountAmount, paymentMethod: body.paymentMethod,
      receiverName: body.receiverName, receiverPhone: body.receiverPhone, email: body.email,
      shippingAddress: body.shippingAddress, note: body.note ?? null,
      createdBy: 'WEB', createdAt: new Date().toISOString(),
      cancelledAt: null, cancelReason: null, cancellable: true,
    };
    mockOrders.unshift(order);
    mockCart = { id: 1, items: [], subtotal: 0 };
    return structuredClone(order);
  },

  async listOrders(): Promise<Page<Order>> {
    if (!USE_MOCK) return request('/api/orders');
    await delay();
    return {
      items: structuredClone(mockOrders), page: 0, size: 20,
      totalItems: mockOrders.length, totalPages: 1,
    };
  },

  async getOrder(code: string): Promise<Order> {
    if (!USE_MOCK) return request(`/api/orders/${code}`);
    await delay();
    const o = mockOrders.find((x) => x.code === code);
    if (!o) throw new ApiException('NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
    return structuredClone(o);
  },

  async cancelOrder(code: string, reason: string): Promise<Order> {
    if (!USE_MOCK) {
      return request(`/api/orders/${code}/cancel`, {
        method: 'POST', body: JSON.stringify({ reason }),
      });
    }
    await delay(400);
    const o = mockOrders.find((x) => x.code === code);
    if (!o) throw new ApiException('NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
    if (!o.cancellable) {
      throw new ApiException('ORDER_NOT_CANCELLABLE',
        'Đơn đã giao cho vận chuyển, không huỷ được nữa.', 409);
    }
    o.status = 'CANCELLED';
    o.cancelledAt = new Date().toISOString();
    o.cancelReason = reason;
    o.cancellable = false;
    return structuredClone(o);
  },

  async updateOrderStatus(code: string, status: 'CONFIRMED' | 'SHIPPING' | 'COMPLETED'): Promise<Order> {
    if (!USE_MOCK) {
      return request(`/api/admin/orders/${code}/status`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
    }
    await delay(400);
    const o = mockOrders.find((x) => x.code === code);
    if (!o) throw new ApiException('NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
    o.status = status;
    return structuredClone(o);
  },

  async chat(
    body: ChatRequest & { history?: { role: 'user' | 'assistant'; content: string }[]; context?: ChatContext },
  ): Promise<ChatMessage> {
    if (!USE_MOCK) {
      return request('/api/chat', { method: 'POST', body: JSON.stringify({ history: [], ...body }) });
    }
    await delay(900);
    const m = body.message.toLowerCase();
    if (m.includes('huỷ') || m.includes('hủy')) {
      return { role: 'assistant', content: 'Bạn cho mình mã đơn cần huỷ nhé, dạng ORD-20260915-0001.', context: body.context };
    }
    if (m.includes('size')) {
      return { role: 'assistant', content: 'Cao 1m65 nặng 55kg thì size M vừa. Nếu thích rộng thì lấy L.', context: body.context };
    }
    return {
      role: 'assistant',
      content: 'Mình tìm được vài mẫu hợp ý bạn:',
      products: MOCK_PRODUCTS.slice(0, 3).map(toCard),
      context: { productId: MOCK_PRODUCTS[0]?.id },
    };
  },
};
