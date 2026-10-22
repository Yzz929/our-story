import { elapsedSince, fmtCN } from '../lib/date';
import type { SiteData } from '../data/types';
import { Heart } from './Icons';

export function Footer({ data, now }: { data: SiteData; now: Date }) {
  const e = elapsedSince(data.couple.startDate, now);
  return (
    <footer className="footer">
      <div className="container">
        {data.couple.motto && <p className="footer-motto">“{data.couple.motto}”</p>}
        <p className="footer-names">
          {data.couple.boy} <Heart /> {data.couple.girl}
        </p>
        <p style={{ marginTop: 6 }}>
          在一起 {e.dayIndex} 天 · 始于 {fmtCN(data.couple.startDate)}
        </p>
        <p style={{ marginTop: 14, opacity: 0.7 }}>
          留给自己的小宇宙 ·{' '}
          <a href="#/edit" style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>
            写点什么
          </a>
        </p>
      </div>
    </footer>
  );
}
