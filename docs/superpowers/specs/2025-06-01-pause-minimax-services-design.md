# 暂停 MiniMax AI 服务及用户注册 — 设计文档

## 背景

受 MiniMax 套餐调整影响，需要临时暂停所有涉及 MiniMax API 的 AI 生成功能，同时暂停新用户注册。现有用户仍可正常登录、浏览和收听已生成的音乐。

## 暂停范围

### 需暂停的 AI 生成服务

| 服务 | 前端页面 | API 路由 | MiniMax 调用 |
|------|---------|---------|-------------|
| 新建歌曲（AI 生成音乐） | `/songs/new` | `POST /api/songs/generate` | `generateMusic` |
| 歌曲重生成 | 歌曲详情页 | `POST /api/songs/[id]/generate` | `generateMusic` |
| AI 翻唱 / 封面生成 | `/songs/cover` | `POST /api/songs/cover` | `generateCover` |
| AI 歌词生成 | `/lyrics/generate` | `POST /api/lyrics/generate` | `generateLyrics`（含 fallback） |
| 任务重试 | 歌曲详情页 | `POST /api/tasks/retry` | 触发 `triggerGenerationWorker` |

### 需暂停的用户注册

| 入口 | 位置 | 说明 |
|------|------|------|
| 邮箱注册 | `/register` 页面 + `signUp` action | 直接拦截 |
| OAuth 注册 | `/register` 页面 OAuth 按钮 | 注册页整体禁用，OAuth 入口不可见 |

### 不受影响的功能

- 用户登录 / 登出
- 浏览和收听音乐（播放、下载、导出）
- 浏览已有歌曲、歌词、专辑
- 手动创建歌词（非 AI 生成）
- 个人设置

## 设计方案

### 总体策略

采用 **前端禁用 + API 硬拦截 + 多语言公告** 的组合策略：

1. **前端**：在所有受影响页面顶部显示醒目的暂停公告横幅，禁用相关表单和按钮
2. **API**：在 6 个 API 入口最开头直接返回 `503 Service Unavailable`，避免任何 MiniMax 调用
3. **多语言**：公告文案通过 `next-intl` 的翻译文件管理，支持 zh/en/ja/ko

### 可复用暂停公告组件

新建 `apps/web/src/components/service-paused-banner.tsx`：

- 接受 `type: 'generate' | 'register'` 参数
- 使用琥珀色警告样式（`AlertTriangle` + amber 配色）
- 从 `common.servicePaused.*` 读取多语言文案

### API 拦截

在以下 6 个 API 入口的最开头插入统一拦截逻辑：

```ts
return NextResponse.json(
  { error: { code: 'SERVICE_PAUSED', message: t('servicePaused.message') } },
  { status: 503 }
)
```

- `apps/web/src/app/api/songs/generate/route.ts`
- `apps/web/src/app/api/songs/[id]/generate/route.ts`
- `apps/web/src/app/api/songs/cover/route.ts`
- `apps/web/src/app/api/lyrics/generate/route.ts`
- `apps/web/src/app/api/tasks/retry/route.ts`

### 注册拦截

- `apps/web/src/app/actions/auth.ts` 的 `signUp` 函数开头直接返回错误
- `apps/web/src/app/[locale]/(site)/register/page.tsx` 显示暂停公告，禁用 `RegisterForm`

### 前端入口调整

| 页面 | 改动 |
|------|------|
| `/songs/new` | 添加暂停公告，禁用 `SongCreateForm` |
| `/songs/cover` | 添加暂停公告，禁用整个表单区域 |
| `/lyrics/generate` | 添加暂停公告，禁用表单 |
| `/register` | 添加暂停公告，禁用 `RegisterForm` 和 OAuth 按钮 |
| 歌曲列表页 | 禁用"新建歌曲"和"翻唱"按钮（置灰或隐藏） |
| 歌词列表页 | 禁用"AI 生成歌词"按钮（置灰或隐藏） |
| 歌曲详情页 | 禁用"AI 翻唱"按钮，隐藏/禁用重试按钮 |

### 多语言文案

在 `apps/web/messages/{zh,en,ja,ko}.json` 的 `common` 命名空间下新增：

```json
"servicePaused": {
  "title": "服务暂停",
  "message": "AI 生成服务暂停中，您仍可正常浏览和收听音乐。",
  "registerTitle": "注册暂停",
  "registerMessage": "新用户注册暂停中。"
}
```

各语言版本保持语义一致。

## 恢复策略

恢复时只需回滚本次修改即可。由于改动集中在特定文件和代码块，不涉及架构变更或数据库迁移，回滚成本极低。本次为无限期暂停，无恢复时间表。

## 风险与影响

| 风险 | 缓解措施 |
|------|---------|
| API 被绕过直接调用 | API 层已做硬拦截 |
| 用户困惑 | 前端显示明确的多语言公告 |
| 恢复时遗漏某处 | 改动点集中，恢复时按 commit diff 回滚即可 |
