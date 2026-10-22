/** 阿拉伯数字转中文数字（1 ~ 9999，够写天数了） */
const DIGITS = '零一二三四五六七八九';
const UNITS = ['', '十', '百', '千'];

export function toChineseNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  n = Math.floor(n);
  if (n === 0) return '零';
  if (n >= 10000) return String(n);

  const s = String(n);
  let out = '';
  let pendingZero = false;

  for (let i = 0; i < s.length; i++) {
    const digit = Number(s[i]);
    const pos = s.length - 1 - i;
    if (digit === 0) {
      pendingZero = true;
      continue;
    }
    if (pendingZero && out) {
      out += '零';
      pendingZero = false;
    }
    out += DIGITS[digit] + UNITS[pos];
  }

  // 十五 而不是 一十五
  return out.replace(/^一十/, '十');
}

/** 把 {days} / {cn} 占位符替换成天数 */
export function fillDays(template: string, days: number): string {
  return template.replace(/\{days\}/g, String(days)).replace(/\{cn\}/g, toChineseNumber(days));
}

/** 标题可能是模板，也可能是固定文案 */
export function resolveTitle(title: string | undefined, template: string | undefined, days: number): string {
  if (template && template.trim()) return fillDays(template, days);
  return title ?? '';
}
