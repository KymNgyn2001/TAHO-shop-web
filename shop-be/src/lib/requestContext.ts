import { AsyncLocalStorage } from 'async_hooks';

/**
 * Luu "host ma client dang dung de goi toi server nay" cho tung request,
 * de link anh tra ve luon dung mang/IP hien tai — khong phai sua .env
 * moi lan doi wifi (nha, truong...).
 */
const als = new AsyncLocalStorage<{ baseUrl: string }>();

export function withRequestBaseUrl(baseUrl: string, next: () => void): void {
  als.run({ baseUrl }, next);
}

export function getRequestBaseUrl(): string | undefined {
  return als.getStore()?.baseUrl;
}
