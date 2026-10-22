import { useCallback, useEffect, useState } from 'react';
import { photoUrl } from '../lib/photo';
import { ChevronLeft, ChevronRight, Close } from './Icons';
import type { GalleryItem } from '../data/types';

export interface LightboxState {
  items: GalleryItem[];
  index: number;
}

export function Lightbox({ state, onClose }: { state: LightboxState; onClose: () => void }) {
  const { items, index } = state;
  const [i, setI] = useState(index);

  const go = useCallback(
    (step: number) => setI((v) => (v + step + items.length) % items.length),
    [items.length]
  );

  useEffect(() => setI(index), [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [go, onClose]);

  const item = items[i];
  if (!item) return null;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="lb-close" onClick={onClose} aria-label="关闭">
        <Close />
      </button>
      {items.length > 1 && (
        <button
          className="lb-btn lb-prev"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          aria-label="上一张"
        >
          <ChevronLeft />
        </button>
      )}
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={photoUrl(item.src)} alt={item.caption ?? '照片'} />
        {item.caption && (
          <figcaption>
            {item.caption} · {i + 1} / {items.length}
          </figcaption>
        )}
      </figure>
      {items.length > 1 && (
        <button
          className="lb-btn lb-next"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          aria-label="下一张"
        >
          <ChevronRight />
        </button>
      )}
    </div>
  );
}

export function Gallery({ items, onOpen }: { items: GalleryItem[]; onOpen: (index: number) => void }) {
  if (!items.length) {
    return (
      <p className="hint" style={{ textAlign: 'center' }}>
        相册还是空的，去「写点什么」里传几张照片吧。
      </p>
    );
  }

  return (
    <div className="gallery">
      {items.map((g, i) => (
        <figure
          className="gal-item"
          key={g.id}
          onClick={() => onOpen(i)}
          data-reveal
          style={{ ['--d' as string]: `${(i % 3) * 80}ms` }}
        >
          <img src={photoUrl(g.src)} alt={g.caption ?? `照片 ${i + 1}`} loading="lazy" />
          {g.caption && <figcaption className="gal-cap">{g.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
