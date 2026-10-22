# 版本与发布

## 分支约定

| 分支 | 内容 | 谁在改 |
|---|---|---|
| `main` | 源码（React + 内容 JSON） | 我（改功能/文案后提交） |
| `gh-pages` | 构建产物（`dist/` 的镜像） | 发布脚本自动覆盖，不要手动改 |

线上地址：<https://yzz929.github.io/our-story/>
仓库：<https://github.com/Yzz929/our-story>

## 版本号怎么走

`主版本.次版本.修订号`，例如 `v1.0.0` → 修 bug 变 `v1.0.1` → 加新功能变 `v1.1.0` → 大改版 `v2.0.0`。

当前版本记录在：

- `package.json` 的 `version`
- `CHANGELOG.md` 顶部
- GitHub 的 tag 和 Release

## 发一版新版本

```powershell
# 1) 改完内容后，先确认能构建
npm run build

# 2) 一键发版（自动改版本号、写 CHANGELOG、提交、打 tag、推送、发 Pages、建 Release）
$env:GH_TOKEN="ghp_xxx"
node scripts/release.mjs 1.0.1 "修复手机上时间轴圆点遮挡"

# 3) 用完删掉环境变量里的 token
Remove-Item Env:\GH_TOKEN
```

脚本会依次做：

1. 检查工作区干净、跑 `tsc` + `vite build`
2. 改 `package.json` 版本号、往 `CHANGELOG.md` 顶部插入这一版的条目
3. `git commit` → `git tag v1.0.1` → 推送 `main` 和 tag
4. 把 `dist/` 发布到 `gh-pages`（走 GitHub API，不依赖 git 通道）
5. 用 `CHANGELOG.md` 里这一版的内容创建 GitHub Release

## 回滚

想回到某一版，直接看 tag：

```powershell
git fetch --tags
git checkout v1.0.0          # 看代码
git checkout main            # 回到主线
```

只想让线上回到旧版（不改本地代码）：

```powershell
git checkout v1.0.0
npm run build
$env:GH_TOKEN="ghp_xxx"
node scripts/deploy-api.mjs
git checkout main
```

## 只有内容更新（加回忆、换照片、加歌）

这类改动不用重新发版、也不用重新部署——直接在网站编辑页改，内容存在 Supabase 云端，立刻生效。

## 需要重新部署的情况

- 改了代码/样式（我改）
- 换了 `background_music/` 里的歌
- 改了 `public/photos/` 里的占位图
