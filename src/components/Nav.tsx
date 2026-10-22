import type { Theme } from '../hooks';
import { Heart, Moon, Pencil, Sun } from './Icons';

export function Nav({ title, theme, onToggleTheme }: { title: string; theme: Theme; onToggleTheme: () => void }) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a className="nav-brand" href="#top">
          <Heart />
          {title}
        </a>
        <div className="nav-links">
          <a className="nav-link" href="#moments">
            点点滴滴
          </a>
          <a className="nav-link" href="#gallery">
            相册
          </a>
          <a className="nav-link" href="#anniversaries">
            纪念日
          </a>
        </div>
        <a className="nav-link" href="#/edit" title="写点什么">
          <Pencil />
        </a>
        <button className="icon-btn" onClick={onToggleTheme} aria-label={theme === 'light' ? '切换到夜间' : '切换到白天'}>
          {theme === 'light' ? <Moon /> : <Sun />}
        </button>
      </div>
    </nav>
  );
}
