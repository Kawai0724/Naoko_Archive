# Contributor 多用户协作 V2

管理员用户名为 `fly-me-to-1980`。初始密码沿用服务器原有的 `CONTRIBUTOR_ADMIN_PASSWORD`，首次启用时使用 scrypt 加盐哈希写入 SQLite。旧版 HMAC 管理员 cookie 不再有效，需要重新登录。

## 使用步骤

1. 通过 SSH 转发或已配置的 Tailscale HTTPS 私人网络，进入 `/contributor/login`。
2. 管理员登录，打开“成员与邀请”，点击“创建邀请”，复制链接发给好友。链接有效期七天，只能使用一次；管理员可撤销未接受邀请。
3. 好友打开链接，设置用户名和至少 12 字符的密码，进入工作台。不开放无邀请注册。
4. 点击“新增专辑”，填写专辑名、艺人等基本信息，创建后添加发行版本。在版本中补充曲目、封面和音源。作词、作曲、编曲、歌词、时长均可留空；提交时歌曲名称必填。
5. 保存草稿可随时继续编辑。点击“提交审核”后，普通贡献者的投稿锁定为只读，等待管理员审核。
6. 管理员在“提交记录”中筛选“待审核”，查看版本及工作稿预览。进入“编辑专辑”或版本编辑器，选择批准或退回，可填写退回原因。
7. 状态为草稿、待审核、已通过、已拒绝。被退回的内容可修改后再次提交。已通过内容再次编辑形成草稿，公开页面继续保留上一次批准的快照。
8. “成员与邀请”可停用/启用普通账号。停用立即撤销其全部会话。普通用户只能看到自己的投稿，不能访问管理员页、他人工作稿或完整音源。

## 持久化及权限

- 沿用 `ARCHIVE_DATA_DIR/archive.sqlite`，新增账号、会话、邀请、资料归属、上传任务和审计表；原专辑、版本、曲目与审核快照保留。
- 旧资料归属于初始管理员，新增专辑绑定登录账号的稳定 ID，客户端不能指定作者或提升角色。
- 密码采用独立随机盐和 scrypt，数据库只存会话/邀请 token 的 SHA-256；会话有效期八小时，HttpOnly / SameSite=Strict，退出即删除数据库会话。
- 所有写 API 校验 Origin 与实际 Host，全部读取、编辑、上传、完成上传、私有媒体和页面均由服务端检查权限。开发模式也需要真实账号登录。
- COS 文件为唯一 `pending/<albumId>/<UUID>.<ext>`；浏览器持单对象 PUT 签名直传，签名绑定类型及 `x-cos-forbid-overwrite:true`。禁止覆盖已存在对象，替换图片生成新键。
- 服务端 HEAD 校验大小、类型、ETag，再以 If-Match 范围读取验证图片签名或无损音频实际编码，最大读取 8 MiB 元数据；不会中转大文件上传。
- 支持 JPEG、PNG、WebP（每张 10 MB、每版本六张）及 FLAC、PCM WAV、AIFF、ALAC（每个 4 GB）。音源关联整张专辑或当前版本已有的稳定曲目 ID，不自动生成新曲目。
- 上传任务绑定账号、专辑、版本、类型、替换对象、曲目和修订号。确认关联与消费上传任务在同一个 SQLite 事务完成；失败回滚，不能重复确认。
- 新上传默认为 private。只有管理员批准且明确标记有公开授权的图片/歌词才出现在公开快照。完整音频始终不会进入公开媒体 API，只能由管理员使用两分钟签名读取。
- 密钥、数据库、上传文件和备份继续被 Git 忽略。测试账号只存在于临时测试数据库，不迁移到生产。

## 本地自动测试

在一个未使用的临时目录运行生产构建，避免使用现有生产数据：

```bash
npm ci
npm run typecheck
npm test
npm run build
ARCHIVE_PUBLIC_DATA=1 ARCHIVE_DATA_DIR=/tmp/naoko-v2-test \
CONTRIBUTOR_ADMIN_PASSWORD='your-local-test-password' PORT=3413 npm run start
```

另一个终端：

```bash
CONTRIBUTOR_TEST_BASE_URL=http://127.0.0.1:3413 \
CONTRIBUTOR_TEST_PASSWORD='your-local-test-password' \
node scripts/verify-contributor-v2.mjs
```

如需真实 COS 测试，在测试服务进程加载现有 COS 环境变量，再加 `CONTRIBUTOR_TEST_COS=1` 执行脚本。脚本先上传一张 1×1 测试 PNG，成功后仅上传仓库里的小型合成 FLAC；不会上传真实收藏。HTTP 脚本只允许 localhost/127.0.0.1，必须配套独立测试资料目录，禁止对生产运行。脚本创建一次性测试账号，不自动删除测试数据库或云端对象。

自动测试覆盖邀请单次使用/过期/撤销、密码和 token 哈希、会话刷新/过期/退出/停用、跨账号页面和 API 访问、伪造发布、CSRF、并发修订、审核快照隔离、上传绑定、禁止覆盖和失败回滚，以及四种合成无损格式校验。真实 HTTP/COS 结果见 `contributor-v2-http-qa.json`。

## 手动验收

使用管理员和两个邀请账号的独立浏览器会话。A 创建专辑/版本并只填写歌曲名，保存刷新后检查资料仍在；上传图片检查进度和预览，上传合成 FLAC 检查曲目关联。B 应无法通过 URL 或 API 读取/修改 A 的工作稿、媒体或审核历史。A 提交后不可修改/自行批准；管理员退回后 A 可以修改重提；管理员批准后检查公开目录。再修改已通过记录，公开页在第二次批准前保持原样。管理员停用 A 后，A 的旧 cookie 应立即失效。

## 云端要求与私人网络

- 使用现有广州私有桶 `naoko-media-private-1511974295`，不创建新桶、不修改桶 ACL。
- CAM 继续只允许 `pending/*` 的 `cos:PutObject`、`cos:HeadObject`、`cos:GetObject`；此版未增加权限，也未使用列举、删除、桶管理或全局权限。
- 桶必须未启用版本控制，才能依赖禁止覆盖头；若发现版本控制，服务端拒绝确认上传，避免批准后对象被替换。未完成的对象仍留在 pending，由管理员另行处理。
- CORS 需要允许实际使用的私人 HTTPS 来源，PUT、GET、HEAD，允许 Content-Type 与 x-cos-forbid-overwrite，暴露 ETag。现有 `http://localhost:3000` 和 `http://127.0.0.1:3000` 预检已通过；3413 与未来 Tailscale 域名尚未加入，不会自动扩大 CORS。
- [腾讯云禁止覆盖头说明](https://cloud.tencent.cn/document/product/436/7749)。不配置公共读、不配置公开 CDN。
- Next.js 继续监听 127.0.0.1:3000，不更改 Nginx、防火墙、DNS 或公网 HTTP/HTTPS。
- Tailscale 接入属于后续网络配置。建议管理员先在 Tailscale 中授权成员，再通过私有 HTTPS Serve 代理到本机 3000，并将准确的 `https://…ts.net` 来源加入 COS CORS。不要启用 Funnel。Tailscale 登录和访问控制完成前，好友不能从外网直接进入本站。
- 非回环地址默认使用 Secure cookie，需要 HTTPS；SSH 的 localhost 转发可以直接登录。只有明确选择 HTTP 私网时才设置 `CONTRIBUTOR_SECURE_COOKIES=0`。

## 部署和备份

先验证本地临时资料库，再提交 GitHub。部署前停止现有应用并使用 SQLite backup API 创建完整快照（不能只复制 WAL 模式的主文件）；记录原提交与专辑数据指纹。服务器快进到新提交、npm ci、typecheck、test、build，通过后启动原 systemd 服务。首次访问 Contributor 执行追加建表与管理员初始化；旧公开资料应保持相同。不要从 Mac 复制测试资料库到服务器。回滚代码前停止应用，保留新数据库，并从部署前备份恢复到独立文件后再切换。
