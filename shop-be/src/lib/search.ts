const GREETINGS = new Set([
  'hi', 'hii', 'hello', 'helo', 'hey', 'yo', 'alo',
  'chao', 'chào', 'chao ban', 'chào bạn', 'xin chao', 'xin chào',
]);

export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, (m) => (m === 'Đ' ? 'D' : 'd'));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}0-9]+/u)
    .filter((w) => w.length >= 2);
}

/**
 * Tu chuc nang khong mang nghia san pham — loai ra truoc khi tinh diem trung khop,
 * neu khong cau tu nhien ("minh muon mua ao") se bi loang diem vi qua nhieu tu dem.
 */
const STOPWORDS = new Set([
  'minh', 'toi', 'em', 'anh', 'chi', 'ban', 'ban',
  'muon', 'can', 'mua', 'tim', 'kiem', 'xem', 'giup', 'lam',
  'cho', 'la', 'co', 'duoc', 'voi', 'va', 'cua', 'o', 'tai',
  'mot', 'cai', 'con', 'nay', 'do', 'kia', 'thi', 'the', 'vay',
  'nhe', 'nha', 'a', 'sao', 'khong', 'hay', 'hoac', 'nhu', 'nao',
  'de', 'roi', 'dang', 'se', 'da', 'rat', 'qua', 'hon', 'nhat',
  'please', 'ye', 'yeu',
]);

function contentWords(words: string[]): string[] {
  const filtered = words.filter((w) => !STOPWORDS.has(stripDiacritics(w)));
  return filtered.length > 0 ? filtered : words;
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
  const qWords = contentWords(tokenize(query));
  if (qWords.length === 0) return 0;
  const hWords = new Set(tokenize(haystack));
  const hits = qWords.filter((w) => hWords.has(w)).length;
  return hits / qWords.length;
}
