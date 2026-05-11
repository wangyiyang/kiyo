# Vercel Analytics 集成设计 (Issue #55)

## 背景
在 Vercel 上部署的 Next.js 应用需要收集页面浏览量（page views）和访客数（visitors）数据，以便了解网站流量。

## 目标
集成 Vercel Web Analytics，实现全环境自动追踪页面浏览和访客数据。

## 方案
采用 Vercel 官方推荐的 [Next.js 集成方案](https://vercel.com/docs/analytics/quickstart)（最简方案）。

### 步骤

1. **安装依赖**
   在 `apps/web` 中安装 `@vercel/analytics`：
   ```bash
   pnpm add @vercel/analytics
   ```

2. **添加 React 组件**
   在根 `app/layout.tsx` 的 `<body>` 内的 `</body>` 前直接引入 `<Analytics />` 组件：
   ```tsx
   import { Analytics } from "@vercel/analytics/next";
   // ...
   <body>
     <Providers>
       {children}
       <Toaster ... />
     </Providers>
     <Analytics />
   </body>
   ```

3. **无需环境判断**
   用户要求全环境（包括本地开发、Preview、Production）均启用，因此不做 `VERCEL_ENV` 条件渲染。

### 为什么放在根 layout
- Vercel Analytics 的 `<Analytics />` 组件内部会自动去重并绑定路由变化事件，放在根 layout 即可覆盖所有页面（包括 `app/[locale]/*` 下的路由）。
- 放在根 layout 而非 locale layout，避免 next-intl 的客户端 provider 重新挂载时可能导致的边缘问题。

### 为什么不做额外封装
- 当前只需要基础的页面浏览统计，没有自定义事件追踪需求。
- 最简方案代码最少、维护成本最低。若未来需要自定义事件追踪，可再考虑封装 Analytics Provider。

## 验收标准
- [ ] `pnpm build` 成功，TypeScript 无报错
- [ ] 部署后访问站点，Vercel Dashboard → Analytics 中能在 30 秒内看到数据
- [ ] 切换页面时，Analytics 能正确追踪不同路径的浏览量

## 风险与注意事项
- 内容拦截器（ad blocker）可能会阻止 Analytics 脚本加载，这是预期行为，无法规避。
- 本地开发也会向 Vercel 发送数据，数据量极小，不影响使用。
