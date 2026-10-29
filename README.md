# 我们的小宇宙 · Our Story

给两个人做的回忆时间轴网页：首页是双人卡片和实时天数计时，往下是「点点滴滴」时间轴、照片墙、纪念日倒计时和情话轮播。支持深浅两套主题，手机上也是整套设计。

内容全部放在一个 JSON 里，另外自带一个网页版编辑器（`#/edit`），不用改代码就能加节点、传照片、写文字。

## 本地跑起来

```bash
npm install
npm run dev
```

打开终端里给出的地址（默认 <http://localhost:5173>）。手机想预览的话，用 `--host` 已经在脚本里开了，同一 Wi-Fi 下用电脑的局域网 IP 访问即可。

## 怎么加内容（三种方式，任选）

### 0）先在手机上自己写（需要配一次云端）

配好云端之后，手机浏览器打开站点 → 右上角铅笔 → 直接加回忆：选日期、打字、选照片，改完自动保存，电脑和她的手机打开同一个网址都能看到。

配一次，5 分钟：

1. 打开 <https://supabase.com>，用 GitHub 登录，New project（Region 选 Singapore，密码随便设一个记住）
2. 进 SQL Editor，把 [`supabase/setup.sql`](supabase/setup.sql) 整段粘进去执行
3. Project Settings → API，复制 **Project URL** 和 **anon public** 两个值
4. 填进 [`src/data/cloud-config.json`](src/data/cloud-config.json)：

   ```json
   {
     "url": "https://xxxx.supabase.co",
     "anonKey": "eyJhbGciOi...",
     "table": "site",
     "bucket": "photos"
   }
   ```

   （也可以写进 `.env` 的 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，会覆盖这个文件）

   `anonKey` 填两种都行：旧版 anon JWT（`eyJ...`）或新版 Publishable key（`sb_publishable_...`）。

5. `npm run build` 重新构建、部署。之后手机和电脑都能写了。

第一次部署时，云端 `site` 表还是空的，站点会先显示仓库里的 `sample.json`；你在编辑页随便改一个字并保存，内容就写进云端了。也可以直接跑 `node scripts/seed-cloud.mjs` 把 `sample.json` 播种上去。

> 这个配置文件是提交进仓库的：anon key 本来就是公开 key，放在前端是 Supabase 的标准用法。**不要**把 `service_role` / `secret` key 填进来。

### 1）网页编辑器（不配云端也能用）

打开站点右上角的铅笔图标，或者直接访问 `#/edit`：

- 改名字、在一起的日子、大标题、签名、头像
- 增删改「点点滴滴」：日期、标题、正文、标签、照片
- 管相册（上传照片或填图片链接）
- 管纪念日、改情话
- 写完点「导出 JSON」，下载到的 `site.json`

改动会先存在你**自己浏览器**里（localStorage），不会上传。要永久保存，把导出的 `site.json` 内容覆盖到 `src/data/sample.json`，并在里面把 `version` +1，然后重新构建部署。

> 照片直接上传会以 base64 塞进 JSON，占空间大。照片多的话，把图片文件放到 `public/photos/`，编辑器里用「图片链接」填 `photos/xxx.jpg`。

### 2）直接改 JSON

编辑 `src/data/sample.json`：

```json
{
  "version": 1,
  "couple": { "boy": "阿远", "girl": "小雨", "startDate": "2026-07-15", "...": "..." },
  "milestones": [
    { "id": "m1", "date": "2026-07-15", "title": "第一次见面", "text": "……", "tag": "初见", "author": "boy", "photos": ["photos/p1.svg"] }
  ],
  "anniversaries": [ { "id": "a1", "date": "2026-07-15", "title": "在一起纪念日", "icon": "💞", "note": "……" } ],
  "gallery": [ { "id": "g1", "src": "photos/p1.svg", "caption": "那天" } ],
  "quotes": ["……"]
}
```

- `date` 一律 `YYYY-MM-DD`
- `author` 是「谁写的」：`"boy"` 显示 @男方名字，`"girl"` 显示 @女方名字，不填就不显示
- 图片路径写 `photos/xxx.jpg`，对应的文件放在 `public/photos/`
- 改了内容记得把 `version` 加 1（否则浏览器里存的旧数据会盖住新内容）

**会自己变的天数标题**：`couple.titleTemplate` 支持占位符，`{days}` 是阿拉伯数字、`{cn}` 是中文数字：

```json
"titleTemplate": "我们的{cn}天"   // → 我们的一百六十四天
```

每天打开都会自动变成「一百六十五天」，不用手动改。

**农历生日**：纪念日支持农历，填 `lunar` 和预先算好的 `solarByYear`（年份 → 当年阳历日期）：

```json
{ "title": "她的生日", "icon": "🎂", "lunar": "八月初八",
  "solarByYear": { "2026": "2026-03-04", "2027": "2027-02-21", "...": "..." } }
```

`scripts/lunar-table.mjs` 会把农历月日换算成未来 25 年的阳历日期，改生日时改那个脚本里的月/日跑一遍，把输出贴进 JSON 就行（运行时不需要农历库）。

### 3）照片

把照片放进 `public/photos/`，支持 jpg / png / webp / svg。现在的 8 张 `p1.svg ~ p8.svg` 是占位图（柔焦渐变），可以直接删掉换成真照片，路径对上就行。

## 背景音乐

把音频文件放进项目根目录的 `background_music/`，然后 `npm run build`（`prebuild` 会自动跑 `scripts/sync-music.mjs`）：

- 支持 `mp3 / m4a / aac / ogg / wav / flac`
- 复制到 `public/music/`，并生成 `src/data/music.json` 曲目清单
- 进入站点后**随机播放**，一轮放完再重洗；右下角圆形按钮点一下静音，再点恢复，静音状态会记住
- 播放是在「点进去看看」的同一个手势里启动的，所以 iOS Safari 也能直接出声

> ⚠️ 网易云的 `.ncm` 是加密缓存格式，浏览器放不了，需要先转成 mp3/flac 再放进来（脚本会跳过并提示）。
> 建议用 **mp3 192kbps**，一首约 5–7MB；flac 一首 30MB 左右，手机上很费流量。
> 源码 `background_music/_源文件/` 和不压缩的 flac 不会提交进仓库。

## 构建与部署

```bash
npm run build     # 产物在 dist/
npm run preview   # 本地预览构建结果
```

想先在手机上试（同一个 Wi-Fi）：

```bash
node scripts/serve.mjs dist 5188 0.0.0.0
# 手机浏览器打开 http://<电脑的局域网IP>:5188/
```

如果手机打不开，多半是 Windows 防火墙拦了 Node，去「Windows 安全中心 → 防火墙和网络保护 → 允许应用通过防火墙」里给 Node.js 放行，或者直接部署到下面任意一个平台。

`dist/` 就是纯静态站点，没有后端，可以放到任何地方：

- **GitHub Pages**：已经部署在 <https://yzz929.github.io/our-story/>。发布方式是「把 `dist/` 推到 `gh-pages` 分支」：

  ```bash
  npm run build
  $env:GH_TOKEN="ghp_xxx"     # 有 repo 权限的 classic token
  node scripts/deploy-pages.mjs
  ```

  Pages 设置：仓库 Settings → Pages → Source 选 **Deploy from a branch**，分支 `gh-pages`、目录 `/`。

  想改成「push 代码自动构建」，需要给 token 加 `workflow` 权限，然后把 `deploy/pages-workflow.yml.example` 放回 `.github/workflows/deploy.yml`，并在 Settings → Pages 把 Source 切成 **GitHub Actions**。

- **Vercel / Netlify**：把仓库连上去，构建命令 `npm run build`，输出目录 `dist`。
- **自己的服务器 / 对象存储**：把 `dist/` 整个丢上去就行（用的是相对路径，放在子目录也能跑）。

## 目录结构

```
src/
├─ App.tsx              页面骨架 + 路由
├─ styles.css           全部样式（配色变量、深浅主题、响应式）
├─ components/
│  ├─ Hero.tsx          首页：双人卡片、天数计时、三个小数字
│  ├─ Timeline.tsx      点点滴滴时间轴
│  ├─ Gallery.tsx       照片墙 + 大图查看
│  ├─ Anniversaries.tsx 纪念日倒计时
│  ├─ Quote.tsx         情话轮播
│  ├─ Nav.tsx / Footer.tsx
│  └─ Editor.tsx        #/edit 编辑器
├─ data/
│  ├─ sample.json       ← 内容都在这里
│  ├─ store.ts          读取 / 保存 / 导入导出
│  └─ types.ts          数据结构
├─ lib/date.ts          天数、星期、下一次纪念日
└─ hooks.ts             主题、计时、滚动出现、hash 路由
public/photos/          照片
scripts/                占位图生成、本地预览服务、截图工具
```

## 想改配色

打开 `src/styles.css` 顶部的 `:root[data-theme="light"]` 和 `dark` 两块，改 `--rose`（主色）、`--bg`（背景）、`--ink`（文字）即可，其余颜色都从这几个变量派生。

## 说明

- 默认内容是我写的示例（阿远 / 小雨 / 2026-07-15），记得换成你们自己的。
- 天数、第几天、纪念日倒计时都是访问时实时算的，不需要手动维护。
- 没有后端、没有第三方请求，部署后整站只依赖自己域名下的静态文件。
