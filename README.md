# dsh-qapproval-timeout 批准超时

当需要你批准的操作（沙箱升级、权限请求等）超过设定时间未响应时，**自动视为拒绝**（"先不弄"），避免无限等待阻塞任务。

- DSH 内置审批**没有超时机制**（结果仅 `allowed-once / rejected / cancelled / unavailable`）
- 本插件通过 `approval/request` 瀑布流拦截 + `timer` 服务实现：超时返回 `rejected`
- 超时后你仍可稍后手动重新触发操作；未决审批请求的结果会被丢弃

## 配置

设置 → 批准超时：
- 启用开关
- 等待秒数（5–3600，默认 120）
- 配置持久化于 `.dsh-features/approval-timeout.json`

## Host RPC（HTTP JSON）

| 方法 | 入参 | 返回 |
|------|------|------|
| `GET /dsh-qapproval-timeout/get` | — | `{ enabled, seconds }` |
| `POST /dsh-qapproval-timeout/set` | `{ enabled, seconds }` | 更新后的配置 |

## 安装（原生 bundle，与 dshmarket 同类）

本插件是标准 DSH bundle：安装后作为普通插件运行，**不产生 Cordis 动态插件、无需批准、无需任何手动激活**。

```bash
dsh plugin --profile web add dsh-qapproval-timeout
```

重启 `dsh web` 后：

- `approval/request` 拦截由普通 host 插件直接挂载；
- 设置页“批准超时”直接可用；
- 不出现 `qaptm-*`，也没有 `run-*` 消息。

## 仓库

- GitHub：https://github.com/2128627267/dsh-qapproval-timeout
- Topic：`dsh-plugin`（发布时请在仓库设置里添加该 topic）

---
