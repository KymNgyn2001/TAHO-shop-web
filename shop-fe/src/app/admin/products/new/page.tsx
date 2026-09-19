// src/app/admin/products/new/page.tsx
'use client';

import ProductForm from '@/components/admin/ProductForm';
import { useRequireRole, STAFF_ROLES } from '@/lib/require-role';

export default function NewProductPage() {
  const { ready } = useRequireRole(STAFF_ROLES);
  if (!ready) return null;
  return <ProductForm mode="create" />;
}
