/**
 * Tu van size dua tren chieu cao/can nang khach nhap trong chat. Nguong lay tu bang
 * so do that cua Hoodie TAHO (S 1m50-1m60/45-60kg ... 2XL 1m72-1m85/95-110kg) —
 * dung chung cho moi san pham vi hien chua co so do rieng tung loai ao trong DB.
 *
 * Cach doi sang so do rieng cua san pham sau nay: sua ham recommendSize() de nhan
 * them tham so bang size cua san pham (VD tu 1 truong moi trong DB) thay vi dung
 * WEIGHT_TIERS/HEIGHT_TIERS co dinh ben duoi.
 */

export const SIZE_ORDER = ['S', 'M', 'L', 'XL', '2XL', '3XL'] as const;

/** Nguong tren (kg) cua tung size — vd <58kg la S, 58-68kg la M... (3XL chua co
 * so do rieng, tam dung nguong tren cua 2XL keo dai them). */
const WEIGHT_TIERS = [58, 68, 81, 98, 110, Infinity];
/** Nguong tren (cm) cua tung size. */
const HEIGHT_TIERS = [159, 167, 172, 176, 185, Infinity];

function tierIndex(value: number, tiers: number[]): number {
  return tiers.findIndex((max) => value < max);
}

export function parseHeightCm(text: string): number | null {
  let m = /(\d{3})\s*cm\b/i.exec(text);
  if (m) return Number(m[1]);
  m = /\b1\s*m\s*(\d{2})\b/i.exec(text);
  if (m) return 100 + Number(m[1]);
  m = /\b1[.,](\d{2})\s*m?\b/.exec(text);
  if (m) return 100 + Number(m[1]);
  return null;
}

export function parseWeightKg(text: string): number | null {
  const m = /(\d{2,3})\s*kg\b/i.exec(text);
  return m ? Number(m[1]) : null;
}

/**
 * Tra ve size uoc luong (VD "L") tu chieu cao va/hoac can nang, hoac null neu
 * khong co du lieu nao ca. Can nang la yeu to chinh (anh huong vong nguc/eo
 * nhieu hon), chieu cao chi keo len them khi qua chenh lech.
 */
export function recommendSize(heightCm: number | null, weightKg: number | null): string | null {
  if (heightCm == null && weightKg == null) return null;

  let idx: number;
  if (weightKg != null && heightCm != null) {
    const byWeight = tierIndex(weightKg, WEIGHT_TIERS);
    const byHeight = tierIndex(heightCm, HEIGHT_TIERS);
    idx = Math.max(byWeight, Math.round((byWeight + byHeight) / 2));
  } else if (weightKg != null) {
    idx = tierIndex(weightKg, WEIGHT_TIERS);
  } else {
    idx = tierIndex(heightCm!, HEIGHT_TIERS);
  }
  return SIZE_ORDER[Math.min(Math.max(idx, 0), SIZE_ORDER.length - 1)];
}

/**
 * San pham co the khong ban dung size uoc luong (VD chi co toi XL, khong co XXL) —
 * chon size gan nhat dang co, uu tien size lon hon khi cach deu (mac rong con hon chat).
 */
export function nearestAvailableSize(target: string, available: string[]): string | null {
  if (available.length === 0) return null;
  if (available.includes(target)) return target;
  const targetIdx = SIZE_ORDER.indexOf(target as (typeof SIZE_ORDER)[number]);
  let best: string = available[0];
  let bestScore = -Infinity;
  for (const s of available) {
    const idx = SIZE_ORDER.indexOf(s as (typeof SIZE_ORDER)[number]);
    if (idx < 0) continue;
    const dist = Math.abs(idx - targetIdx);
    const score = -dist * 10 + idx * 0.1; // dist gan nhat truoc, lon hon la loi khi hoa
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}
