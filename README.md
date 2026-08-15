# dsh-approval-timeout 批准超时

当需要你批准的操作（沙箱升级、权限请求等）超过设定时间未响应时，**自动视为拒绝**（"先不弄"），避免无限等待阻塞任务。

- DSH 内置审批**没有超时机制**（结果仅 `allowed-once / rejected / cancelled / unavailable`）
- 本插件通过 `approval/request` 瀑布流拦截 + `timer` 服务实现：超时返回 `rejected`
- 超时后你仍可稍后手动重新触发操作；未决审批请求的结果会被丢弃

## 配置

设置 → 批准超时：
- 启用开关
- 等待秒数（5–3600，默认 120）
- 配置持久化于 `.dsh-features/approval-timeout.json`

## Host RPC

| 方法 | 入参 | 返回 |
|------|------|------|
| `approval-timeout/get` | — | `{ enabled, seconds }` |
| `approval-timeout/set` | `{ enabled, seconds }` | 更新后的配置 |

## 安装与自动启动（bundle 插件）

本插件已打包为标准 DSH bundle：安装后随 DSH 进程启动自动注册并激活，无需 `cordis_define`，也无需配置 `plugin-autostart.json`。

```bash
# 发布到 npm 后（推荐，他人安装同样用这条）：
dsh plugin --profile web add dsh-approval-timeout
# 本地目录测试：
dsh plugin --profile web add <本目录>
```

然后重启 `dsh web`：

- host 半部由插件自身自动定义并立即运行；
- 浏览器页面启动时自动 reconcile 并加载 client 半部（首次安装已预授权，无需再点批准、无需进入设置页）。

---
