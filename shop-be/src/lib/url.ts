import { env } from './env';

/** Neu da la URL tuyet doi (http/https) thi giu nguyen, con lai thi ghep voi publicBaseUrl. */
export function toAbsoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${env.publicBaseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function toAbsoluteUrlOrNull(url: string | null | undefined): string | null {
  return url ? toAbsoluteUrl(url) : null;
}
