# 首页 CTA 认证状态差异化设计（Issue #162）

## 背景与问题

登录用户回到首页后，首屏 Hero 主按钮和底部 FinalCta 仍然是「加入 Waitlist」和邮箱采集表单。对于已有账号、且能进入创作工作台的用户，该 CTA 与当前用户状态不匹配，容易造成"我到底是否已获得使用权限"的困惑。

## 目标

- 已登录用户访问首页时，主 CTA 指向工作台（`/dashboard`）。
- 未登录用户仍完整展示 Waitlist/注册转化入口。
- 改动最小化，避免闪烁和过度重构。

## 方案选择

采用**服务端标志 + 客户端差异化渲染**（方案 A）。

| 维度 | 方案 A（选中） | 方案 B（纯客户端检测） | 方案 C（完全分路由） |
|------|---------------|---------------------|-------------------|
| 首屏闪烁 | 无 | 明显 | 无（重定向） |
| 代码侵入 | 低 | 中 | 高 |
| 保留首页展示价值 | 是 | 是 | 否 |
| 维护成本 | 低 | 中 | 高 |

## 架构与数据流

```
page.tsx (Server Component)
  ├─ supabase.auth.getUser()
  ├─ isAuthenticated: boolean
  ├─ Hero({ isAuthenticated })
  └─ FinalCta({ isAuthenticated })
```

### 认证状态检测

- 在 `apps/web/src/app/[locale]/page.tsx` 中通过 `createServerClient` 调用 `supabase.auth.getUser()`。
- 将 `isAuthenticated: !!user` 作为可选 prop 传递给 `Hero` 和 `FinalCta`。
- **边缘情况**：`getUser()` 返回 `null` 或 Supabase 异常时，按未登录渲染（保守降级）。

## 组件改动

### Hero

- 新增可选接口：`HeroProps { isAuthenticated?: boolean }`（默认 `false`，向后兼容）。
- 主 CTA 条件渲染：
  - 未登录：`Button` 触发 `show()`（打开 Waitlist Dialog），文案 `hero.cta.primary`
  - 已登录：`Button asChild` 包裹 `Link href="/dashboard"`，文案 `hero.cta.primaryAuthenticated`
- 次 CTA 不变（锚链 `#features`）。

### FinalCta

- 新增可选接口：`FinalCtaProps { isAuthenticated?: boolean }`。
- 条件渲染：
  - 未登录：现有 `ScrollReveal + InlineWaitlistForm`
  - 已登录：激励文案 + 「进入控制台」按钮（跳转 `/dashboard`）

## 文案与 i18n

### 新增 key（zh.json）

```json
{
  "hero": {
    "cta": {
      "primaryAuthenticated": "进入控制台"
    }
  },
  "finalCta": {
    "authenticated": {
      "headline": "欢迎回来，继续创作",
      "description": "你的下一段旋律在等你。",
      "cta": "进入控制台"
    }
  }
}
```

### 对应 en.json

```json
{
  "hero": {
    "cta": {
      "primaryAuthenticated": "Go to Dashboard"
    }
  },
  "finalCta": {
    "authenticated": {
      "headline": "Welcome back, keep creating",
      "description": "Your next melody is waiting.",
      "cta": "Go to Dashboard"
    }
  }
}
```

## 测试策略

1. **单元测试**：
   - `Hero`：`isAuthenticated={true}` 时渲染「进入控制台」且 `href="/dashboard"`
   - `FinalCta`：`isAuthenticated={true}` 时不渲染 `InlineWaitlistForm`，而是显示已登录文案和按钮
2. **端到端（Playwright，可选）**：登录后访问首页，断言 CTA 文案已切换

## 影响范围

| 文件 | 改动类型 |
|------|---------|
| `apps/web/src/app/[locale]/page.tsx` | 新增 `getUser()` 调用，向下传 prop |
| `apps/web/src/components/sections/hero.tsx` | 新增 `isAuthenticated` prop，条件渲染主 CTA |
| `apps/web/src/components/sections/final-cta.tsx` | 新增 `isAuthenticated` prop，条件渲染内容 |
| `apps/web/messages/zh.json` | 新增 i18n key |
| `apps/web/messages/en.json` | 新增 i18n key |
| `apps/web/src/components/sections/hero.test.tsx`（如有）| 新增测试用例 |
| `apps/web/src/components/sections/final-cta.test.tsx`（如有）| 新增测试用例 |

## 风险与降级

- **服务端认证检测延迟**：`getUser()` 在 Server Component 中同步执行，无额外网络往返，无性能风险。
- **Session 失效边缘情况**：若用户 Session 刚好失效但 Cookie 仍存在，`getUser()` 返回 `null`，按未登录渲染。用户点击「进入控制台」后会被 `DashboardPage` 的 `redirect('/login')` 处理，体验一致。
- **接口向后兼容**：`isAuthenticated` 为可选 prop，不影响现有调用方（如 Storybook、测试）。

## 验收标准

- [ ] 登录用户访问首页时，Hero 主按钮文案为「进入控制台」且点击跳转 `/dashboard`。
- [ ] 登录用户访问首页时，FinalCta 不展示 Waitlist 表单，而是展示已登录文案和按钮。
- [ ] 未登录用户首页保持原有 Waitlist CTA 和表单不变。
- [ ] 中英文切换时文案正确。
- [ ] 单元测试覆盖两种认证状态的渲染差异。
