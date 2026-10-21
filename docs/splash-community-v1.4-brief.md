agent1.md — Naoko Kawai's Archive · Cover + Bilingual Community Page (V1.4)
本文件是 AGENTS.md 的追加视觉设计指令，专门处理网站 / 的开屏和其下方独立黑色中英双语社区介绍页。
此文件优先于旧版 AGENTS.md 中与 / 的标题大小写、只允许一屏、不能出现页脚和素材预处理相冲突的规则。
请直接修改现有 Next.js 代码，交付可运行页面，不要只写设计说明。不要修改 /archive 及其他档案功能页面的内容结构。

0. 用户真正想要的两屏结构（最重要）
不是往已有照片封面上堆文字。而是在封面下方再做独立的一整屏深色页面，参考 The Criterion Collection 截图的黑色编辑式网站页脚：大留白、白色衬线标题、灰色标签、规整的多栏信息。
/  同一个 URL，自然向下滚动
┌──────────────────────────────────────────────────────┐
│ SCREEN 1 · PHOTO COVER · 100svh                      │
│ [秋日湖畔照片铺满背景，右侧人物清晰]                   │
│                                                      │
│ Naoko Kawai's                                        │
│ Archive                                              │
│                                                      │
│ ENTER →  （点击后导航到 /archive）                     │
└──────────────────────────────────────────────────────┘
                            ↓ 自然滚动
┌──────────────────────────────────────────────────────┐
│ SCREEN 2 · DARK BILINGUAL ABOUT / COMMUNITY          │
│                                                      │
│ 左  ABOUT THE ARCHIVE       右  始建于 / ESTABLISHED │
│     关于本站                      2026.10            │
│     [一段简体中文介绍]          贡献者 / CONTRIBUTOR    │
│     [一段英文介绍]                fly-me-to-1980      │
│                               收藏范围 / COLLECTION │
│                               唱片 · 写真 · 影像     │
│                                                      │
│  ─────────────────────────────────────────────────   │
│  欢迎成为这个社区的贡献者 / CONTRIBUTE TO THE ARCHIVE │
│  [中英文简短邀请]                                     │
│  参与共建 ↗     ENTER THE ARCHIVE ↗   BACK TO TOP ↑  │
│  [中英文小号非官方声明]                               │
└──────────────────────────────────────────────────────┘
- Screen 1：极简、只放主标题和 ENTER。 不允许附加开发时间、开发者或收藏分类文案。
- Screen 2：独立的全宽深炭黑中英双语社区介绍区，自然滚动才能看到，不是浮在照片上的小字块，不是弹窗，也不是单独的 /about 路由。
- 两屏连在同一个 / 页面；滚轮、触摸板及手机手指滑动正常滚动。不要滚动劫持或强制分页。
- ENTER 始终进入 /archive，不要改成只滚到黑色页。
- 黑色页底部保留 ENTER THE ARCHIVE ↗ 链接到 /archive，BACK TO TOP ↑ 返回封面；另提供 参与共建 / CONTRIBUTE ↗ 链接至 /about#contribute（必须是真实有效的锚点）。
1. 封面背景素材：先准备高清网页版本
源文件在用户 Mac 上：
/Users/xiaowenli/Desktop/Xiaowen Li/network/cover.jpg
- 检查文件是否存在，若存在则复制到 public/cover.jpg。绝不覆盖原始照片。
- 尝试生成 public/cover-hero.jpg，长边以 2880–3200 px 为目标，保持原始纵横比、湖畔与人物构图。可用可获得的可靠工具进行高质量缩放（如 Pillow/Lanczos）和轻微降噪锐化。
- 普通插值放大不会增加真实细节：不能声称“修复了原始高频信息”，不得使用会改变人物面容的生成式增强，不要过度锐化或变成 AI 油画。
- 如果无合适处理工具，直接使用原始 cover.jpg 并进行轻量格式/大小优化；不要因放大处理阻塞网站开发。
- 页面使用 /cover-hero.jpg（生成成功时），否则使用 /cover.jpg。不要在网页里写 file:///Users/... 或绝对本机路径。
- background-size: cover；桌面保留右侧人物面部与上方金色树叶，移动端按构图调整 background-position，不能切掉脸。
2. 封面文字与字体：标题首字母大写
唯一标题，必须严格采用：

Naoko Kawai's Archive
- 不再使用 naoko kawai's archive，也不用 NAOKO KAWAI'S ARCHIVE。
- 主标题为欧美编辑/文化杂志气质的衬线字体：Cormorant Garamond 优先，其次 Bodoni Moda / EB Garamond / Georgia。尽量使用已安装或本地可部署字体，不依赖线上字体请求才能显示。
- 标题放在左侧中部，允许自然拆成两行：Naoko Kawai's / Archive；精修字间距与行高。
- 封面只包含标题与 ENTER →。无顶部菜单、开发署名、年份、分类或别的副标题。
- ENTER → 与主标题同一左侧对齐基线，较当前版本上移约 30–45 px（以最终版视觉比例为准）；留白舒适，不要贴住标题。
- ENTER 是真链接 /archive，细下划线加箭头样式，不要饱和色实心按钮。
3. 修正目前左侧“过白”的问题
原图整体不改风格，左侧使用柔和的暖米色渐变，让秋叶、湖面、岸边在标题后仍隐约看得到；右侧人物基本保持原图色彩与对比度。

可以从以下参数开始，再按实际效果微调：
.splash-overlay {
  background: linear-gradient(
    90deg,
    rgba(240, 232, 215, 0.70) 0%,
    rgba(240, 232, 215, 0.50) 26%,
    rgba(240, 232, 215, 0.17) 56%,
    rgba(240, 232, 215, 0.00) 80%
  );
}
- 绝对不要做大面积纯白涂层或生硬的竖向边界。
- 保证左侧深棕标题可读；微调渐变透明度比在整个图片上加模糊更好。
- 人脸位置不要放标题，不要把整张图片强行提亮/去色。
4. 第二屏：独立黑色社区介绍页（本次新增的核心任务）
位置：照片封面下面，属于 / 的第二个 <section>，不是普通站点 Footer 的一小条，也不是照片的半透明覆盖层。建议 min-height: 100svh；内容多或手机窄屏时允许自然增高。

设计参考：The Criterion Collection 的深色 footer / editorial navigation，借鉴黑底排版结构与层级，不要复制它的商店栏目、版权文案、logo 或订阅表单。
4.1 视觉规格
- 背景：#1D1D1D 或 #202020 的深炭黑，整块实色；不要渐变霓虹、玻璃拟态或图片背景。
- 主标题：温暖灰白 #EFECE6，优雅英文衬线字体；字号比正文显著大。
- 栏目标签：浅灰 #A5A29F，小号大写无衬线，轻微 letter-spacing。
- 次要信息：灰白 #D6D2CB；辅助文字 #9B9995。
- 用细水平分隔线划分底部，不用圆角卡片、阴影或彩色按钮。
- 容器最大宽度约 1200–1360px；桌面内边距可从 clamp(28px, 5vw, 90px) 起调整。
- 参考桌面左右 40% / 60% 非对称布局：左侧为英文衬线标题、中文标题和中英双语短介绍；右侧为简洁的双语元数据分组。整体要有明显留白。
- 不是要把 Criterion 的截图完全复刻；视觉风格应与上面的秋日封面衔接：白色文字不要刺眼，整体稳重。
4.2 页面文案（使用下列精修版，不临时另写长文）
定位：由中国歌迷发起、面向所有河合奈保子爱好者的非官方资料档案馆。使用“档案馆 / archive”比“资源站 / download site”更准确，也更符合 Criterion 式的编辑审美。

版式原则：中文是主要沟通语言，英文作为对照和国际化表达；不要只提供英文，也不要逐字生硬直译。 档案页其他部分仍然是中文，不添加全站语言切换。

左侧标题和介绍（必须配对显示，建议中文正文比英文正文稍显著）：
ABOUT THE ARCHIVE
关于本站

这是由中国歌迷发起的河合奈保子非官方数字档案馆。
我们整理唱片、写真、影像与相关资料，
让散落的作品线索与昭和记忆在这里重新汇聚。

Created by fans in China, this independent archive
brings together Naoko Kawai's records, photobooks,
films, and related materials — preserving the details
and memories that deserve to be rediscovered.
右侧元信息（中英文标签必须同时呈现；首次开发时间已由用户明确指定为 2026.10，不要改为 2026 或自行补成某一天）：
始建于 / ESTABLISHED
2026.10

贡献者 / CONTRIBUTOR
fly-me-to-1980

收藏范围 / COLLECTION
唱片 · 写真 · 影像
Records · Photobooks · Films
删除旧版本所有面向访客的 BUILT WITH / Codex 展示。 也不要以 Developed with Codex、Powered by Codex 或等价措辞在第二屏、页脚或任何前端页面再加回来。署名保留 CONTRIBUTOR — fly-me-to-1980，不要擅自更改为 FOUNDER、DEVELOPER 或使用 Codex 署名。此处列出现阶段贡献者不代表禁止未来添加其他真实贡献者；下方仍要邀请更多粉丝参与。

主介绍与元信息后，通过一条极细分割线，加入社区共建邀请模块：
欢迎成为这个社区的贡献者
Help Build the Archive

无论是唱片版本信息、旧节目线索、写真出版记录，
还是对现有资料的补充与更正，都欢迎你的参与。

Have a release detail, a broadcast reference,
photobook information, or a correction to share?
Your contribution can help this archive grow.

参与共建 ↗  /about#contribute
- 中文标题比英文副题更醒目；英文副题使用欧式衬线体，适度斜体也可。
- “参与共建”采用细下划线文字链接，不做大面积实心按钮。
- V1 不做真实投稿表单：该链接必须指向 /about#contribute 的真实段落，写明可贡献的资料类型，并如实标注“提交渠道筹备中”；不要展示不存在的邮箱、账号或已上线的投稿功能。如果实现了可用的真实联络渠道，才可修改这条说明。
- 不要声称项目已由多人共同维护，也不要虚构已有社区规模。用户现在是发起者，文案应体现“欢迎共建”，而非“已有数千贡献者”。
底部轻量链接与非官方声明：
ENTER THE ARCHIVE ↗                BACK TO TOP ↑

非官方歌迷档案馆；相关作品权利归各自权利人所有。
Independent and unofficial. Rights to original works
remain with their respective owners.
- 日期精确使用 2026.10（表示 2026 年 10 月首次开发），这是用户明确提供的月份。不可删去 .10，也不要虚构具体日。
- 网站公开面对中国大陆用户，不能称为 “Private Archive Project”。
- 不要加入无用的 Newsletter 表单、虚构社交账号、支付入口、空链接。
4.3 页面排布节奏
- 上方约 12–16vh 的留白；中间编辑式标题和元数据；底部轻量链接与声明。
- 英文标题可以占两行（About the / Archive），避免把所有信息挤在页顶。
- 元数据与中英双语段落间隔足够大（32–56px），像画册版权页，而非管理后台。
- 黑色页不需要再次展示河合奈保子照片，两个页面通过照片 → 极简黑底的切换形成节奏。
- 从第一屏自然滚到第二屏，不做强制吸附；可以加入不超过 250ms 的淡入动画，必须尊重 prefers-reduced-motion。
5. 响应式与可访问性
- 桌面：第一屏满屏照片、左侧标题；第二屏约 40/60 分栏或按字数适当调整，左侧中英正文，右侧元信息；贡献邀请跨栏放在下方。
- 手机：第一屏优先保护右侧人物面部和标题位置；第二屏改成单列，字号及间距缩小但不拥挤。
- 手机端黑色页不强制锁死在 100svh，避免内容被截断，允许自然向下延伸。
- ENTER、ENTER THE ARCHIVE、BACK TO TOP 全部键盘可聚焦，链接目标真实有效。
- BACK TO TOP 应滚动到第一屏顶部；可以平滑滚动，但 prefers-reduced-motion 下立即跳转。
- 两屏都不得产生横向滚动；检查 1440×900、1024px、390×844。
6. 实现提示
可以直接采用如下页面结构（仅供参考，不强制组件名称）：
export default function SplashPage() {
  return (
    <main>
      <section id="cover" className="splash-cover" aria-label="Archive cover">
        {/* 100svh photo / warm gradient overlay */}
        {/* h1: Naoko Kawai's Archive */}
        {/* Link href="/archive": ENTER → */}
      </section>

      <section id="credits" className="archive-credits" aria-label="About the archive">
        {/* deep charcoal background, bilingual About introduction */}
        {/* Established 2026.10 / Contributor fly-me-to-1980 / Collection */}
        {/* bilingual contributor invitation and /about#contribute link */}
        {/* footer links to /archive and #cover */}
      </section>
    </main>
  );
}
除为 /about#contribute 添加真实锚点与简短贡献说明外，不修改现有 /archive 正式主页、唱片、写真、视频、时间线等路由。
7. 验收要求
- [ ] / 首屏仍只有标题 Naoko Kawai's Archive 与 ENTER → 两处文字。
- [ ] 原始 cover.jpg 不被覆盖；如有合适工具，生成优化后的 public/cover-hero.jpg；不虚称清晰度得到真实修复。
- [ ] 左侧暖色遮罩明显降低，不再大面积发白；湖面和树叶仍有纹理，右侧人物清楚。
- [ ] 标题首字母大写，欧美衬线字体；ENTER 相比现版略上移。
- [ ] 向下滚动会出现整整一屏独立的黑色信息页，不是压在照片上的文案，也不是另一个 URL。
- [ ] 黑色页展示准确的中英双语介绍、2026.10、CONTRIBUTOR / 贡献者 — fly-me-to-1980、内容类型、共建邀请和简洁的双语非官方声明；公开界面不出现开发工具署名。
- [ ] 点击封面 ENTER 正常进入 /archive；黑色页的进入、返回顶部和参与共建链接都有效；/about#contribute 存在且不伪装成已开放的投稿系统。
- [ ] 桌面/手机视觉均完成；无无效按钮、无横向溢出，npm run build 通过。
交付前请用浏览器实际检查第一屏和第二屏，说明图片预处理结果、文件路径、两屏改动及构建结果。