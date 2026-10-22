import { useEffect, useState } from 'react';
import { GiftIcon, PhotoIcon, TimelineIcon } from './Icons';

const ITEMS = [
  { id: 'moments', label: '点点滴滴', Icon: TimelineIcon },
  { id: 'gallery', label: '相册', Icon: PhotoIcon },
  { id: 'anniversaries', label: '纪念日', Icon: GiftIcon },
];

/** 手机端左侧悬浮的三段跳转（桌面端顶栏已经有 tab，这里用 CSS 隐藏） */
export function SideRail() {
  const [active, setActive] = useState('moments');

  useEffect(() => {
    const onScroll = () => {
      const mid = window.innerHeight * 0.45;
      let current = '';
      for (const item of ITEMS) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) current = item.id;
      }
      if (current) setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className="side-rail" aria-label="快速跳转">
      {ITEMS.map(({ id, label, Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          className={`side-rail-btn ${active === id ? 'is-active' : ''}`}
          aria-label={label}
          title={label}
        >
          <Icon />
        </a>
      ))}
    </nav>
  );
}
