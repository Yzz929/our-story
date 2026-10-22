import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { fileToDataUrl } from '../lib/image';
import { photoUrl } from '../lib/photo';
import { ArrowDown, ArrowLeft, ArrowUp, Download, Plus, Trash, Upload } from './Icons';
import { downloadJson, hasSaved, saveData, SAMPLE, storageBytes, uid } from '../data/store';
import { cloudEnabled, saveCloudSite, uploadImage } from '../data/cloud';
import type { Anniversary, Couple, GalleryItem, Milestone, SiteData } from '../data/types';

const MAX_STORAGE = 5 * 1024 * 1024;

/** 配了云端就传到云存储换 URL，没配就压成 base64 存在本机 */
async function filesToUrls(files: FileList | null): Promise<string[]> {
  if (!files?.length) return [];
  const out: string[] = [];
  for (const f of Array.from(files)) {
    if (!f.type.startsWith('image/')) continue;
    out.push(cloudEnabled ? await uploadImage(f) : await fileToDataUrl(f));
  }
  return out;
}

function PhotoPicker({ onAdd }: { onAdd: (urls: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="thumb-add" title="上传照片" onClick={() => ref.current?.click()}>
        <Plus />
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e: ChangeEvent<HTMLInputElement>) => {
          const files = e.target.files;
          try {
            const urls = await filesToUrls(files);
            if (urls.length) onAdd(urls);
          } catch (err) {
            window.alert('照片上传失败：' + (err instanceof Error ? err.message : String(err)));
          }
          e.target.value = '';
        }}
      />
    </>
  );
}

function Thumbs({ photos, onChange }: { photos: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="thumbs">
      {photos.map((src, i) => (
        <div className="thumb" key={`${src.slice(0, 24)}-${i}`}>
          <img src={photoUrl(src)} alt="" />
          <button
            type="button"
            className="thumb-del"
            title="移除"
            onClick={() => onChange(photos.filter((_, k) => k !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <PhotoPicker onAdd={(urls) => onChange([...photos, ...urls])} />
      <button
        type="button"
        className="thumb-add"
        title="用图片链接"
        onClick={() => {
          const url = window.prompt('图片地址（也可以是 photos/xxx.jpg 这种相对路径）');
          if (url?.trim()) onChange([...photos, url.trim()]);
        }}
      >
        <Upload />
      </button>
    </div>
  );
}

interface Props {
  data: SiteData;
  onChange: (next: SiteData) => void;
  onToast: (msg: string) => void;
  /** 云端读取是否成功；没成功就不要回写，免得覆盖云端内容 */
  cloudReady?: boolean;
}

/** 作者选择：两个小胶囊，再点一次可以取消 */
function AuthorPills({
  value,
  boy,
  girl,
  onChange,
}: {
  value?: 'boy' | 'girl';
  boy: string;
  girl: string;
  onChange: (next?: 'boy' | 'girl') => void;
}) {
  return (
    <div className="author-pills">
      <button
        type="button"
        className={value === 'boy' ? 'on' : ''}
        onClick={() => onChange(value === 'boy' ? undefined : 'boy')}
      >
        {boy}
      </button>
      <button
        type="button"
        className={value === 'girl' ? 'on' : ''}
        onClick={() => onChange(value === 'girl' ? undefined : 'girl')}
      >
        {girl}
      </button>
    </div>
  );
}

export function Editor({ data, onChange, onToast, cloudReady = true }: Props) {
  const { couple, milestones, gallery, anniversaries, quotes } = data;

  // 这台设备是谁在用（记在本机），新建记录默认算在 TA 名下
  const [me, setMe] = useState<'boy' | 'girl' | null>(() => {
    try {
      const v = localStorage.getItem('our-story:me');
      return v === 'boy' || v === 'girl' ? v : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (me) localStorage.setItem('our-story:me', me);
    } catch {}
  }, [me]);

  const patch = (p: Partial<SiteData>) => onChange({ ...data, ...p });
  const patchCouple = (p: Partial<Couple>) => patch({ couple: { ...couple, ...p } });

  const setMilestone = (id: string, p: Partial<Milestone>) =>
    patch({ milestones: milestones.map((m) => (m.id === id ? { ...m, ...p } : m)) });

  const move = <T,>(arr: T[], i: number, step: number): T[] => {
    const j = i + step;
    if (j < 0 || j >= arr.length) return arr;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  const addMilestone = () => {
    const last = milestones[milestones.length - 1];
    const m: Milestone = {
      id: uid(),
      date: last?.date ?? new Date().toISOString().slice(0, 10),
      title: '新的回忆',
      text: '',
      tag: '',
      photos: [],
      author: me ?? undefined,
    };
    patch({ milestones: [...milestones, m] });
  };

  const addAnniversary = () => {
    const a: Anniversary = {
      id: uid(),
      date: new Date().toISOString().slice(0, 10),
      title: '新的纪念日',
      icon: '💗',
      note: '',
    };
    patch({ anniversaries: [...anniversaries, a] });
  };

  const addGallery = (urls: string[]) => {
    const items: GalleryItem[] = urls.map((src) => ({ id: uid(), src, caption: '' }));
    patch({ gallery: [...gallery, ...items] });
  };

  const pickGallery = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const bytes = storageBytes();
  const pct = Math.min(100, (bytes / MAX_STORAGE) * 100);

  // 云端模式下自动同步：改完停手 1.8 秒就写回云端（云端没读成功时先不写）
  const [cloudState, setCloudState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  useEffect(() => {
    if (!cloudEnabled || !cloudReady) return;
    setCloudState('saving');
    const id = window.setTimeout(() => {
      saveCloudSite(data)
        .then(() => setCloudState('saved'))
        .catch(() => setCloudState('error'));
    }, 1800);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, cloudReady]);

  const cloudLabel = !cloudReady
    ? '云端读取失败，先不写入'
    : cloudState === 'saving'
      ? '正在保存到云端…'
      : cloudState === 'saved'
        ? '已保存到云端'
        : cloudState === 'error'
          ? '云端保存失败，检查网络或配置'
          : '云端同步已开启';

  return (
    <div className="editor">
      <div className="container">
        <div className="editor-head">
          <div>
            <h1 className="editor-title">写点什么</h1>
            <p className="editor-sub">
              {cloudEnabled
                ? '这里改的内容会直接保存到云端，你和 TA 在任何设备上都能看到、都能继续写。'
                : '还没有配置云端：改动只存在你这台设备的浏览器里。写完点「导出 JSON」，覆盖项目里的 src/data/sample.json 再重新部署，就能永久保存。'}
            </p>
          </div>
          <div className="editor-actions">
            <a className="btn" href="#/">
              <ArrowLeft /> 回到首页
            </a>
            <button
              className="btn"
              onClick={() => {
                downloadJson(data, 'site.json');
                onToast('已导出 site.json');
              }}
            >
              <Download /> 导出 JSON
            </button>
            <button className="btn" onClick={() => importRef.current?.click()}>
              <Upload /> 导入 JSON
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const parsed = JSON.parse(await f.text()) as SiteData;
                  if (!parsed.couple || !Array.isArray(parsed.milestones)) throw new Error('格式不对');
                  onChange(parsed);
                  onToast('导入成功');
                } catch {
                  onToast('这个文件好像不是导出的 JSON');
                }
              }}
            />
            <button
              className="btn btn-danger"
              onClick={() => {
                if (!window.confirm('恢复成示例内容？你本机存的修改会被清掉。')) return;
                localStorage.removeItem('our-story:data:v1');
                onChange(JSON.parse(JSON.stringify(SAMPLE)) as SiteData);
                onToast('已恢复示例内容');
              }}
            >
              <Trash /> 恢复示例
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">
              {cloudEnabled ? '云端同步' : '本机存储'}{' '}
              <small>{cloudEnabled ? cloudLabel : hasSaved() ? '正在自动保存' : '尚未保存'}</small>
            </h2>
            {cloudEnabled ? (
              <span className="hint">照片会上传到云端，不占本机空间</span>
            ) : (
              <span className="hint">{(bytes / 1024).toFixed(0)} KB / 约 5 MB</span>
            )}
          </div>
          {!cloudEnabled && (
            <>
              <div className="storage-bar">
                <i style={{ width: `${pct}%` }} />
              </div>
              <p className="hint">
                照片以压缩后的形式存进来，占空间很快。照片多的话，建议把图片放到项目的 <code>public/photos/</code>{' '}
                目录，然后这里用「图片链接」填 <code>photos/xxx.jpg</code>，这样存储占用几乎为 0。
              </p>
            </>
          )}
          {cloudEnabled && (
            <p className="hint">
              每次改动停手 1.8 秒会自动写到云端；手机和电脑打开同一个网址，看到的内容是一样的。
            </p>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">基本信息</h2>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>男生称呼</label>
              <input value={couple.boy} onChange={(e) => patchCouple({ boy: e.target.value })} />
            </div>
            <div className="field">
              <label>女生称呼</label>
              <input value={couple.girl} onChange={(e) => patchCouple({ girl: e.target.value })} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>男生签名</label>
              <input value={couple.boyTag ?? ''} onChange={(e) => patchCouple({ boyTag: e.target.value })} />
            </div>
            <div className="field">
              <label>女生签名</label>
              <input value={couple.girlTag ?? ''} onChange={(e) => patchCouple({ girlTag: e.target.value })} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>在一起的日子</label>
              <input type="date" value={couple.startDate} onChange={(e) => patchCouple({ startDate: e.target.value })} />
            </div>
            <div className="field">
              <label>大标题里高亮的词</label>
              <input
                value={couple.titleHighlight ?? ''}
                placeholder="例如：小宇宙"
                onChange={(e) => patchCouple({ titleHighlight: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>大标题</label>
            <input value={couple.title} onChange={(e) => patchCouple({ title: e.target.value })} />
          </div>
          <div className="field">
            <label>标题下的一句话</label>
            <textarea value={couple.subtitle} onChange={(e) => patchCouple({ subtitle: e.target.value })} />
          </div>
          <div className="field">
            <label>页脚的一句话</label>
            <input value={couple.motto ?? ''} onChange={(e) => patchCouple({ motto: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>男生头像</label>
              <Thumbs
                photos={couple.boyAvatar ? [couple.boyAvatar] : []}
                onChange={(next) => patchCouple({ boyAvatar: next[0] ?? '' })}
              />
            </div>
            <div className="field">
              <label>女生头像</label>
              <Thumbs
                photos={couple.girlAvatar ? [couple.girlAvatar] : []}
                onChange={(next) => patchCouple({ girlAvatar: next[0] ?? '' })}
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">
              点点滴滴 <small>{milestones.length} 条</small>
            </h2>
            <button className="btn btn-primary btn-mini" onClick={addMilestone}>
              <Plus /> 添加
            </button>
          </div>
          <div className="me-row">
            <span>我是</span>
            <AuthorPills value={me ?? undefined} boy={couple.boy} girl={couple.girl} onChange={(v) => setMe(v ?? null)} />
            <span>新建的记录会默认记在 TA 名下</span>
          </div>
          {milestones.map((m, i) => (
            <div className="editor-item" key={m.id}>
              <div className="editor-item-head">
                <span className="grow">{m.title || '未命名'}</span>
                <time>{m.date}</time>
                <button
                  className="icon-btn"
                  title="上移"
                  onClick={() => patch({ milestones: move(milestones, i, -1) })}
                >
                  <ArrowUp />
                </button>
                <button
                  className="icon-btn"
                  title="下移"
                  onClick={() => patch({ milestones: move(milestones, i, 1) })}
                >
                  <ArrowDown />
                </button>
                <button
                  className="icon-btn"
                  title="删除"
                  onClick={() => {
                    if (window.confirm(`删除「${m.title}」？`)) {
                      patch({ milestones: milestones.filter((x) => x.id !== m.id) });
                    }
                  }}
                >
                  <Trash />
                </button>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>日期</label>
                  <input type="date" value={m.date} onChange={(e) => setMilestone(m.id, { date: e.target.value })} />
                </div>
                <div className="field">
                  <label>标题</label>
                  <input value={m.title} onChange={(e) => setMilestone(m.id, { title: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>想说的话</label>
                <textarea value={m.text} onChange={(e) => setMilestone(m.id, { text: e.target.value })} />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>标签</label>
                  <input
                    value={m.tag ?? ''}
                    placeholder="初见 / 旅行 / 日常"
                    onChange={(e) => setMilestone(m.id, { tag: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>谁写的（前端会显示 @名字）</label>
                  <AuthorPills
                    value={m.author}
                    boy={couple.boy}
                    girl={couple.girl}
                    onChange={(next) => setMilestone(m.id, { author: next })}
                  />
                </div>
              </div>
              <div className="field">
                <label>照片</label>
                <Thumbs photos={m.photos ?? []} onChange={(next) => setMilestone(m.id, { photos: next })} />
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">
              相册 <small>{gallery.length} 张</small>
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-mini" onClick={() => pickGallery.current?.click()}>
                <Upload /> 上传照片
              </button>
            </div>
            <input
              ref={pickGallery}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={async (e) => {
                const files = e.target.files;
                try {
                  const urls = await filesToUrls(files);
                  if (urls.length) addGallery(urls);
                } catch (err) {
                  window.alert('照片上传失败：' + (err instanceof Error ? err.message : String(err)));
                }
                e.target.value = '';
              }}
            />
          </div>
          <div className="grid-2">
            {gallery.map((g) => (
              <div className="editor-item" key={g.id}>
                <div className="editor-item-head">
                  <span className="grow">
                    <img
                      src={photoUrl(g.src)}
                      alt=""
                      style={{ width: 46, height: 34, objectFit: 'cover', borderRadius: 6, display: 'inline-block', verticalAlign: 'middle' }}
                    />
                  </span>
                  <button
                    className="icon-btn"
                    title="删除"
                    onClick={() => patch({ gallery: gallery.filter((x) => x.id !== g.id) })}
                  >
                    <Trash />
                  </button>
                </div>
                <div className="field">
                  <label>说明文字</label>
                  <input
                    value={g.caption ?? ''}
                    onChange={(e) =>
                      patch({ gallery: gallery.map((x) => (x.id === g.id ? { ...x, caption: e.target.value } : x)) })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">
              纪念日 <small>{anniversaries.length} 个</small>
            </h2>
            <button className="btn btn-primary btn-mini" onClick={addAnniversary}>
              <Plus /> 添加
            </button>
          </div>
          {anniversaries.map((a) => (
            <div className="editor-item" key={a.id}>
              <div className="grid-3">
                <div className="field">
                  <label>日期</label>
                  <input
                    type="date"
                    value={a.date}
                    onChange={(e) =>
                      patch({
                        anniversaries: anniversaries.map((x) => (x.id === a.id ? { ...x, date: e.target.value } : x)),
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>名称</label>
                  <input
                    value={a.title}
                    onChange={(e) =>
                      patch({
                        anniversaries: anniversaries.map((x) => (x.id === a.id ? { ...x, title: e.target.value } : x)),
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>图标（一个 emoji）</label>
                  <input
                    value={a.icon}
                    onChange={(e) =>
                      patch({
                        anniversaries: anniversaries.map((x) => (x.id === a.id ? { ...x, icon: e.target.value } : x)),
                      })
                    }
                  />
                </div>
              </div>
              <div className="field">
                <label>备注</label>
                <input
                  value={a.note ?? ''}
                  onChange={(e) =>
                    patch({
                      anniversaries: anniversaries.map((x) => (x.id === a.id ? { ...x, note: e.target.value } : x)),
                    })
                  }
                />
              </div>
              <button
                className="btn btn-mini btn-danger"
                onClick={() => patch({ anniversaries: anniversaries.filter((x) => x.id !== a.id) })}
              >
                删除这个纪念日
              </button>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2 className="panel-title">
              情话 <small>一行一句，首页会轮播</small>
            </h2>
          </div>
          <div className="field">
            <textarea
              style={{ minHeight: 120 }}
              value={quotes.join('\n')}
              onChange={(e) => patch({ quotes: e.target.value.split('\n').filter((s) => s.trim()) })}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={async () => {
                if (cloudEnabled) {
                  if (!cloudReady) {
                    onToast('云端数据没读成功，先不写入');
                    return;
                  }
                  try {
                    await saveCloudSite(data);
                    setCloudState('saved');
                    onToast('已保存到云端');
                  } catch {
                    setCloudState('error');
                    onToast('保存失败，检查网络或云端配置');
                  }
                } else {
                  saveData(data);
                  onToast('已保存到本机浏览器');
                }
              }}
            >
              {cloudEnabled ? '立即保存到云端' : '保存到本机'}
            </button>
            <span className="hint" style={{ alignSelf: 'center' }}>
              {cloudEnabled ? '平时不用点，改完会自动同步；这一步是手动确认一次。' : '平时不用点，改动会自动保存；这一步只是给你个确认。'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
