# 保持登录

登录表单提供默认不勾选的“保持登录（30 天）”。勾选后，会话 Cookie 的 Max-Age 与 SQLite 中 expires_at 均为 30 天；未勾选或旧客户端未传选项仍为 8 小时。只接受布尔值 rememberMe，不接受客户端指定任意有效期。

期限是登录时开始的绝对期限，不因刷新或浏览页面自动延长。数据库只保存随机会话令牌的哈希，不将密码写入 localStorage、sessionStorage 或 Cookie。Cookie 保留 HttpOnly、SameSite=Strict，生产 HTTPS 保留 Secure。退出清除 Cookie 并删除服务端会话；停用、注销仍撤销所有会话，审批状态及角色始终从数据库读取。

已登录访问登录页会直接跳转工作台；待审核或被拒绝账号仍只能进入申请页。邀请及注册不自动创建 30 天会话，现有登录也不自动延长。当前已登录用户若要立即启用，需要自行退出后勾选一次再登录。

## 验收

- `npm run typecheck`、`npm test`（64 项）、`npm run build`。
- 模拟时间验证普通登录在 8 小时后失效、保持登录在 30 天边界失效，关闭重开数据库可恢复，退出/停用/注销撤销会话，待审账号不因保持登录获得编辑权限。
- `scripts/verify-remember-login.mjs before-restart <隔离目录>` 检查实际 HTTP Cookie 与 SQLite 期限一致、非法选项和错误密码无 Cookie、已登录登录页跳转；重启本地测试应用后运行 `after-restart` 验证受保护访问仍成功及退出后 401。脚本只接受 `/private/tmp/naoko-sharing-qa.*` 测试目录，不读取生产环境文件。
- 浏览器使用隔离测试账号勾选登录，关闭标签再打开登录地址自动进入工作台，退出后重新显示未勾选的登录表单；390px 无横向溢出。截图在 `docs/screenshots/remember-login-{desktop,mobile}.png`。
- HTTP 记录在 `docs/remember-login-http-qa.json`。不使用真实管理员密码作功能测试，不修改生产账号、角色、媒体或既有会话期限。
