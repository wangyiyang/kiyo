# Issue 193 设计文档：修复设置页面语言切换不生效

## 背景

在设置页面（`/settings`）使用 `LocaleSwitcher` 切换语言后，页面文字没有变化。该页面是一个 Server Component，使用 `getTranslations` 获取翻译。

## 问题根因

当前 `LocaleSwitcher` 使用自定义 `useSetLocale()`（来自 `@/i18n/client`）进行语言切换。该自定义 Provider 做了以下事情：

1. 动态 `import()` 加载 messages
2. 手动设置 `document.cookie`
3. 更新自定义 React Context 的 state
4. 调用 `router.refresh()`

这引入了多重问题：
- **自定义 state 与 `next-intl` 官方机制冲突**：`LocaleProvider` 维护了一套独立的 locale/messages state，而 `NextIntlClientProvider` 从服务端获取另一套。RSC 刷新时两者可能不同步。
- **`useEffect` 同步循环风险**：`LocaleProvider` 在 mount 时读取 cookie，若与 state 不一致会再次调用 `setLocale()`，在 `router.refresh()` 后可能导致额外的状态抖动。
- **无其他组件依赖自定义 Provider**：`useSetLocale` 仅在 `LocaleSwitcher` 一处使用，删除它没有副作用。

## 设计方案

### 核心思路

**移除自定义 `LocaleProvider`**，将语言切换委托给 `next-intl` 官方导航机制。简化后的架构：

```
用户点击语言选项
    ↓
LocaleSwitcher 调用 router.replace(pathname, { locale: 'en' })
    ↓
next-intl 自动设置 cookie + 调用 router.refresh()
    ↓
Middleware 读取 cookie → rewrite 到 /en/settings
    ↓
LocaleLayout 重新执行 → getMessages('en')
    ↓
NextIntlClientProvider 接收新 locale + messages
    ↓
所有客户端组件自动刷新翻译
```

### 文件改动

#### 1. `apps/web/src/components/LocaleSwitcher.tsx`

- 移除 `useSetLocale` 导入
- 新增 `useRouter`、`usePathname`（来自 `@/i18n/navigation`）
- `handleChange` 改为 `router.replace(pathname, { locale: nextLocale })`

#### 2. `apps/web/src/i18n/client.tsx`

- **删除整个文件**。`LocaleProvider`、`useSetLocale`、`useMessages`、`useIsLocaleLoading` 均无其他引用。

#### 3. `apps/web/src/app/[locale]/layout.tsx`

- 移除 `LocaleProvider` 导入及包装层
- 保留 `NextIntlClientProvider`（客户端组件仍然依赖它）

### 数据流

| 步骤 | 操作 | 负责方 |
|------|------|--------|
| 1 | 用户点击语言项 | UI |
| 2 | `router.replace(path, { locale })` | `LocaleSwitcher` |
| 3 | 设置 `NEXT_LOCALE` cookie + `router.refresh()` | `next-intl` |
| 4 | Middleware 解析 cookie 并 rewrite | `next-intl` middleware |
| 5 | `params.locale` 更新 | Next.js routing |
| 6 | `getMessages()` + `getTranslations()` | `next-intl` server |
| 7 | `NextIntlClientProvider` props 更新 | `LocaleLayout` |
| 8 | 客户端组件翻译刷新 | React + `next-intl` |

### 错误处理

- `router.replace()` 理论上不会失败，但为防万一包裹 `try/catch`
- 若出现极端异常，fallback 到 `window.location.reload()`（硬刷新始终可靠）

### 测试验证

1. **单元测试**：`LocaleSwitcher` 点击后调用 `router.replace` 并传入正确 `locale` 参数
2. **手动验证**：在 `/settings` 页面切换语言，确认：
   - 页面标题、表单标签、按钮文字全部更新
   - `NEXT_LOCALE` cookie 值正确
   - 刷新页面后语言保持

## 影响范围

- `LocaleSwitcher`：核心改动
- `i18n/client.tsx`：删除
- `app/[locale]/layout.tsx`：移除 `LocaleProvider` 包装
- **无其他组件受影响**：经全仓库 grep 确认，`useSetLocale` / `useMessages` / `useIsLocaleLoading` / `LocaleProvider` 无其他引用。
