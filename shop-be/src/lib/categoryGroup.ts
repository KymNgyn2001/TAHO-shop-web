import { stripDiacritics } from './search';

/** Nhom menu co dinh — dung chung cho form tao danh muc (categories.routes.ts) va chatbot (chat.routes.ts),
 * tranh viec danh muc tao ra khong co nhom roi bi troi o muc "Khac" tren menu. */
export const CATEGORY_GROUPS = ['Áo', 'Quần', 'Váy & Đầm', 'Phụ kiện'] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

/** Doan nhom tu ten danh muc; khong doan duoc -> null (nhan vien tu xep sau o trang Danh muc). */
export function guessCategoryGroup(name: string): CategoryGroup | null {
  const flat = stripDiacritics(name.toLowerCase());
  if (/\b(quan|jean|short|jogger|kaki)\b/.test(flat)) return 'Quần';
  if (/\b(vay|dam)\b/.test(flat)) return 'Váy & Đầm';
  if (/\b(ao|sweater|hoodie|polo|cardigan|len)\b/.test(flat)) return 'Áo';
  if (/\b(non|mu|tui|that lung|day lung|vo|khan|kinh|phu kien)\b/.test(flat)) return 'Phụ kiện';
  return null;
}
