# Contributor Albums V1 · 本地更新

最新目录结构为“专辑 → 发行版本”：先创建专辑，再在专辑内添加版本，具体封面、曲目、音源和发行资料均在版本内录入。一级目录使用第一个版本的封面，各版本可调整顺序。详见 [两级目录说明](docs/edition-hierarchy-v1.md)，本要求覆盖下方早期的单页编辑流程。

最新更新：移除原文标题、别名输入框；“图片与媒体”改为“添加封面”，新增“添加音源”。支持整轨专辑文件、按曲目多选新增或关联已有歌曲；FLAC / PCM WAV / AIFF / ALAC 实际私有上传，每个文件最多 4 GB，显示规格与进度。详见 [音源使用说明](docs/contributor-audio-v1.md)，覆盖下面早期“音频仅元数据”的限制。六张封面/歌词纸图片限制保留。

图片更新：编辑器的“图片与媒体”支持多选上传封面、歌词纸和内页，每张唱片合计最多 6 张，每张 ≤10 MB。上传会同步保存当前草稿，支持替换和移除后补传；默认私人，仍需审核后才可公开。

已接通专辑新增/编辑、五分区表单、SQLite 草稿、曲目/多个版本、私有图片、修订、预览与本机审核。**本次没有部署公网。**

```sh
cd '/Users/xiaowenli/Projects/naoko-archive'
npm run dev:admin
```

启动后打开 http://127.0.0.1:3000/contributor 。普通编辑运行 `npm run dev`；本机审核模式才能批准/退回。需要 Node.js 24+。数据保存在 `data/archive.sqlite` 与 `data/private-media/`，重启保留，不进入 public 或代码仓库。生产模式禁用编辑与私有 API，公开目录保留原默认资料。

详见 [本地使用与验收说明](docs/contributor-albums-v1.md)。音频仅登记元数据，未接云存储或真实身份认证。封面、`/archive`、黑色介绍区、写真/影像内容保留。

---

# 移动端更新

≤768px 使用秋日湖畔裁切图 `public/cover-mobile.jpg`（1800×1595，约 0.41 MB），照片与文字上下分区。黑色介绍区改为单列。桌面样式与图片保留；构建、桌面样式保持检查和各手机比例的照片裁切检查通过。完整页面浏览器验收受控制中断影响，尚未完成；详见 `docs/mobile-responsive-status.json`。

# 8K 封面更新

当前开屏使用 `cover2.png` 的 WebP 副本：桌面 7680×4320（约 1.31 MB），手机 3840×2160（约 0.46 MB）。原始 PNG 不变，处理记录见 `docs/cover-processing.json`。

# V1.4 更新

首页新增独立黑色中英双语社区介绍区，可自然滚动浏览；新增 `/about#contribute` 真实说明。保留 3840×2155 保真优化封面。构建与内容链接检查通过，完整响应式视觉验收因浏览器控制中断而未完成，见 `docs/qa-v1.4.json`。

# NAOKO ARCHIVE · 河合奈保子数字档案馆

V1.1 本地网站原型。使用 Next.js App Router、TypeScript、React、lucide-react 和本地打包的 Cormorant Garamond 字体。以暖纸白、墨绿、宋体和原创几何封面呈现唱片档案。项目原始需求保存在 `PROJECT_BRIEF.md`。本副本位于用户主目录的 Projects 下，用于避开桌面目录的应用访问限制；桌面原项目保持不变。

## 在 macOS / zsh 中运行

需要 Node.js 24 或更新版本（本地 SQLite 使用 Node 内置模块）。

```sh
cd '/Users/xiaowenli/Projects/naoko-archive'
npm install
npm run dev
```

打开 **http://127.0.0.1:3000**。停止服务可在终端按 `Control-C`。若 3000 已被占用，可用 `npm run dev -- --port 3001`，访问终端打印的地址。

生产构建与本地运行：

```sh
npm run typecheck
npm run build
npm run start
```

安装依赖需要网络。安装完成后，UI、图片、字体和本地搜索都不依赖外部服务；官方资料链接需要联网。当前没有云服务、真实账户或公网登录；Contributor V1 已增加本地 SQLite。

## 页面与交互

| 路由 | 内容 |
| --- | --- |
| `/` | 指定照片、暖色左侧渐变、唯一英文标题与 ENTER |
| `/archive` | Editorial Index 纯排版目录：The Collection. 与四个分类入口；桌面非对称双栏、手机单列 |
| `/discography` | 6 条唱片记录，中日文/年份搜索、年份与类型组合筛选、网格/列表、空状态 |
| `/discography/[slug]` | 发行资料、曲目、版本整理状态、官方来源及相关作品 |
| `/photobooks` | 写真集/杂志/歌词册分类，明确标注演示占位 |
| `/photobooks/[slug]` | 原始比例图库、缩略图、前后翻页、大图、方向键与 Esc |
| `/videos` | 电视节目/演唱会/采访分类，明确标注演示占位 |
| `/videos/[slug]` | 16:9 静态占位、待整理状态、节目资料字段 |
| `/timeline` | 1980、1983、1984、1986、1987 年代节选与来源 |
| `/about` | 非官方声明、资料方法、版权说明与更正方法 |

所有内部页包含可展开的手机菜单和全站搜索。搜索弹窗与大图阅读器使用原生 `dialog`，支持键盘焦点约束、Esc 关闭和关闭后的焦点恢复。交互有明确焦点样式，动效遵循 `prefers-reduced-motion`。不存在空链接或伪造的播放/下载按钮。

## 资料来源与样本范围

- [日本哥伦比亚 · 河合奈保子全曲目录](https://columbia.jp/kawai/list.html)：初次发行日期、日文标题与曲序。整理日期：2026-10-20。
- [日本哥伦比亚 · 发行信息](https://columbia.jp/kawainaoko/release.html)：作为官方发行及正版渠道的查询入口；本站没有虚构具体商品链接。
- 5 张专辑：《あるばむ》（1983-01-21）、《SKY PARK》（1983-06-01）、《DAYDREAM COAST》（1984-08-28）、《Scarlet》（1986-10-21）、《JAPAN as waterscapes》（1987-06-24）。
- 1 张单曲：《ハーフムーン・セレナーデ》（1986-11-02）。
- 中文名称均为辅助译名，不声称是官方译名。未知唱片编号、时长、ISBN、出版社与媒体日期用 `null`、待考证或 `—` 表示。JAPAN 的两首 CD 专属器乐曲已在曲名中注明。
- 写真与视频记录均为原创演示条目，不对应真实出版物、节目、演出或采访。没有真实音视频文件。

## 图片与权利边界

`public/cover.jpg` 从用户提供的上一级 `cover.jpg` 原样复制。源文件未修改，网页仅引用 `/cover.jpg`。该照片仅用于本地原型，未来公网发布前需确认公开使用授权。

`public/placeholders/*.svg` 是为本项目制作的原创几何/排版视觉：6 张唱片封面、3 页印刷物和2张影像静态图。它们均非历史原版素材，页面已注明。

`src/lib/types.ts` 预留 `ArchiveMedia`、`RightsStatus`、`ReleaseType`、`MediaType`，每条记录带 `sourceUrl?`、`sourceLabel?`、`isDemo`。音源为 `metadata-only`；原创演示页可为 `licensed-public`。以后提供媒体时，仅明确获得公开授权的文件用于公开在线播放/下载。当前不包含授权校验后端。

## 目录结构

```text
public/
  cover.jpg                 用户提供的开屏照片
  placeholders/             原创 SVG 视觉
src/
  app/
    layout.tsx              基础布局、字体与全局样式
    page.tsx                独立开屏，不含站点页眉页脚
    globals.css             颜色 Token、开屏与主页
    chrome.css              页眉、页脚与全站搜索
    catalog.css             各目录、详情、图库与时间线
    (site)/                 内部页共享 Header / Footer
  components/               导航、搜索、筛选浏览器和图库
  data/                     唱片、印刷物、影像与时间线数据
  lib/                      类型与搜索匹配
docs/
  screenshots/              浏览器检查截图
  qa-results.json           页面与资源链接检查结果
```

## 下一版优先事项

1. 核实原版与复刻唱片编号、载体、版本差异及音轨时长，增加逐字段来源。
2. 在确认授权后补充真实封面、印刷物与公开媒体，替换演示图并保留来源和权利状态。
3. 扩充完整目录与年代记录，为资料增加修订日志和可靠的更正入口。

## 验证

执行 TypeScript 检查与生产构建；浏览器重点检查 1440×900、1024×768、390×844 的开屏及主页，验证目录搜索/筛选/视图切换、全站搜索、手机菜单、写真翻页和大图键盘操作。具体本次检查结果见 `docs/qa-results.json`。

## Editorial Index 排版阶段

`/archive` 仅使用文字、编号、细线与箭头；分类仍连接到现有目录。样式限定在 `src/app/archive-index.css`，照片开屏、黑色介绍区与其他目录未改动。通过生产构建，以及 360×800、390×844、430×932、768×1024、1024×768、1440×900 的浏览器布局检查；四个入口均已点击检查。截图与检查记录见 `docs/archive-index-qa.json`。用户确认排版前不添加图片或新模块。
