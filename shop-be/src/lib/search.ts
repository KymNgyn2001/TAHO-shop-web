const GREETINGS = new Set([
  'hi', 'hii', 'hello', 'helo', 'hey', 'yo', 'alo',
  'chao', 'chào', 'chao ban', 'chào bạn', 'xin chao', 'xin chào',
]);

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}0-9]+/u)
    .filter((w) => w.length >= 2);
}

/** true neu cau chi la loi chao/qua ngan, khong dang de dem la 1 cau tim kiem that. */
export function isGreetingOrTooShort(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  if (trimmed.length === 0) return true;
  if (GREETINGS.has(trimmed) || GREETINGS.has(stripDiacritics(trimmed))) return true;
  return tokenize(message).length === 0;
}

/**
 * Diem trung khop theo TU NGUYEN VEN (khong phai chuoi con), tranh viec query
 * ngan nhu "hi" trung ngau nhien vao giua tu khac ("nghi", "chi"...).
 * Tra ve ty le so tu trong query xuat hien trong haystack.
 */
export function scoreText(query: string, haystack: string): number {
  const qWords = tokenize(query);
  if (qWords.length === 0) return 0;
  const hWords = new Set(tokenize(haystack));
  const hits = qWords.filter((w) => hWords.has(w)).length;
  return hits / qWords.length;
}
