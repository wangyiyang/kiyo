# Issue #90: 登录页和注册页缺少导航栏

**日期**: 2026-05-09
**状态**: 已批准

## 问题描述

登录页 (`/login`) 和注册页 (`/register`) 缺少导航栏，无法切换主题和语言。

## 根因分析

- `/login` 和 `/register` 页面位于 `app/` 根目录下
- 它们不通过 `[locale]/layout.tsx` 渲染
- 因此没有 `<SiteHeader />` 组件

## 解决方案

在两个页面中添加 `<SiteHeader />` 组件，与首页导航栏保持一致。

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `apps/web/src/app/login/page.tsx` | 在 `AuthGuard` 包装前添加 `<SiteHeader />` |
| `apps/web/src/app/register/page.tsx` | 在 `AuthGuard` 包装前添加 `<SiteHeader />` |

### 预期效果

- `/login` 和 `/register` 显示与首页一致的导航栏
- 支持主题切换（浅色/深色）
- 支持语言切换（中文/英文）
- 未登录用户显示 "Log in" 按钮

## 验证方式

1. 访问 `http://localhost:3000/zh/login` 确认导航栏显示
2. 访问 `http://localhost:3000/en/register` 确认导航栏显示
3. 测试主题切换功能
4. 测试语言切换功能