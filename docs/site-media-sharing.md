# 站内媒体默认共享 · 2026-10-22

覆盖此前媒体必须单独设置公开权限、音源仅管理员读取的规则。

- 图片编辑不再显示私人/公开下拉框、授权勾选或“私人”状态。保留类别、名称、来源、替换、移除及每版本六张限制。
- 图片和音频默认随专辑审核发布，对已登录且获批的站内成员直接显示；无需对文件另作公开确认。新上传在自己的工作稿中可立即预览/试听，投稿及版本的审核流程保留。未审工作稿、替换文件仍通过作者/管理员鉴权；已发布内容继续使用最近批准的快照，删除后媒体接口失效。
- 既有已发布快照中的文件也使用新规则。历史 `rightsStatus` 与 `publicationConfirmed` 保留兼容，不再决定文件展示或出现在新审核差异中，不自动捏造“已获公开授权”。歌词文本权限不变。
- 版本详情增加音源播放器、下载入口及关联曲目链接，`preload="none"`，不自动播放或预下载大文件。浏览器不支持的格式可下载后播放。
- COS 桶与对象继续私有，不设置公共 ACL。`/api/archive/media/{albumId}/{mediaId}` 先验证真实获批成员会话（匿名/伪造 401，待审 403），再接受已发布且未删除专辑的实际关联文件，检查数据库归属/媒体类型，再生成 120 秒单文件签名 URL。音频可内联播放，下载时签名 Content-Disposition。永久 SecretKey 不进入客户端。
- 本机音源通过流式 Range 响应，支持 206/416；COS 由浏览器直读，不经 Next.js 中转大文件。响应不缓存。草稿音源保留作者/管理员边界，普通贡献者可试听自己的上传。
- 不新增数据库迁移、不重写快照/历史/角色、不改 COS 配置和网络隔离，不开放公网。

## 验收

`npm test`（57 项）、`npm run typecheck`、`npm run build`。

隔离服务使用脚本 `scripts/verify-site-media-sharing.mjs`：

```sh
task_media_dir=$(mktemp -d /private/tmp/naoko-sharing-qa.XXXXXX)
node scripts/verify-site-media-sharing.mjs seed "$task_media_dir"
ARCHIVE_PUBLIC_DATA=1 ARCHIVE_DATA_DIR="$task_media_dir" \
CONTRIBUTOR_ADMIN_PASSWORD='site-media-test-password' PORT=3416 npm run start
# 另开终端，用上面的同一个临时目录
node scripts/verify-site-media-sharing.mjs verify "$task_media_dir"
```

测试只使用一张微型 PNG 和一段两秒 FLAC，保存于临时目录，不上传 COS、不复制生产资料。覆盖无权利选项的发布、实际图片读取、FLAC 分段字节、下载文件与文件名、非法 Range、未审/跨专辑拒绝、作者试听、他人草稿与匿名拒绝、获批非作者共享、待审/伪造会话拒绝、匿名目录不输出媒体入口。签名 SDK 测试使用虚拟密钥且不联网，验证 120 秒及下载签名参数。

浏览器检查图片表单没有权限字段/勾选，普通作者能看到音源试听与下载；360px 编辑器及版本页无横向溢出。截图 `site-media-image-editor.jpg`、`site-media-audio-mobile.jpg`；HTTP 记录 `docs/site-media-http-qa.json`。

部署前备份服务器 SQLite，仅同步代码、检查、构建并重启系统级服务。生产仅核对数据、读取既有文件的一小段，验证 COS 签名可用；不创建、审核、删除真实投稿，不上传任何整批收藏，不扩大 CAM 策略。

自动审批曾拦截未认证媒体读取的部署。已增加真实获批成员会话保护，目录也不向未登录者输出文件入口；COS 和现有私人网络隔离不变。
