// 用 lunar-javascript 把农历生日换算成未来若干年的阳历日期（只用于生成数据，不进打包）
import { Lunar, Solar } from 'lunar-javascript';

const today = Solar.fromDate(new Date());
console.log('今天阳历:', today.toYmd(), '| 农历:', today.getLunar().toString());

// 农历月日：示例用 三月初三 / 八月初八，需要时改成自己的
const targets = [
  { key: 'boy', month: 3, day: 3, label: '三月初三' },
  { key: 'girl', month: 8, day: 8, label: '八月初八' },
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
