# 专辑淡化背景

专辑总览使用第一版本的当前可见封面；版本详情使用该版本封面。缺图时不创建装饰层。沿用既有媒体接口和权限，不改变 COS、资料或原封面。

独立 absolute 图层位于右侧 58% 区域，opacity .16（用户要求稍加深），灰度 100%、brightness 1.08、contrast .93。左右与上下分别使用标准及 WebKit mask-image 渐隐；内容 relative/z-index:1，保持不透明。图层 aria-hidden、pointer-events:none；≤768px 及 forced-colors 隐藏。

已检查 360/390/430/768/1440px，专辑与版本均无横向溢出；确认总览取首版封面、第二版本使用自己的封面、无封面时没有装饰图，正文 opacity 保持 1。未新增页面文案或模块。隔离验收结果见 album-atmosphere-qa.json，截图见 screenshots/album-atmosphere-desktop.png、edition-atmosphere-desktop.png、edition-atmosphere-mobile.png。npm run typecheck 与 npm run build 通过。
