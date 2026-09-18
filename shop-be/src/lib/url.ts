import { env } from './env';
import { getRequestBaseUrl } from './requestContext';

/**
 * Neu da la URL tuyet doi (http/https) thi giu nguyen, con lai thi ghep voi
 * host cua request hien tai (tu dong dung IP/wifi dang truy cap) — publicBaseUrl
 * chi con la fallback khi khong nam trong 1 request (VD: script seed).
 */
export function toAbsoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = getRequestBaseUrl() ?? env.publicBaseUrl;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function toAbsoluteUrlOrNull(url: string | null | undefined): string | null {
  return url ? toAbsoluteUrl(url) : null;
}

/**
 * Rut gon URL tuyet doi (VD tra ve tu /admin/uploads luc vua upload) thanh duong dan
 * tuong doi truoc khi luu DB — de sau nay hien anh luon dung theo host dang truy cap,
 * ke ca khi da doi wifi/mang so voi luc upload. Chi ap dung cho anh luu tren chinh
 * server nay (/uploads/...) — URL tro ve dich vu khac (VD Cloudflare R2) phai giu
 * nguyen tuyet doi vi khong the resolve lai qua host cua request hien tai.
 */
export function toRelativePath(url: string): string {
  const m = /^https?:\/\/[^/]+(\/.*)$/i.exec(url);
  if (!m) return url;
  const prefix = `/${env.uploadDir}/`;
  return m[1].startsWith(prefix) ? m[1] : url;
}
