// 用 lunar-javascript 把农历生日换算成未来若干年的阳历日期（只用于生成数据，不进打包）
import { Lunar, Solar } from 'lunar-javascript';

const today = Solar.fromDate(new Date());
console.log('今天阳历:', today.toYmd(), '| 农历:', today.getLunar().toString());

// 农历月日：男 九月初五（9 月 5 日），女 正月十六（1 月 16 日）
const targets = [
  { key: 'boy', month: 9, day: 5, label: '九月初五' },
  { key: 'girl', month: 1, day: 16, label: '正月十六' },
];

const out = {};
for (const t of targets) {
  const rows = [];
  for (let y = 2025; y <= 2050; y++) {
    try {
      const lunar = Lunar.fromYmd(y, t.month, t.day);
      const solar = lunar.getSolar();
      rows.push(`${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`);
    } catch (e) {
      rows.push(`ERR:${e.message}`);
    }
  }
  out[t.key] = rows;
  console.log(`\n${t.label}:`);
  console.log(rows.join('  '));
}
