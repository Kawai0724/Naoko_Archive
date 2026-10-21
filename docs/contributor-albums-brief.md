agent.md — Naoko Kawai's Archive / Contributor Album Editor
任务版本：Contributor Albums V1 · 2026-10-21
适用项目：河合奈保子中文数字档案馆
目标：在现有网站中实现真正可编辑、可保存的唱片资料管理界面。优先完成新增、编辑、曲目与发行版本管理，以及公开页面的资料展示。
这是 专项执行说明，不是要求从零重建网站；既有 AGENTS.md、agent1.md 的开屏和视觉规范继续有效。

0. 执行原则（先读）
1. 请检查现有 Next.js 项目后直接修改代码，不要只返回设计方案。 识别已有 App Router、UI 组件、专辑数据和路由，增量实现；不要重建项目或覆盖已有内容。
2. 只修改 Contributor 的唱片管理及为其必要的专辑展示/数据层。 不动照片开屏 /、ENTER、/archive 排版、黑色 About 页、写真馆和影像馆。
3. 第一版本地运行，不接腾讯云 COS、CDN、在线账户、域名、付款和公网部署。为以后接云存储和真实贡献者登录预留数据结构，但不制造已经上线的错觉。
4. 目标不是一个标准 SaaS 管理后台。采用网站既有的 European Editorial Archive 风格：米白底、深色文字、优雅衬线标题、准确的对齐、细分割线和有节奏的留白。先做好排版，后添加真实图片。
5. 数据不能凭空编造。没有来源的作词、作曲、编曲、歌词、唱片编号、发行日期一律保持空值；不要为了表单好看写假的内容。
6. 所有新增字段允许为空。新增专辑的草稿甚至可以不完整；正式提交时至少需要专辑标题和艺人。若已添加曲目，则各条曲目必须有名称。不要把作词/作曲/编曲/歌词作为提交门槛。
7. CONTRIBUTOR 初始本地署名为 fly-me-to-1980，建站时间 2026.10（属于全站信息；不必在每个输入框反复出现）。保留未来支持多位贡献者的能力。
8. 完整商业音源、未经许可的完整歌词、写真扫描或电视录像不得因编辑器上传而自动进入公开目录。本地可管理私人文件的元信息，公开页面仅显示有权发布的资源。
9. 本专项说明在 Contributor 专辑编辑功能范围内优先于主 AGENTS.md 早期的“V1 不做后台/数据库”限制；其他网页与整体视觉规范仍按主文件执行。
1. 产品设计参考与取舍
参考产品的信息架构而非复制页面：
- Discogs：Catalog Number、Label、Format、版本差异、Credits、图片资料、编辑版本。
- MusicBrainz：Album/Release Group 与实际发行版（Release）分离；新增和修正资料采用分步骤工作流。
- VGMdb：音轨级别的人员署名、CD/LP 附带图及资料来源记录。
本网站聚焦一位艺人，不需要复制这些数据库冗长且高门槛的表单。贡献者应当可以先记录一张已知专辑，日后慢慢补全曲目和版本。
数据原则：专辑 ≠ 发行版本
- Album（专辑/作品）：共享的名称、艺人、类型、简介、核心曲目表。
- Edition / Release（发行版本）：具体某一张 CD、LP、磁带、数字版，拥有自己的唱片编号、厂牌、发行日期、地区与封面等。
- Track（曲目）：归属于专辑核心曲目表；某个版本可能有特别曲目、bonus track 或不同排序，数据结构需要能够扩展，不要把所有版本都强制绑定成不可变的相同曲目表。
- Credits（人员）：歌曲级别的作词/作曲/编曲允许多人。
- Media（资源）：文件、规格、来源、权利状态独立记录，不与页面文本强耦合。
2. 路由与入口
在保留已有 /discography 和 /discography/[slug] 的前提下，新增或完善：
路由	用途
/contributor	贡献者工作台，简洁入口，不需要统计图表
/contributor/albums	可搜索的专辑清单，查看编辑状态、最近修改
/contributor/albums/new	新建专辑，使用统一编辑器
/contributor/albums/[id]/edit	编辑已有专辑，同一个编辑器组件
/contributor/albums/[id]/preview	预览正式展示效果，不直接发布
/contributor/submissions	草稿、待审核、已发布的记录与状态


入口安排：
- /archive 或非开屏 Header 中提供低调的 Contributor / 参与共建 链接，不要占据主视觉位置。
- /discography 页面提供可发现的 补充或更正资料 入口。
- /discography/[slug] 详情页末尾提供 补充 / 纠正这张唱片的信息，进入相应编辑/建议入口。
- Contributor 工作台上方显示清晰的 返回档案馆。
- 新增专辑 与 编辑专辑 共用表单组件，避免两套功能分叉。
- 在尚未实现真实用户注册与身份验证时，Contributor 功能只供本机开发环境使用；不要仅靠隐藏按钮或前端“角色切换”假装实现权限控制。生产部署前必须真正加入服务端鉴权与审核。
3. Contributor 工作台视觉与布局
3.1 专辑管理页 /contributor/albums
- 页首小标签 CONTRIBUTOR / COLLECTION MANAGEMENT。
- 大标题 Albums，下方小字 唱片资料管理，右上角 ＋ 新增专辑。
- 一条紧凑的搜索栏，可根据中文/日文专辑名、年份、厂牌、编号搜索。
- 主体优先使用整洁的行式目录，不是密密麻麻的卡片和封面网格：唱片名 | 年份 | 类型 | 版本数 | 状态 | 更新日期 | 编辑。
- 无封面时不留巨大的空白卡片；列表可不显示图片，或只显示 36–48px 的小缩略图。
- 状态必须有可读文字：草稿 / 待审核 / 已发布。无记录时显示明确的空状态与“新增专辑”入口。
3.2 专辑编辑器（重点）
桌面建议两栏：
- 左 / 主编辑区（约 68–72%）：页内 Tab/分段表单；让贡献者集中填写信息。
- 右 / 辅助信息区（约 28–32%）：仅包含“当前记录状态、保存时间、资料完整度、预览入口、提交前检查项”，如影响布局可改成窄侧栏；不要放 KPI 仪表盘。
- 页面顶部：返回链接 / 编辑专辑 标题 / 保存状态提示 / 保存草稿、预览、提交审核。
- 明确标注 * 仅针对提交必须满足的字段；可选项统一用柔和说明，不用满屏“选填”徽章。
- 输入框清晰、字号合适，所有字段有真实 label。表单不使用厚重卡片阴影。
移动端（360–430px）：
- 单列布局，侧栏内容移至主要表单后或顶部摘要区。
- Tab 可水平滚动或使用可访问的分段导航，不能挤得难以点击。
- 曲目编辑卡默认折叠，每行优先展示曲序、曲名、编辑箭头。
- 保存和提交操作可以采用底部操作区，但不得遮挡输入框和手机键盘。
沿用既有配色 token（如 --paper, --ink, --line），保留欧美编辑式标题风格；不新建一套与公开网站冲突的设计系统。
4. 编辑器分为五部分
Tab 1 — 基本信息 / Overview
字段	类型	规则
专辑标题 title	单行文本	提交必填；草稿可空
原文标题 originalTitle	单行文本	可选，日文原文保留
中文译名 translatedTitle	单行文本	可选，不擅自翻译
艺人 artist	文本 / 未来关联艺人	默认 河合奈保子；提交必填
作品类型 type	Album / Single / EP / Compilation / Live / Other	可选，默认 Album
首次发行日期 firstReleaseDate	允许仅填写年份、年月或完整日期	可选；不推断未知日月
简介 description	多行文本	可选，支持简单 Markdown 或纯文本
别名 aliases	多值字符串	可选
编辑备注 editorNotes	多行文本	可选，不展示给公众


日期字段不要强迫填满 YYYY-MM-DD。建议使用 dateText + precision（year / month / day），或其他能真实表达“只知道年份”的结构。
Tab 2 — 曲目 / Tracklist
每条曲目必须可折叠编辑，默认只显示：曲序、歌曲名、时长（如有）。

单首曲目字段：
字段	规则
position 曲序	自动编号，可调整；支持 A1/B1 等黑胶曲序文本
title 日文原曲名	添加了曲目后，提交时该曲目必填
translatedTitle 中文译名	可选
duration 时长	可选，格式 mm:ss 或 hh:mm:ss，保存为秒数或 null
lyricists 作词	多人数组，可选
composers 作曲	多人数组，可选
arrangers 编曲	多人数组，可选
lyricsText 歌词	可选多行文本，保留空行和换行
lyricsSource 歌词来源	可选（URL 或出版物说明）
lyricsRightsStatus 歌词公开权限	默认 private / metadata-only，不可自动公开
notes 歌曲备注	可选


必备操作：
- ＋ 添加曲目、删除曲目（确认）、上移/下移或拖动排序；键盘必须可操作，不得只支持拖动。
- 展开后字段使用二维或单列响应式网格；作词、作曲、编曲多人输入可以用 添加人员，也可输入后转成 tag。
- 修改曲序后保持数据一致；不要仅通过数组索引当作永久 ID。
- 曲目条数不限于一张专辑的典型长度；空歌曲列表允许保存草稿。
- 允许新建“完整曲目暂缺”的专辑条目；资料不足时公开页应该说“曲目资料待补充”，不能生成假歌名。
- 歌词编辑不代表获得歌词公开展示许可。未经确认授权，公众只能看到歌词状态或来源，不展示全文。
Tab 3 — 发行版本 / Editions
允许一张 Album 绑定零个、一个或多个发行版本。新增版本时不用重复输入所有基本信息和歌曲人员信息。

每个版本至少有以下全部可选字段：
- editionName：用户自定义版本名，如 1987 Original CD（不自动虚构）
- catalogNumber：唱片编号 / Catalog No.（支持字母、数字、连字符；作为文本保存，不是数字类型）
- label：厂牌 / Record Label
- format：CD / Vinyl LP / 7-inch Single / Cassette / Digital / Other
- releaseDate：该版发行日期，可部分填写
- releaseRegion：国家/地区
- barcode：条码（可选）
- notes：发行版本备注，如首版、复刻、母带说明
- purchaseLinks[]：购买渠道名称 + 完整 URL + 备注（可多条）
校验：网址存在时需是合法 https:// 或 http:// URL；未填写链接时不显示假的购买按钮。不要将每版的厂牌/编号直接写成 Album 的唯一属性。

如果现有数据库/页面只支持专辑级的 catalogNumber、label，在迁移时保留历史值，默认创建一个“待确认版本”，不要静默丢弃数据或假设其是原版 CD。
Tab 4 — 媒体 / Media
编辑端支持显示/选择以下类别的文件记录：
- 唱片封面 cover（前、后、唱片标签等）
- 内页/歌词册扫描 booklet / scan
- 音频 audio（文件规格、来源、所对应的版本/曲目）
每个文件记录应当支持 type, displayName, source, relatedEditionId?, relatedTrackId?, mimeType?, size?, bitDepth?, sampleRate?, rightsStatus。

V1 要求：
- 能选择本地图片并预览；若持久化实际图片文件已实现，必须如实说明存放位置。不能把 blob: 临时 URL 存成永久资源地址。
- 音频优先支持元数据登记；如果当前本地服务器有可靠的私有文件处理能力，可以接入真正上传，务必保存在非 public/ 的私有目录并确保仅本机开发可读。绝对不能通过上传操作自动创建公网上可访问的完整音频 URL。
- 每项媒体都明确区分 metadata-only / private / licensed-public；默认 private。
- 不要假装 CDN、对象存储或音频转码已接通；做不到的功能要在 UI 标注为“尚未接入”。
- 图像上传成功/失败要有真实反馈，不能只有无效拖拽区。
Tab 5 — 来源与修订 / Sources & History
- sources[]：来源名称、来源网址/出版物、说明（全部可选，多条）。
- changeNote：本次补充了什么，支持简单文字说明；保存草稿时可空。
- 记录更新时间与本地贡献者署名；保留可显示的版本修订列表。
- 显示来源为空时“暂无资料来源”，不生成虚构引用。
- 对关键内容更新提供可预览的差异（至少展示重要字段修改前后或简洁变更摘要）。
5. 数据模型（示意，可按现有代码调整）
请沿用或扩充现有 TypeScript 类型，不要产生两套互不兼容的专辑数据模型。
type EntryStatus = 'draft' | 'pending-review' | 'published';
type RightsStatus = 'metadata-only' | 'private' | 'licensed-public';
type DatePrecision = 'year' | 'month' | 'day';
type AlbumType = 'album' | 'single' | 'ep' | 'compilation' | 'live' | 'other';

type PartialDate = { value: string; precision: DatePrecision } | null;

type Credit = { id: string; name: string };

type Track = {
  id: string;
  position: string;        // 01、02 或 LP 侧的 A1/B1
  title: string;
  translatedTitle?: string | null;
  durationSeconds?: number | null;
  lyricists: Credit[];
  composers: Credit[];
  arrangers: Credit[];
  lyricsText?: string | null;
  lyricsSource?: string | null;
  lyricsRightsStatus: RightsStatus;
  notes?: string | null;
};

type PurchaseLink = {
  id: string;
  merchantName: string;
  url: string;
  note?: string | null;
};

type Edition = {
  id: string;
  editionName?: string | null;
  catalogNumber?: string | null;
  label?: string | null;
  format?: string | null;
  releaseDate?: PartialDate;
  releaseRegion?: string | null;
  barcode?: string | null;
  notes?: string | null;
  purchaseLinks: PurchaseLink[];
  // 将来可加入此版本独有的曲目顺序/Bonus Tracks
};

type ArchiveMedia = {
  id: string;
  albumId: string;
  relatedEditionId?: string | null;
  relatedTrackId?: string | null;
  type: 'cover' | 'scan' | 'audio';
  displayName?: string | null;
  storageKey?: string | null;  // 真实文件引用；不可用临时 blob URL 充当
  source?: string | null;
  rightsStatus: RightsStatus;
  mimeType?: string | null;
  size?: number | null;
  bitDepth?: number | null;
  sampleRate?: number | null;
};

type SourceReference = {
  id: string;
  label: string;
  url?: string | null;
  note?: string | null;
};

type Album = {
  id: string;                    // 稳定 ID，与可变 slug 分开
  slug: string;
  title: string;
  originalTitle?: string | null;
  translatedTitle?: string | null;
  artist: string;
  type?: AlbumType;
  firstReleaseDate?: PartialDate;
  description?: string | null;
  aliases: string[];
  tracks: Track[];
  editions: Edition[];
  media: ArchiveMedia[];
  sources: SourceReference[];
  status: EntryStatus;
  contributor: string;           // V1 默认 fly-me-to-1980
  editorNotes?: string | null;
  createdAt: string;
  updatedAt: string;
};
字段命名可以调整，但必须满足：可空字段、多个版本、每首歌多人署名、歌词私有权限、来源、状态、稳定标识。既有旧专辑数据不能因类型升级而丢失。
6. 保存、编辑与审核流程（不能做假按钮）
6.1 V1 本地数据持久化
优先复用项目已有的存储方式。若之前只是 src/data/*.ts 的只读 mock 数据，建议增加本地 SQLite 数据库（不需要数据库服务器），用于保存专辑、版本、曲目和修订记录；必要时通过 Next.js Route Handlers / Server Actions 实现 CRUD。若已有可靠的本地数据库，请沿用，避免重复创建。
- 存储在项目外或项目内忽略提交的 data/ 目录，并加入 .gitignore；不要把私人歌词全文、音频文件或 API 密钥提交到代码仓库。
- 现有静态演示数据可以作为只读默认数据或一次性导入，但必须确保用户新增/编辑的资料能在页面刷新与开发服务重启后保留。
- 若无法实现持久化，不得把只有 React state 的表单称为“已保存”；应说明限制并优先修复。
- 不要为了实现本地 CRUD 就引入云服务或复杂的微服务架构。
6.2 用户动作
1. /contributor/albums/new 新建记录 → 输入任意内容 → 保存草稿 → 提示保存成功 → 返回编辑时数据存在。
2. ＋ 添加曲目 → 填入歌名、选填作词/作曲/编曲/歌词 → 保存 → 页面刷新仍存在。
3. ＋ 新增发行版本 → 填入厂牌与唱片编号 → 保存 → 页面刷新仍存在。
4. 预览 → 渲染类似公开专辑详情的效果，但清楚标注 草稿预览；不会导致数据对外发布。
5. 提交审核 → 检查专辑标题、艺人、已存在曲目的标题和已填写链接的合法性 → 状态变为 pending-review，并记录修订说明。
6. 发布：仅为本机受控的管理员操作，发布后公开本地 /discography/[slug] 才显示该条目；真正的公网管理员权限必须等服务端鉴权完成后再启用。
7. 编辑已发布专辑 → 修改先进入草稿/待审核版本，不能无审核地覆盖已发布记录；保存/提交应留有上一版内容与时间。
8. 删除操作需要确认，避免误删；最好支持撤销或保留历史快照。
状态说明：
draft（草稿）
   └── submit → pending-review（待审核）
                      ├── approve → published（已发布）
                      └── request changes → draft（退回修改）
本地版本无需真的发送审核通知或邮件，但可以真实保存审核队列与状态。如存在管理员角色演示开关，必须标注其仅是本地演示，不具有安全性。
7. 与公开专辑详情页联动
保持当前 /discography 页面整体审美，仅增加以下字段的展示支持：
- 专辑页基本信息：标题、类型、首次发行时间、介绍（仅显示已填写内容）。
- 曲目列表：日文标题、时长；曲目展开可查看已填写的作词/作曲/编曲。
- 歌词：只有明确为 licensed-public 且有发布权限时才能展示正文；否则完全不展示歌词全文，可显示“歌词资料已收录，暂不公开”或不显示。
- 版本列表：展示 版本名 / 载体 / 编号 / 厂牌 / 年份 / 地区 等已有字段；同一专辑的多个版本应当明显可区分。
- 正版购买渠道：若有真实有效 URL，展示外部购买链接；缺失时不要展示虚假按钮。
- 媒体：缺少资源时展示“待整理”，不可误导用户以为有可下载 FLAC。
- 公开页面尾部保留 资料来源 和 补充 / 更正资料 入口；贡献者署名可以作为轻量元数据出现。
- 不要直接向匿名访问者暴露尚未发布的草稿、私人媒体文件路径或歌词内容。
8. 本次不做
- 不改 / 的秋日湖畔开屏、移动端封面、黑色 About / Credits 页面；
- 不做音乐上传到 COS、公开 FLAC 下载、用户配额、视频转码；
- 不做真实开放注册、跨设备用户账号、邮箱验证和公网管理员登录；
- 不因界面完整而伪造已经审核、已授权或已存在的历史事实；
- 不做复杂社区帖子、评论、社交积分、排行榜或任何与本次专辑录入无关的功能；
- 不使用大体量 UI 套件重构已有样式，除非项目已经使用。
9. 开发步骤与验收
1. 检查仓库、现有 Album 类型及页面数据流；先形成最小改动方案，然后直接实施。
2. 构建本地持久化数据层与类型兼容迁移；不要破坏现有唱片清单。
3. 实现 /contributor/albums 的编辑入口与目录列表。
4. 实现统一 Album Editor：Overview、Tracklist、Editions、Media、Sources & History 五部分。
5. 接通保存草稿、预览、提交审核及本机发布状态流程。
6. 将已发布资料映射到原有 /discography 及详情页，不公开草稿/私人文件。
7. 检查 1440px 桌面、390px 与 360px 手机布局；没有横向溢出，表单不会遮挡。
8. 测试重要场景：
   - 仅填写专辑标题、艺人，其他全部留空，也能提交；
   - 添加两首歌，其中一首只填曲名，另一首填写多人作曲/作词和换行歌词；
   - 给同一专辑增加两个版本，各自有不同的厂牌、编号；
   - 保存后刷新、重启开发服务，内容仍在；
   - 预览未发布资料正确，但公共目录不显示草稿；
   - 编辑并提交已发布专辑后，公开页在批准前仍保持旧版；
   - 缺少授权的歌词和媒体没有在公开页面泄露。
9. 执行 npm run build；如项目提供 lint/test 脚本也运行。修复实际错误后再交付。
10. 简洁总结修改文件、运行地址、数据保存位置、哪些是 V1 本地限制，以及之后接入真实 Contributor 身份认证的工作。
验收成功标准
不是只画出一张表单，而是真正能够从 Contributor 新增、编辑并持久化一张河合奈保子专辑，管理曲目和多个发行版本，并在批准后正确显示到现有唱片馆。