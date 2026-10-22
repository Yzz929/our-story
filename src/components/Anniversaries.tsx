import { fmtCN, fmtShort, nextFromSolarTable, nextOccurrence } from '../lib/date';
import type { Anniversary } from '../data/types';

export function Anniversaries({ items, now }: { items: Anniversary[]; now: Date }) {
  if (!items.length) {
    return (
      <p className="hint" style={{ textAlign: 'center' }}>
        还没有纪念日，去「写点什么」里加一个吧。
      </p>
    );
  }

  const rows = items
    .map((a) => {
      const lunarNext = a.solarByYear ? nextFromSolarTable(a.solarByYear, now) : null;
      const next = lunarNext ?? nextOccurrence(a.date, now);
      return { ...a, next, isLunar: Boolean(lunarNext) };
    })
    .sort((x, y) => x.next.daysLeft - y.next.daysLeft);

  return (
    <div className="anniv-grid">
      {rows.map((a, i) => {
        const { daysLeft, date } = a.next;
        const nextISO = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
          date.getDate()
        ).padStart(2, '0')}`;
        return (
          <article
            key={a.id}
            className={`anniv ${daysLeft === 0 ? 'is-today' : ''}`}
            data-reveal
            style={{ ['--d' as string]: `${i * 70}ms` }}
          >
            <div className="anniv-icon" aria-hidden="true">
              {a.icon || '💗'}
            </div>
            <h3 className="anniv-title">{a.title}</h3>
            <div className="anniv-date">
              {a.isLunar ? `农历${a.lunar}` : `${fmtShort(a.date)} · 每年`}
            </div>
            <div className="anniv-left">
              {daysLeft === 0 ? (
                <b>就是今天</b>
              ) : (
                <>
                  <span>还有</span>
                  <b>{daysLeft}</b>
                  <span>天</span>
                </>
              )}
            </div>
            <div className="anniv-date">{fmtCN(nextISO)}</div>
            {a.note && <p className="anniv-note">{a.note}</p>}
          </article>
        );
      })}
    </div>
  );
}
