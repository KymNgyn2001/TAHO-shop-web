// src/app/admin/products/new/page.tsx
'use client';

import ProductForm from '@/components/admin/ProductForm';
import { useRequireRole } from '@/lib/require-role';

export default function NewProductPage() {
  const { ready } = useRequireRole(['EMPLOYEE', 'MANAGER']);
  if (!ready) return null;
  return <ProductForm mode="create" />;
}
