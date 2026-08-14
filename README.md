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

## 动态插件加载

`host.js` + `client.js` 为 Cordis 动态插件代码（函数体）。在会话中用 cordis_define / cordis_run 加载（client 半部需用户批准）。

## 持久安装

```bash
npx dsh plugin --profile web add <本目录>
```

然后在 `profiles/web/cordis.patch.yml` 追加：

```yaml
- id: approval-timeout
  name: 'dsh-approval-timeout'
```
