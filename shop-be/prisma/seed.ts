import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/800`;

async function main() {
  console.log('Seeding...');

  // --- Tai khoan demo (doi mat khau ngay sau lan dang nhap dau tien) ---
  const accounts = [
    { name: 'Quan Ly Cua Hang', email: 'manager@shop.test', password: 'Manager123!', role: 'MANAGER' as const },
    { name: 'Nhan Vien Ban Hang', email: 'employee@shop.test', password: 'Employee123!', role: 'EMPLOYEE' as const },
    { name: 'Khach Hang Demo', email: 'customer@shop.test', password: 'Customer123!', role: 'CUSTOMER' as const },
  ];
  for (const acc of accounts) {
    await prisma.user.upsert({
      where: { email: acc.email },
      update: {},
      create: {
        name: acc.name,
        email: acc.email,
        passwordHash: await bcrypt.hash(acc.password, 10),
        role: acc.role,
      },
    });
  }

  // --- Danh muc + san pham (dua tren du lieu mock cua FE) ---
  const catalog = [
    {
      category: 'Áo sơ mi',
      name: 'Áo sơ mi linen tay dài',
      basePrice: 459000,
      description: 'Linen pha cotton, form suông, ít nhăn hơn linen nguyên chất.',
      brand: 'Local Studio',
      material: 'Linen 70% / Cotton 30%',
      imageSeeds: ['linen1', 'linen2'],
      variants: [
        { size: 'S', color: 'Trắng', colorHex: '#FFFFFF', stockQty: 8 },
        { size: 'M', color: 'Trắng', colorHex: '#FFFFFF', stockQty: 0 },
        { size: 'M', color: 'Be', colorHex: '#D9CBB3', priceOverride: 479000, stockQty: 5 },
      ],
    },
    {
      category: 'Quần',
      name: 'Quần âu ống suông',
      basePrice: 620000,
      description: 'Ống suông, cạp cao, có ly. Vải tuyết mưa ít nhăn.',
      brand: 'Local Studio',
      material: 'Polyester 65% / Viscose 35%',
      imageSeeds: ['trouser1'],
      variants: [
        { size: '29', color: 'Đen', colorHex: '#1A1A1A', stockQty: 12 },
        { size: '30', color: 'Đen', colorHex: '#1A1A1A', stockQty: 3 },
      ],
    },
    {
      category: 'Áo thun',
      name: 'Áo thun cotton bo gân',
      basePrice: 249000,
      description: 'Cotton 100% dệt bo gân, dày dặn, không xuyên thấu.',
      brand: 'Basics',
      material: 'Cotton 100%',
      imageSeeds: ['tee1'],
      variants: [
        { size: 'M', color: 'Xanh navy', colorHex: '#26344D', stockQty: 20 },
        { size: 'L', color: 'Xanh navy', colorHex: '#26344D', stockQty: 15 },
      ],
    },
    {
      category: 'Chân váy',
      name: 'Chân váy xếp ly midi',
      basePrice: 535000,
      description: 'Dài qua gối, ly giữ nếp sau nhiều lần giặt.',
      brand: 'Local Studio',
      material: 'Polyester 100%',
      imageSeeds: ['skirt1'],
      variants: [{ size: 'S', color: 'Kem', colorHex: '#EDE3D2', stockQty: 6 }],
    },
    {
      category: 'Áo khoác',
      name: 'Áo khoác blazer một lớp',
      basePrice: 890000,
      description: 'Không lót, mặc được mùa nóng. Vai nhẹ, không độn dày.',
      brand: 'Local Studio',
      material: 'Linen 55% / Viscose 45%',
      imageSeeds: ['blazer1'],
      variants: [{ size: 'M', color: 'Xám', colorHex: '#8A8A85', stockQty: 4 }],
    },
    {
      category: 'Đầm',
      name: 'Đầm lụa cổ vuông',
      basePrice: 720000,
      description: 'Lụa nhân tạo mềm rủ, cổ vuông, tay ngắn.',
      brand: 'Local Studio',
      material: 'Viscose 100%',
      imageSeeds: ['dress1'],
      variants: [{ size: 'S', color: 'Đỏ đô', colorHex: '#6E2B2B', stockQty: 7 }],
    },
  ];

  const categoryNames = [...new Set(catalog.map((c) => c.category))];
  const categoryByName = new Map<string, number>();
  for (const name of categoryNames) {
    const category = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name, slug: slugify(name) },
    });
    categoryByName.set(name, category.id);
  }

  for (const item of catalog) {
    const slug = slugify(item.name);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) continue;

    await prisma.product.create({
      data: {
        name: item.name,
        slug,
        categoryId: categoryByName.get(item.category)!,
        basePrice: item.basePrice,
        description: item.description,
        brand: item.brand,
        material: item.material,
        images: {
          create: item.imageSeeds.map((seed, i) => ({ url: img(seed), isPrimary: i === 0, sortOrder: i })),
        },
        variants: {
          create: item.variants.map((v, i) => ({
            sku: `${slug.slice(0, 12).toUpperCase()}-${v.size}-${i}`.replace(/\s+/g, ''),
            size: v.size,
            color: v.color,
            colorHex: v.colorHex,
            priceOverride: (v as { priceOverride?: number }).priceOverride,
            stockQty: v.stockQty,
          })),
        },
      },
    });
  }

  // --- Phuong thuc van chuyen ---
  const shippingMethods = [
    { name: 'Giao hàng tiêu chuẩn', fee: 30000, etaDays: '3-5 ngày' },
    { name: 'Giao hàng nhanh', fee: 50000, etaDays: '1-2 ngày' },
    { name: 'Nhận tại cửa hàng', fee: 0, etaDays: 'Trong ngày' },
  ];
  for (const s of shippingMethods) {
    const existing = await prisma.shippingMethod.findFirst({ where: { name: s.name } });
    if (!existing) await prisma.shippingMethod.create({ data: s });
  }

  // --- Ma giam gia mau ---
  await prisma.discountCode.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      type: 'PERCENT',
      value: 10,
      minOrderAmount: 300000,
      maxUses: 100,
      active: true,
    },
  });
  await prisma.discountCode.upsert({
    where: { code: 'FREESHIP30' },
    update: {},
    create: {
      code: 'FREESHIP30',
      type: 'FIXED',
      value: 30000,
      minOrderAmount: 0,
      maxUses: null,
      active: true,
    },
  });

  console.log('Seed xong.');
  console.log('Tai khoan demo:');
  for (const acc of accounts) console.log(`  ${acc.role.padEnd(9)} ${acc.email} / ${acc.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
