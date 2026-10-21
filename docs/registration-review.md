2026-10-22：内容审核改为逐条消息和必填原因，以 [内容审核消息](content-review-messages.md) 为准；注册、管理员申请和网站文字审核流程保留。

# 注册申请与统一审批

本次更新取代 V2 中“必须拿到邀请才能创建账号、邀请账号立即可编辑”的流程。现在用户可以自行提交注册申请，但所有新账号（包括邀请创建）必须由管理员批准才获得 Contributor 权限。网络访问仍通过现有 SSH/Tailscale 私人方式，不开放公网端口。

## 用户流程

1. 未登录访问 `/contributor`：显示“首次参与共建，请先注册”，提供“申请注册”和“已有账号，登录”。
2. `/contributor/register`：填写用户名、至少 12 字符密码、确认密码，可选申请说明。提交后进入 `/contributor/application`，账号状态为待审核。
3. 等待期间可以登录、查看自己的状态和管理员回复；不能访问编辑器、他人资料、管理员接口、上传或申请网站修改。
4. 管理员批准后，刷新状态即可进入工作台，现有会话即时获得权限。被拒绝的账号可以登录查看原因、补充说明并重新提交。停用账号不能登录，原有会话失效。
5. 已有账号迁移时保留权限、密码和会话。管理员仍为 `fly-me-to-1980`，密码未变。

## 管理员

登录后从导航或工作台进入 `/contributor/admin`。三个分类为：

- **注册申请**：查看用户名、申请说明、时间，填写可选回复，批准或拒绝；可查看已通过/已拒绝记录。
- **内容审核**：集中显示待审核专辑及其发行版本，链接到工作稿预览与版本媒体，沿用原有整张专辑快照批准/退回机制。
- **网站修改**：显示修改前后内容、申请人、原因；批准后才写入公开内容表，被拒绝的申请不改变页面。

“成员与邀请”入口保留，可创建邀请、撤销未使用邀请、停用账号。邀请只简化申请入口，不绕过注册审批。

## 网站修改范围

目前只提供“关于本站介绍”和“共建说明与规则”两项文字修改申请，入口 `/contributor/requests`。两项对应 About 页面已有的段落，不新增公开模块，不改变开屏、目录、字体和版式。

普通贡献者只能看到自己的网站修改申请；管理员可查看全部。提交时保存内容原值和修订号，批准时再次核对，避免两个申请先后覆盖同一旧版本；过期申请需退回后重新基于最新文字申请。用户不能修改服务器配置、密钥、COS 权限、账号角色或页面代码。

## 数据和权限

- 在现有 SQLite 追加 `contributor_users.approval_status`、`contributor_applications`、`site_change_requests`、`approved_site_content`。旧用户默认为 approved；所有新用户显式 pending。
- 密码继续 scrypt 加盐哈希。待审账号虽有 HttpOnly 状态会话，所有编辑/上传 API 仍从数据库校验 approved，不能靠前端状态绕过。
- 批准/拒绝/重提有修订号检查，禁止重复或过期操作。账号状态、申请状态、审核人和审计记录在事务内持久化。公开网站文字与批准记录同事务写入。
- 所有写入继续校验同源。Nginx 必须保留浏览器完整 Host（包括端口），使用 `proxy_set_header Host $http_host;`；不能恢复为会剥掉 3100 端口的 `$host`。
- 正式服务由系统级 `naoko-archive.service` 管理：`sudo systemctl restart naoko-archive.service`。重复的用户级服务保持停用。

## 验收

1. 在临时资料库运行 `npm run typecheck`、`npm test`、`npm run build`。当前 38 项测试通过，包含旧专辑/媒体回归及新增审批权限、账号迁移、网站修改审核和并发保护。
2. 用临时密码启动本地生产服务，`ARCHIVE_DATA_DIR` 必须是新的临时目录：

```bash
ARCHIVE_PUBLIC_DATA=1 ARCHIVE_DATA_DIR=/tmp/naoko-registration-test \
CONTRIBUTOR_ADMIN_PASSWORD='registration-test-only-password' PORT=3415 npm run start
```

3. 另一个终端执行 `node scripts/verify-registration-review.mjs`。脚本只允许 localhost/127.0.0.1，必须对隔离数据库运行，不能对 SSH 映射的生产地址运行。
4. HTTP 测试覆盖首次提示、注册、待审页面/API/上传阻拦、拒绝、重新提交、批准后即时启用、管理员后台、网站内容批准后读取、邀请不绕过审批和 CSRF。结果在 `registration-review-http-qa.json`。
5. 浏览器已检查首次入口、注册表单、管理员登录和统一审批页；390px 手机后台 scrollWidth=390，无横向溢出。截图在 `docs/screenshots/registration-admin-*.png`。

## 部署

先备份服务器 SQLite（使用 backup API，包括 WAL 内容），再快进同步代码。停止实际运行的**系统级**服务后执行 npm ci、typecheck、test、build，再启动系统服务。保留 `.env.local` 和独立资料目录，不复制临时测试库。正式验证需通过 Nginx 模拟 Host/Origin 都为 `127.0.0.1:3100`，使用支持显式 Host 的 HTTP 客户端；Node fetch 可能重写测试 Host。

只做追加迁移；部署前后核对专辑快照指纹、既有账号 ID/角色/密码哈希，确保无变化。生产验收只登录/查看/退出，不创建测试账号、不批准真实待审申请，也不修改真实公开文字。
