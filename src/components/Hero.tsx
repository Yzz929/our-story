import { elapsedSince, fmtCN } from '../lib/date';
import { photoUrl } from '../lib/photo';
import type { SiteData } from '../data/types';
import { Heart } from './Icons';

const HEARTS = Array.from({ length: 9 }, (_, i) => ({
  left: `${6 + i * 11 + (i % 3) * 3}%`,
  delay: `${(i * 2.3) % 14}s`,
  duration: `${13 + (i % 5) * 2.4}s`,
  size: `${9 + (i % 4) * 4}px`,
}));

function Title({ title, highlight }: { title: string; highlight?: string }) {
  if (!highlight || !title.includes(highlight)) return <>{title}</>;
  const [before, after] = title.split(highlight);
  return (
    <>
      {before}
      <span className="hl">{highlight}</span>
      {after}
    </>
  );
}
/** 昵称常常是「小X」「阿X」，取头像字时把前缀去掉，避免两个人都显示「小」 */
function initialOf(name: string): string {
  const rest = name.trim().replace(/^(小|阿|老|大)/, '');
  return (rest || name.trim()).slice(0, 1);
}

function Avatar({ src, name }: { src?: string; name: string }) {
  return (
    <div className="person-avatar">{src ? <img src={photoUrl(src)} alt={name} /> : initialOf(name)}</div>
  );
}

export function Hero({
  data,
  now,
  title,
  highlight,
}: {
  data: SiteData;
  now: Date;
  title: string;
  highlight?: string;
}) {
  const { couple, milestones, gallery, anniversaries } = data;
  const e = elapsedSince(couple.startDate, now);
  const photoCount =
    gallery.length + milestones.reduce((n, m) => n + (m.photos?.length ?? 0), 0);

  const units = [
    { num: e.days, label: '天' },
    { num: e.hours, label: '时' },
    { num: e.minutes, label: '分' },
    { num: e.seconds, label: '秒' },
  ];

  return (
    <header className="hero" id="top">
      <div className="orbs" aria-hidden="true">
        <i className="orb orb-a" />
        <i className="orb orb-b" />
        <i className="orb orb-c" />
      </div>
      <div className="hearts" aria-hidden="true">
        {HEARTS.map((h, i) => (
          <span
            key={i}
            className="heart"
            style={{ left: h.left, animationDelay: h.delay, animationDuration: h.duration, fontSize: h.size }}
          >
            ♥
          </span>
        ))}
      </div>

      <div className="hero-plate">
        <p className="eyebrow">WELCOME TO OUR LITTLE WORLD</p>
        <h1 className="hero-title">
          <Title title={title} highlight={highlight} />
        </h1>
        <p className="hero-sub">{couple.subtitle}</p>

        <div className="couple">
          <div className="person person-boy">
            <Avatar src={couple.boyAvatar} name={couple.boy} />
            <div className="person-meta">
              <div className="person-role">BOY</div>
              <div className="person-name">{couple.boy}</div>
              {couple.boyTag && <div className="person-tag">{couple.boyTag}</div>}
            </div>
          </div>

          <div className="heart-badge" title="在一起">
            <Heart />
          </div>

          <div className="person person-girl">
            <div className="person-meta">
              <div className="person-role">GIRL</div>
              <div className="person-name">{couple.girl}</div>
              {couple.girlTag && <div className="person-tag">{couple.girlTag}</div>}
            </div>
            <Avatar src={couple.girlAvatar} name={couple.girl} />
          </div>
        </div>

        <div className="counter">
          <div className="counter-grid" aria-live="off">
            {units.map((u) => (
              <div className="unit" key={u.label}>
                <div className="unit-num">{String(u.num).padStart(2, '0')}</div>
                <div className="unit-label">{u.label}</div>
              </div>
            ))}
          </div>
          <div className="counter-foot">
            <span>始于 {fmtCN(couple.startDate)}</span>
            <span>
              今天是我们在一起的第 <b>{e.dayIndex}</b> 天
            </span>
          </div>
        </div>

        <div className="hero-stats">
          <div className="hero-stat">
            <b>{milestones.length}</b>
            <span>条 点点滴滴</span>
          </div>
          <div className="hero-stat">
            <b>{photoCount}</b>
            <span>张 照片</span>
          </div>
          <div className="hero-stat">
            <b>{anniversaries.length}</b>
            <span>个 纪念日</span>
          </div>
        </div>
      </div>

      <a className="scroll-cue" href="#moments" aria-label="往下看看">
        <span />
        往下看看
      </a>
    </header>
  );
}
