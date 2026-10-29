import { diffDays, fmtShort, weekday } from '../lib/date';
import { photoUrl } from '../lib/photo';
import type { Milestone } from '../data/types';

interface Props {
  milestones: Milestone[];
  startDate: string;
  boy: string;
  girl: string;
  onPhoto: (src: string, caption: string) => void;
}

/** 作者小徽章：@男方名字 / @女方名字 */
function Author({ name, author }: { name: string; author: 'boy' | 'girl' }) {
  return (
    <span className={`tl-author tl-author-${author}`} title={`${name} 写的`}>
      <i aria-hidden="true">{name.replace(/^(小|阿|老|大)/, '').slice(0, 1) || name.slice(0, 1)}</i>@{name}
    </span>
  );
}

export function Timeline({ milestones, startDate, boy, girl, onPhoto }: Props) {
  if (!milestones.length) {
    return (
      <p className="hint" style={{ textAlign: 'center' }}>
        还没有记录，去「写点什么」里加上第一条吧。
      </p>
    );
  }

  return (
    <div className="timeline">
      {milestones.map((m, i) => {
        const day = diffDays(startDate, new Date(m.date + 'T00:00:00')) + 1;
        return (
          <article className="tl-item" key={m.id} data-reveal style={{ ['--d' as string]: `${i * 60}ms` }}>
            <span className="tl-dot" aria-hidden="true" />
            <div className="tl-card">
              <div className="tl-meta">
                <span className="tl-date">
                  {fmtShort(m.date)} · {weekday(m.date)}
                </span>
                {day > 0 && <span className="tl-day">第 {day} 天</span>}
                {m.author === 'boy' && <Author name={boy} author="boy" />}
                {m.author === 'girl' && <Author name={girl} author="girl" />}
                {m.tag && <span className="tl-tag">{m.tag}</span>}
              </div>
              <h3 className="tl-title">{m.title}</h3>
              {m.text && <p className="tl-text">{m.text}</p>}
              {!!m.photos?.length && (
                <div className={`tl-photos ${m.photos.length === 1 ? 'one' : ''}`}>
                  {m.photos.map((src, k) => (
                    <button
                      key={k}
                      className="tl-photo"
                      onClick={() => onPhoto(src, m.title)}
                      aria-label={`查看照片：${m.title}`}
                    >
                      <img src={photoUrl(src)} alt={`${m.title} 的照片 ${k + 1}`} loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
      <div className="tl-end" data-reveal>
        故事未完待续
      </div>
    </div>
  );
}
