# i18n 认证页面本地化修复设计

## 背景

GitHub Issue #136 指出：中文环境下登录页存在英文标题、按钮和校验错误文案。经全面审查，该问题同样存在于注册、忘记密码、重置密码、Magic Link 等所有认证页面。

## 目标

- 中文环境下所有认证页面不出现英文 UI 文案或技术化校验消息
- 英文环境保留完整英文文案
- 语言切换后所有文案跟随当前语言实时更新

## 问题清单

### 1. 页面标题/描述硬编码英文

| 文件                       | 硬编码内容                                                                      |
| -------------------------- | ------------------------------------------------------------------------------- |
| `login/page.tsx`           | `Log in to Kiyo`, `Welcome back`                                                |
| `register/page.tsx`        | `Sign up for Kiyo`, `Create your account`, `Already have an account?`, `Log in` |
| `forgot-password/page.tsx` | `Reset password`, `We'll send you a link...`, `Back to log in`                  |
| `reset-password/page.tsx`  | `Set new password`, `Enter your new password below`                             |

### 2. 表单组件硬编码

| 文件                      | 硬编码内容                                              |
| ------------------------- | ------------------------------------------------------- |
| `password-login-form.tsx` | 密码显示按钮 `Show` / `Hide`                            |
| `register-form.tsx`       | 密码显示按钮 `Show` / `Hide`、分隔符 `或`、用户协议文案 |
| `reset-password-form.tsx` | 密码显示按钮 `Show` / `Hide`、错误状态文案              |
| `login-form.tsx`          | OAuth 分隔符 `或`                                       |

### 3. Zod Schema 默认英文校验错误

`lib/schemas/auth.ts` 中所有 schema 使用 Zod 默认英文错误消息：

- `Invalid email`
- `String must contain at least 6 character(s)`
- `Passwords don't match`
- `termsRequired`（key 存在但 messages 中无对应翻译）

### 4. messages 文件损坏

`zh.json` 和 `en.json` 的 `nav` 节中嵌入了未解决的 git 冲突标记。

## 架构设计

### 方案选择：翻译注入 Schema（方案 B）

不引入新依赖，将 Zod schema 从静态对象改为接收翻译函数的工厂模式，使校验错误消息也能随语言切换。

### Schema 工厂模式

```typescript
// lib/schemas/auth.ts
export const getLoginSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email(t("errors.invalidEmail")),
    password: z.string().min(6, t("errors.passwordMin")),
    rememberMe: z.boolean().optional(),
  });
```

组件中使用：

```typescript
const t = useTranslations("auth");
const schema = getLoginSchema((key) => t(key));
const form = useForm({ resolver: zodResolver(schema) });
```

### 翻译键设计

新增以下翻译键（中英文 messages 同步添加）：

```
auth.login.hidePassword
auth.login.orSeparator
auth.register.hidePassword
auth.register.termsLabel        // 用户协议文案，支持 <privacy>Privacy Policy</privacy> 和 <terms>Terms of Service</terms> 占位符
auth.register.alreadyHaveAccount
auth.register.loginLink
auth.resetPassword.hidePassword
auth.resetPassword.invalidLink
auth.resetPassword.requestNewLink
auth.forgotPassword.backToLogin
auth.errors.termsRequired       // 注册时未勾选协议
```

## 修改范围

### 需要修改的文件

1. `apps/web/messages/zh.json` — 修复冲突标记，补充翻译键
2. `apps/web/messages/en.json` — 修复冲突标记，补充翻译键
3. `apps/web/src/lib/schemas/auth.ts` — 静态 schema → 工厂函数
4. `apps/web/src/app/[locale]/login/page.tsx` — 使用 `getTranslations` 替换硬编码
5. `apps/web/src/app/[locale]/register/page.tsx` — 使用 `getTranslations` 替换硬编码
6. `apps/web/src/app/[locale]/forgot-password/page.tsx` — 使用 `getTranslations` 替换硬编码
7. `apps/web/src/app/[locale]/reset-password/page.tsx` — 使用 `getTranslations` 替换硬编码
8. `apps/web/src/components/auth/login-form.tsx` — 分隔符使用翻译键
9. `apps/web/src/components/auth/password-login-form.tsx` — Show/Hide 使用翻译键
10. `apps/web/src/components/auth/register-form.tsx` — Show/Hide、分隔符、协议文案使用翻译键
11. `apps/web/src/components/auth/reset-password-form.tsx` — Show/Hide、错误文案使用翻译键

## 错误处理

- Zod 校验错误通过工厂函数注入翻译，不再显示技术化英文
- 服务端返回的错误（如 `invalid_credentials`）继续通过已有 `auth.errors.*` 键映射

## 测试策略

- 手动验证：中文和英文环境下分别检查所有认证页面
- 验证空表单提交时的错误提示语言
- 验证密码显示/隐藏按钮文案
- 验证语言切换后文案实时更新
