import { useEffect, useState } from 'react';
import { loadData, saveData } from './data/store';
import { cloudEnabled, fetchCloudSite } from './data/cloud';
import type { SiteData } from './data/types';
import { useHashRoute, useNow, useReveal, useTheme } from './hooks';
import { elapsedSince } from './lib/date';
import { fillDays, toChineseNumber } from './lib/cn';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { Timeline } from './components/Timeline';
import { Gallery, Lightbox } from './components/Gallery';
import type { LightboxState } from './components/Gallery';
import { Anniversaries } from './components/Anniversaries';
import { Quote } from './components/Quote';
import { Footer } from './components/Footer';
import { Editor } from './components/Editor';
import { Gate, gateNeeded } from './components/Gate';
import type { GateConfig } from './components/Gate';
import gateConfigJson from './data/cloud-config.json';
import { Heart } from './components/Icons';

const gateConfig = (gateConfigJson as { gate?: GateConfig }).gate;

export default function App() {
  const [data, setData] = useState<SiteData>(() => loadData());
  const [booting, setBooting] = useState(cloudEnabled);
  const [cloudReady, setCloudReady] = useState(!cloudEnabled);
  const [unlocked, setUnlocked] = useState(() => !gateNeeded(gateConfig));
  const [theme, toggleTheme] = useTheme();
  const now = useNow(1000);
  const route = useHashRoute();
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [toast, setToast] = useState('');

  // 配了云端就以云端为准（多个设备共享同一份内容）
  useEffect(() => {
    if (!cloudEnabled) return;
    let alive = true;
    fetchCloudSite()
      .then((cloud) => {
        if (!alive) return;
        if (cloud?.couple) setData(cloud);
        setCloudReady(true);
      })
      .catch((err) => {
        // 读不到云端就不允许回写，免得用示例数据把云端内容盖掉
        console.warn('[cloud]', err);
        if (alive) setCloudReady(false);
      })
      .finally(() => {
        if (alive) setBooting(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 没配云端时，改动自动存本机浏览器；配了云端由编辑页负责写回云端
  useEffect(() => {
    if (cloudEnabled) return;
    const id = window.setTimeout(() => saveData(data), 400);
    return () => window.clearTimeout(id);
  }, [data]);

  useReveal([data, route]);

  // Ctrl / Cmd + E 直接进编辑页
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        window.location.hash = '#/edit';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2400);
  };

  const dayIndex = elapsedSince(data.couple.startDate, now).dayIndex;
  const template = data.couple.titleTemplate?.trim();
  const title = template ? fillDays(template, dayIndex) : data.couple.title;
  const highlight = template
    ? template.includes('{cn}')
      ? toChineseNumber(dayIndex)
      : template.includes('{days}')
        ? String(dayIndex)
        : undefined
    : data.couple.titleHighlight || undefined;

  const toastEl = <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>;

  // 浏览器标签标题也显示「我们的一百六十五天」，分享出去更好看
  useEffect(() => {
    document.title = title;
  }, [title]);

  // 输口令之前，什么都不放出来
  if (!unlocked) {
    return (
      <Gate
        config={{
          title: gateConfig?.title ?? '故事的开始',
          hint: gateConfig?.hint ?? '输入我们的那一天',
          password: gateConfig?.password ?? '',
          placeholder: gateConfig?.placeholder ?? '口令',
          button: gateConfig?.button ?? '进去看看',
          wrong: gateConfig?.wrong ?? '口令不对，再想想',
        }}
        onUnlock={() => setUnlocked(true)}
      />
    );
  }

  if (booting) {
    return (
      <div className="boot">
        <Heart />
        <span>正在打开我们的故事…</span>
      </div>
    );
  }

  if (route.startsWith('/edit')) {
    return (
      <>
        <Editor data={data} onChange={setData} onToast={showToast} cloudReady={cloudReady} />
        {toastEl}
      </>
    );
  }

  return (
    <>
      <Nav title={title} theme={theme} onToggleTheme={toggleTheme} />
      <Hero data={data} now={now} title={title} highlight={highlight} />

      <section className="section" id="moments">
        <div className="container">
          <div className="section-head" data-reveal>
            <p className="eyebrow">OUR MOMENTS</p>
            <h2 className="section-title">点点滴滴</h2>
            <p className="section-desc">从第一天到现在，那些被认真记住的瞬间。</p>
          </div>
          <Timeline
            milestones={data.milestones}
            startDate={data.couple.startDate}
            onPhoto={(src, caption) => setLightbox({ items: [{ id: 'single', src, caption }], index: 0 })}
          />
        </div>
      </section>

      <section className="section" id="gallery">
        <div className="container">
          <div className="section-head" data-reveal>
            <p className="eyebrow">PHOTO WALL</p>
            <h2 className="section-title">我们的照片</h2>
            <p className="section-desc">点开可以放大看。</p>
          </div>
          <Gallery items={data.gallery} onOpen={(index) => setLightbox({ items: data.gallery, index })} />
        </div>
      </section>

      <section className="section" id="anniversaries">
        <div className="container">
          <div className="section-head" data-reveal>
            <p className="eyebrow">SPECIAL DAYS</p>
            <h2 className="section-title">纪念日</h2>
            <p className="section-desc">提前记住，才不会错过。</p>
          </div>
          <Anniversaries items={data.anniversaries} now={now} />
        </div>
      </section>

      <Quote quotes={data.quotes} />
      <Footer data={data} now={now} />

      {lightbox && <Lightbox state={lightbox} onClose={() => setLightbox(null)} />}
      {toastEl}
    </>
  );
}
