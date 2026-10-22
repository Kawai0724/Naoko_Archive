# 媒体访问权限 · 2026-10-22

## 当前规则

| 资料 | 未登录/未获批 | 获批普通成员 | 管理员 |
| --- | --- | --- | --- |
| 已审核专辑封面（cover） | 可看 | 可看 | 可看 |
| 已审核资料图片（scan） | 需登录且获批 | 可看 | 可看 |
| 已审核音频、播放 Range、下载 | 拒绝 | 拒绝（包括投稿者） | 可用 |
| 草稿封面/扫描图 | 拒绝 | 仅自己的投稿 | 可看 |
| 草稿音频、下载 | 拒绝 | 拒绝（包括投稿者） | 可用 |

封面采用最近批准的快照；未审核替换图不会提前进入目录。删除专辑后所有公开媒体入口失效。普通成员继续上传文件、修改元数据和提交审核，不能以播放或下载接口绕过权限。编辑器与草稿预览同步隐藏非管理员音频控件。

## 实现

- `visibleAlbumMedia` 为目录和公开详情投影可见媒体；访客仍看到封面，不输出音频 URL。资料扫描图的登录提示不影响封面。
- `/api/archive/media/{albumId}/{mediaId}` 先查已审核、未删除专辑及登记的文件归属/媒体类型；cover 可以直接读取，其余资料验证真实获批会话，audio 再验证数据库中的管理员角色。
- Contributor 音源接口通过 `ContributorStore.media(key,true)` 强制管理员权限，包括作者自己的草稿。图片接口不接受音频文件。
- COS 桶和对象保持私有，单文件签名有效 120 秒；音频通过鉴权后才生成签名。已签发临时链接在期限内仍有效。`no-store`，永久密钥不进客户端。
- 本地音频保持流式 Range 206/416 与安全下载文件名；COS 直读不经 Next.js 中转大文件。播放器 `preload="none"`。
- 不新增数据库迁移，不改原始文件、快照、历史、角色、CAM 权限或公网端口。歌词权限不变。既有私人/公开选项不恢复。

## 本地隔离验收

```sh
npm run typecheck
npm test
npm run build
task_media_dir=$(mktemp -d /private/tmp/naoko-sharing-qa.XXXXXX)
node scripts/verify-site-media-sharing.mjs seed "$task_media_dir"
ARCHIVE_PUBLIC_DATA=1 ARCHIVE_DATA_DIR="$task_media_dir" \
CONTRIBUTOR_ADMIN_PASSWORD='site-media-test-password' npm run start -- -p 3416
# 另开终端，用同一个临时目录
node scripts/verify-site-media-sharing.mjs verify "$task_media_dir"
```

仅生成微型测试 PNG 和两秒 FLAC，写隔离 SQLite。验证访客、伪造会话、待审成员、普通作者、其他成员和管理员；检查封面实际字节、音频拒绝时无重定向、Range 与下载、草稿/跨专辑边界、目录/详情/编辑器/预览的音频入口。无 COS 上传、无 3GB 文件、无生产投稿操作。HTTP 结果写入 `docs/site-media-http-qa.json`。

部署前备份独立生产库，仅同步代码及构建重启已有系统服务，核对数据未变；不开放公网 HTTP/HTTPS。
