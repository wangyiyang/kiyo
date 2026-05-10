# 合规页面设计规范

**日期**: 2026-05-10  
**状态**: 已批准  
**Issue**: #53

## 概述

为满足公测阶段法律合规要求，创建隐私政策（Privacy Policy）和用户协议（Terms of Service）页面，并更新 Footer 和注册表单。

## 路由结构

```
apps/web/src/app/
├── [locale]/                    # 多语言路由组
│   ├── privacy/
│   │   └── page.tsx            # /[locale]/privacy
│   └── terms/
│       └── page.tsx            # /[locale]/terms
└── register/                    # 现有注册页（无 locale 前缀）
    └── page.tsx
```

## 组件设计

| 组件 | 职责 |
|------|------|
| `LegalPage` | 通用布局：顶部标题 + 滚动内容区 + 最后更新日期 |
| `PrivacyPolicy` | 渲染隐私政策正文 |
| `TermsOfService` | 渲染用户协议正文 |

## Footer 更新

文件: `apps/web/src/components/site-footer.tsx`

```tsx
about: [
  { href: '#', key: 'team' },
  { href: '#', key: 'contact' },
  { href: `/${locale}/privacy`, key: 'privacy' },
  { href: `/${locale}/terms`, key: 'terms' },
]
```

新增 i18n key: `footer.groups.about.links.terms`

## 注册表单更新

1. Zod schema 添加 `termsAccepted: z.boolean().refine(val => val === true, ...)`
2. RegisterForm 组件添加 Checkbox + 协议链接
3. 提交前校验是否已勾选

## 页面内容

### 隐私政策
- 信息收集（邮箱、创作内容、使用数据）
- 信息使用（服务提供、个性化、AI 模型训练）
- 信息存储（Supabase、第三方服务）
- 第三方服务（AI 服务商 Minimax）
- 用户权利（访问、更正、删除）
- 安全措施
- 联系方式

### 用户协议
- 服务范围描述
- 用户账户（注册、年龄限制）
- 用户内容版权
- 禁止行为
- 服务变更/中断
- 免责声明
- 账号终止
- 适用法律

## 实现步骤

1. 创建 `/privacy` 和 `/terms` 页面
2. 更新 Footer 链接 + i18n
3. 更新注册表单 schema + UI
4. 验证路由 + 中英文切换