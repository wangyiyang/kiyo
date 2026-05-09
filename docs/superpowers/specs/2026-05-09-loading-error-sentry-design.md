# Loading、错误边界与 Sentry 接入设计

## 目的与结论

将 GitHub Issue #68 和 #54 并案处理：补齐 Next.js App Router 的加载态、错误边界和生产错误监控基础能力，降低页面白屏和生产问题不可观测的风险。

本次采用中等范围方案：一次交付用户可见的 loading/error 体验和 `@sentry/nextjs` 基础接入，并为关键失败点增加显式上报；不做全量 API route 中间件重构，避免改变现有响应语义。

## 背景

当前应用存在三类缺口：

1. App Router 缺少 `loading.tsx`，数据获取期间容易出现白屏。
2. 根布局缺少 `global-error.tsx`，根布局异常时没有友好降级。
3. 生产环境缺少集中式错误监控，关键异常主要停留在本地 `console.error` 或未显式捕获。

仓库现状：

- 已存在 `apps/web/src/app/error.tsx` 和 `apps/web/src/app/[locale]/error.tsx`，但实现重复，且没有真正接入 Sentry。
- 未发现 `@sentry/nextjs` 依赖。
- `apps/web/src/app/songs/page.tsx` 和 `apps/web/src/app/albums/page.tsx` 是主要数据密集型列表页，适合添加局部 loading skeleton。
- Issue #54 仍处于 open 状态，可与 #68 在一个 PR 中关闭。

## 方案

### 1. Sentry 基础接入

在 `apps/web` 安装 `@sentry/nextjs`，新增以下文件：

- `apps/web/src/instrumentation.ts`
- `apps/web/src/instrumentation-client.ts`
- `apps/web/sentry.server.config.ts`
- `apps/web/sentry.edge.config.ts`

配置原则：

- DSN 使用 `NEXT_PUBLIC_SENTRY_DSN`。
- 未配置 DSN 时不发送事件，允许本地和未接入环境正常运行。
- 环境使用 `NEXT_PUBLIC_VERCEL_ENV`、`VERCEL_ENV` 或 `NODE_ENV` 派生。
- trace sample rate 在开发环境可高一些，生产环境保持保守值，避免公测阶段费用和噪声过高。
- source map 上传通过 `SENTRY_AUTH_TOKEN`、`SENTRY_ORG`、`SENTRY_PROJECT` 控制，密钥不进入仓库。

`next.config.js` 使用 `withSentryConfig` 包裹现有 `next-intl` 配置，并保留现有安全响应头。因为本仓库使用 Next.js 14.2.35，Sentry 文档中依赖 Next.js 15 的 `onRequestError` 不作为本次验收前提。

### 2. 错误边界与错误 UI

抽出一个轻量复用组件承载错误反馈 UI：

- `apps/web/src/components/error-boundary-page.tsx`

使用位置：

- `apps/web/src/app/error.tsx`
- `apps/web/src/app/[locale]/error.tsx`
- `apps/web/src/app/global-error.tsx`

行为要求：

- `error.tsx` 和 `[locale]/error.tsx` 保持 Client Component，调用 `reset()` 支持重试。
- `global-error.tsx` 必须包含 `<html>` 和 `<body>`，符合 App Router 规则。
- 错误边界触发时调用 Sentry 捕获异常，并带上边界来源标签。
- 用户界面提供“重试”和“返回首页”，避免暴露原始错误 message；如存在 `digest`，显示短错误 ID 便于排查。
- `[locale]/error.tsx` 返回首页时优先回到当前 locale 首页；根级错误页回到 `/`。

### 3. 加载态

新增通用和局部 loading：

- `apps/web/src/app/loading.tsx`
- `apps/web/src/app/songs/loading.tsx`
- `apps/web/src/app/albums/loading.tsx`

实现原则：

- 复用 `@kiyo/ui` 的 `Skeleton`。
- 全局 loading 提供居中的通用页面骨架。
- 歌曲列表 loading 对齐 `SongCard` 的三列卡片网格。
- 专辑列表 loading 对齐 `AlbumCard` 的封面、标题、描述和数量结构。
- loading 组件不引入客户端状态，保持 Server Component 默认行为。

如骨架存在重复结构，可在 `apps/web/src/components/loading-skeletons.tsx` 内提取小组件，避免把重复 JSX 分散到多个 route 文件。

### 4. 关键业务异常上报

新增薄封装：

- `apps/web/src/lib/monitoring.ts`

封装职责：

- 对 `Sentry.captureException` 做轻量包装。
- 支持传入标签和额外上下文。
- 在无 DSN 或 SDK 未发送时保持无业务副作用。

本次接入当前关键失败点：

- waitlist 写入失败。
- AI 歌词生成失败。
- AI 歌曲生成失败。
- 歌曲/专辑封面生成或存储失败。

不在本次重构所有 33 个 API/action 文件。后续若要统一 API 捕获，可在单独 PR 中引入 route handler 包装器。

## 影响与风险

### 用户体验影响

- 页面跳转和数据加载期间有可见 skeleton，减少白屏感。
- 页面渲染异常时展示可恢复错误页，而不是完整白屏。
- 根布局异常时有全局兜底页面。

### 运维影响

- 配置 DSN 后，前端错误边界和关键业务失败会进入 Sentry。
- 未配置 DSN 时功能不受影响，只是不发送事件。
- source map 上传依赖 CI 环境变量；未配置 token 时不应阻断本地开发。

### 技术风险

- `withSentryConfig` 与现有 `next-intl` 插件需要按正确顺序组合。
- CSP 的 `connect-src` 目前只允许 self 和 Supabase。若 Sentry DSN 指向 `sentry.io`，需要允许 Sentry ingest 域名，否则浏览器端上报可能被 CSP 拦截。
- `global-error.tsx` 替换根布局，不能依赖根 layout 注入的 provider；样式需显式导入或使用最小可用结构。
- Next.js 14 不应使用文档中 Next.js 15-only 的 `onRequestError` 作为强制能力。

## 验收标准

功能验收：

- `app/loading.tsx`、`app/global-error.tsx`、`songs/loading.tsx`、`albums/loading.tsx` 存在并可正常编译。
- `app/error.tsx`、`app/[locale]/error.tsx` 和 `global-error.tsx` 均调用统一错误 UI。
- 错误页提供重试和返回首页操作。
- 错误边界和关键失败点调用统一监控封装。
- `.env.local.example` 记录 Sentry 相关环境变量，不包含真实密钥。

验证命令：

- `pnpm --filter web test`
- `pnpm --filter web type-check`
- `pnpm --filter web lint`

测试要求：

- 先写失败测试再实现。
- 覆盖错误 UI 的按钮、digest 展示和捕获调用。
- 覆盖 loading skeleton 的关键结构。
- 覆盖监控封装在有上下文时调用 Sentry。

## 不做范围

- 不接入 Slack/Email 告警；这是 Sentry 项目配置层面的工作。
- 不改造全部 API route 为统一错误处理包装器。
- 不引入用户可配置的错误详情展开面板。
- 不在本 PR 中解决所有现存 API catch 分支的错误语义问题。

## 参考

- Issue #68: 缺少 `loading.tsx` / `error.tsx`，页面白屏无反馈。
- Issue #54: 生产环境错误监控（Sentry）。
- Next.js 14 App Router 规则：`global-error.tsx` 必须是 Client Component，并包含 `<html>` 和 `<body>`。
- Sentry Next.js 手动接入文档：DSN 未设置时 SDK 不发送事件；Next.js 15 的 `onRequestError` 不适用于当前 Next.js 14 验收。
