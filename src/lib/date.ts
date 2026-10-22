export const MS_DAY = 86_400_000;

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 相差多少个「自然日」（忽略时分秒，按本地日期算） */
export function diffDays(fromISO: string, to: Date = new Date()): number {
  const a = parseDate(fromISO).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.floor((b - a) / MS_DAY);
}

export interface Elapsed {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** 在一起的第几天（今天 = 1） */
  dayIndex: number;
  /** 百分数用的进度（当天已过比例） */
  dayProgress: number;
}

export function elapsedSince(startISO: string, now: Date = new Date()): Elapsed {
  const start = parseDate(startISO).getTime();
  const total = Math.max(0, now.getTime() - start);
  const days = Math.floor(total / MS_DAY);
  const rest = total - days * MS_DAY;
  const hours = Math.floor(rest / 3_600_000);
  const minutes = Math.floor((rest % 3_600_000) / 60_000);
  const seconds = Math.floor((rest % 60_000) / 1000);
  return {
    days,
    hours,
    minutes,
    seconds,
    dayIndex: days + 1,
    dayProgress: (rest % MS_DAY) / MS_DAY,
  };
}

export function fmtCN(iso: string): string {
  const d = parseDate(iso);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function fmtShort(iso: string): string {
  const d = parseDate(iso);
  return `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export function weekday(iso: string): string {
  return WEEKDAYS[parseDate(iso).getDay()];
}

export interface NextOccurrence {
  /** 下一次到来的日期 */
  date: Date;
  daysLeft: number;
  /** 第几个（在一起的第几年 / 第几次生日） */
  nth: number;
}

/** 下一次纪念日：年份不参与计算，按「下一次月日」算 */
export function nextOccurrence(iso: string, now: Date = new Date()): NextOccurrence {
  const base = parseDate(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidate = new Date(now.getFullYear(), base.getMonth(), base.getDate());
  const date = candidate.getTime() >= today.getTime() ? candidate : new Date(now.getFullYear() + 1, base.getMonth(), base.getDate());
  const daysLeft = Math.round((date.getTime() - today.getTime()) / MS_DAY);
  const nth = date.getFullYear() - base.getFullYear() + 1;
  return { date, daysLeft, nth };
}

export function humanDaysLeft(n: number): string {
  if (n === 0) return '就是今天';
  if (n === 1) return '明天';
  return `还有 ${n} 天`;
}

/**
 * 农历纪念日：用预先算好的「年份 → 阳历日期」表，取下一个还没到的日子。
 * 表由 scripts/lunar-table.mjs 生成，运行时不需要农历库。
 */
export function nextFromSolarTable(
  table: Record<string, string> | undefined,
  now: Date = new Date()
): NextOccurrence | null {
  if (!table) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dates = Object.values(table)
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))
    .map(parseDate)
    .sort((a, b) => a.getTime() - b.getTime());
  const next = dates.find((d) => d.getTime() >= today);
  if (!next) return null;
  const daysLeft = Math.round((next.getTime() - today) / MS_DAY);
  return { date: next, daysLeft, nth: next.getFullYear() };
}
