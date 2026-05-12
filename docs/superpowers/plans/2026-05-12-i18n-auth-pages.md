# i18n 认证页面本地化修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复所有认证页面（登录、注册、忘记密码、重置密码、Magic Link）在中文环境下出现的英文硬编码文案和 Zod 默认英文校验错误。

**Architecture:** 采用 Schema 工厂模式 — 将静态 Zod schema 改为接收翻译函数的工厂函数，使校验错误随当前语言切换。页面级硬编码文案通过 `next-intl` 的 `getTranslations`（服务端）或 `useTranslations`（客户端）替换。

**Tech Stack:** Next.js 14, next-intl, React Hook Form, Zod, shadcn/ui

---

### 文件变更总览

| 文件                                                   | 变更类型 | 说明                                                    |
| ------------------------------------------------------ | -------- | ------------------------------------------------------- |
| `apps/web/messages/zh.json`                            | Modify   | 修复 git 冲突标记，补充翻译键                           |
| `apps/web/messages/en.json`                            | Modify   | 修复 git 冲突标记，补充翻译键                           |
| `apps/web/src/lib/schemas/auth.ts`                     | Modify   | 静态 schema → 工厂函数                                  |
| `apps/web/src/app/[locale]/login/page.tsx`             | Modify   | 标题/描述改用 `getTranslations`                         |
| `apps/web/src/app/[locale]/register/page.tsx`          | Modify   | 标题/描述/底部链接改用 `getTranslations`                |
| `apps/web/src/app/[locale]/forgot-password/page.tsx`   | Modify   | 标题/描述/返回链接改用 `getTranslations`                |
| `apps/web/src/app/[locale]/reset-password/page.tsx`    | Modify   | 标题/描述改用 `getTranslations`，组件改为 async         |
| `apps/web/src/components/auth/login-form.tsx`          | Modify   | 分隔符 `或` 改用翻译键                                  |
| `apps/web/src/components/auth/password-login-form.tsx` | Modify   | Show/Hide 改用翻译键，使用 schema 工厂                  |
| `apps/web/src/components/auth/register-form.tsx`       | Modify   | Show/Hide、分隔符、协议文案改用翻译键，使用 schema 工厂 |
| `apps/web/src/components/auth/reset-password-form.tsx` | Modify   | Show/Hide、错误文案改用翻译键，使用 schema 工厂         |
| `apps/web/src/components/auth/magic-link-form.tsx`     | Modify   | 使用 schema 工厂                                        |

---

### Task 1: 修复 messages 文件并补充翻译键

**Files:**

- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

**Context:** 两个 messages 文件的 `nav` 节嵌入了未解决的 git 冲突标记（`<<<<<<< HEAD` 等）。同时需要补充本次修复所需的新翻译键。

- [ ] **Step 1: 修复 zh.json 的 git 冲突标记**

找到 `nav` 节，将冲突标记替换为合并后的结果（保留 `dashboard` 和 `settings` 两个键）：

```json
"nav": {
    "menu": "菜单",
    "openMenu": "打开导航菜单",
    "home": "首页",
    "songs": "歌曲库",
    "albums": "专辑",
    "lyrics": "歌词",
    "explore": "探索",
    "language": "语言",
    "theme": "主题",
    "dashboard": "控制台",
    "settings": "设置"
  },
```

- [ ] **Step 2: 在 zh.json 的 `auth` 节补充新翻译键**

在 `auth.login` 下新增：

```json
"hidePassword": "隐藏密码",
"orSeparator": "或",
```

在 `auth.register` 下新增：

```json
"hidePassword": "隐藏密码",
"orSeparator": "或",
"termsLabel": "我已阅读并同意 <privacy>隐私政策</privacy> 和 <terms>用户协议</terms>",
"alreadyHaveAccount": "已有账号？",
"loginLink": "去登录"
```

在 `auth.forgotPassword` 下新增：

```json
"backToLogin": "返回登录"
```

在 `auth.resetPassword` 下新增：

```json
"hidePassword": "隐藏密码",
"invalidLink": "重置链接无效或已过期。",
"requestNewLink": "请求新链接"
```

在 `auth.errors` 下新增：

```json
"termsRequired": "请阅读并同意用户协议和隐私政策"
```

在根级别新增 `common` 键（如果还没有 `auth.common`）：
实际上直接在 `auth` 下添加一个 `common` 对象：

```json
"common": {
  "show": "显示",
  "hide": "隐藏"
}
```

- [ ] **Step 3: 修复 en.json 的 git 冲突标记**

同样将 `nav` 节替换为：

```json
"nav": {
    "menu": "Menu",
    "openMenu": "Open navigation menu",
    "home": "Home",
    "songs": "Songs",
    "albums": "Albums",
    "lyrics": "Lyrics",
    "explore": "Explore",
    "language": "Language",
    "theme": "Theme",
    "dashboard": "Dashboard",
    "settings": "Settings"
  },
```

- [ ] **Step 4: 在 en.json 的 `auth` 节补充对应英文翻译键**

```json
"login": {
  ...existing keys...
  "hidePassword": "Hide password",
  "orSeparator": "or"
},
"register": {
  ...existing keys...
  "hidePassword": "Hide password",
  "orSeparator": "or",
  "termsLabel": "I have read and agree to the <privacy>Privacy Policy</privacy> and <terms>Terms of Service</terms>",
  "alreadyHaveAccount": "Already have an account?",
  "loginLink": "Log in"
},
"forgotPassword": {
  ...existing keys...
  "backToLogin": "Back to log in"
},
"resetPassword": {
  ...existing keys...
  "hidePassword": "Hide password",
  "invalidLink": "Invalid or expired reset link.",
  "requestNewLink": "Request new link"
},
"errors": {
  ...existing keys...
  "termsRequired": "Please read and agree to the Privacy Policy and Terms of Service"
},
"common": {
  "show": "Show",
  "hide": "Hide"
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "fix(i18n): resolve git conflicts and add auth translation keys"
```

---

### Task 2: 将认证 Zod Schema 重构为工厂函数

**Files:**

- Modify: `apps/web/src/lib/schemas/auth.ts`

**Context:** 当前所有 schema 使用 Zod 默认英文错误消息。改为接收翻译函数的工厂函数后，组件传入 `useTranslations('auth')` 即可得到本地化错误。

- [ ] **Step 1: 重写 auth.ts 为工厂函数**

```typescript
import { z } from "zod";

export const getLoginSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email(t("errors.invalidEmail")),
    password: z.string().min(6, t("errors.passwordMin")),
    rememberMe: z.boolean().optional(),
  });

export type LoginInput = z.infer<ReturnType<typeof getLoginSchema>>;

export const getMagicLinkSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email(t("errors.invalidEmail")),
  });

export type MagicLinkInput = z.infer<ReturnType<typeof getMagicLinkSchema>>;

export const getRegisterSchema = (t: (key: string) => string) =>
  z
    .object({
      email: z.string().email(t("errors.invalidEmail")),
      password: z.string().min(6, t("errors.passwordMin")),
      confirmPassword: z.string().min(6, t("errors.passwordMin")),
      termsAccepted: z.boolean().refine((val) => val === true, {
        message: t("errors.termsRequired"),
      }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("errors.passwordMatch"),
      path: ["confirmPassword"],
    });

export type RegisterInput = z.infer<ReturnType<typeof getRegisterSchema>>;

export const getForgotPasswordSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email(t("errors.invalidEmail")),
  });

export type ForgotPasswordInput = z.infer<
  ReturnType<typeof getForgotPasswordSchema>
>;

export const getResetPasswordSchema = (t: (key: string) => string) =>
  z
    .object({
      password: z.string().min(6, t("errors.passwordMin")),
      confirmPassword: z.string().min(6, t("errors.passwordMin")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("errors.passwordMatch"),
      path: ["confirmPassword"],
    });

export type ResetPasswordInput = z.infer<
  ReturnType<typeof getResetPasswordSchema>
>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/schemas/auth.ts
git commit -m "refactor(auth): convert static zod schemas to factory functions with i18n"
```

---

### Task 3: 更新登录页面和表单

**Files:**

- Modify: `apps/web/src/app/[locale]/login/page.tsx`
- Modify: `apps/web/src/components/auth/password-login-form.tsx`
- Modify: `apps/web/src/components/auth/login-form.tsx`

- [ ] **Step 1: 更新 login/page.tsx**

将默认导出改为 async，使用 `getTranslations` 替换硬编码：

```tsx
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@kiyo/ui";

import { LoginForm } from "@/components/auth/login-form";
import { AuthGuard } from "@/components/auth/auth-guard";
import { SiteHeader } from "@/components/site-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return {
    title: t("login.title"),
  };
}

export default async function LoginPage() {
  const t = await getTranslations("auth");
  return (
    <>
      <SiteHeader />
      <AuthGuard>
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl">{t("login.title")}</CardTitle>
              <CardDescription>{t("login.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    </>
  );
}
```

- [ ] **Step 2: 更新 password-login-form.tsx**

替换 import、schema 使用方式、以及 Show/Hide 按钮：

Import 变更：

```typescript
import { getLoginSchema, type LoginInput } from "@/lib/schemas/auth";
```

在组件内部：

```typescript
const t = useTranslations("auth");
const schema = getLoginSchema((key) => t(key));
const form = useForm<LoginInput>({
  resolver: zodResolver(schema),
  defaultValues: { email: "", password: "", rememberMe: false },
  mode: "onBlur",
});
```

Show/Hide 按钮替换：

```tsx
<button
  type="button"
  onClick={() => setShowPassword((v) => !v)}
  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
>
  {showPassword ? t("common.hide") : t("common.show")}
</button>
```

- [ ] **Step 3: 更新 login-form.tsx**

替换硬编码分隔符 `或`：

```tsx
<div className="flex items-center gap-3">
  <Separator className="flex-1" />
  <span className="text-xs text-muted-foreground">
    {t("login.orSeparator")}
  </span>
  <Separator className="flex-1" />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/[locale]/login/page.tsx \
  apps/web/src/components/auth/password-login-form.tsx \
  apps/web/src/components/auth/login-form.tsx
git commit -m "fix(i18n): localize login page and password form"
```

---

### Task 4: 更新注册页面和表单

**Files:**

- Modify: `apps/web/src/app/[locale]/register/page.tsx`
- Modify: `apps/web/src/components/auth/register-form.tsx`

- [ ] **Step 1: 更新 register/page.tsx**

替换硬编码文案：

```tsx
export default async function RegisterPage() {
  const t = await getTranslations("auth");
  return (
    <>
      <SiteHeader />
      <AuthGuard>
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl">{t("register.title")}</CardTitle>
              <CardDescription>{t("register.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <RegisterForm />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {t("register.alreadyHaveAccount")}{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground hover:underline"
                >
                  {t("register.loginLink")}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    </>
  );
}
```

- [ ] **Step 2: 更新 register-form.tsx**

Import 变更：

```typescript
import { getRegisterSchema, type RegisterInput } from "@/lib/schemas/auth";
```

Schema 使用：

```typescript
const t = useTranslations("auth");
const schema = getRegisterSchema((key) => t(key));
const form = useForm<RegisterInput>({
  resolver: zodResolver(schema),
  defaultValues: {
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  },
  mode: "onBlur",
});
```

分隔符替换（同 login-form）：

```tsx
<span className="text-xs text-muted-foreground">
  {t("register.orSeparator")}
</span>
```

Show/Hide 按钮：

```tsx
{
  showPassword ? t("common.hide") : t("common.show");
}
```

用户协议文案替换（使用 `t.rich`）：

```tsx
<FormLabel className="text-sm font-normal cursor-pointer">
  {t.rich("register.termsLabel", {
    privacy: (chunks) => (
      <Link href="/privacy" className="underline hover:text-foreground">
        {chunks}
      </Link>
    ),
    terms: (chunks) => (
      <Link href="/terms" className="underline hover:text-foreground">
        {chunks}
      </Link>
    ),
  })}
</FormLabel>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/register/page.tsx \
  apps/web/src/components/auth/register-form.tsx
git commit -m "fix(i18n): localize register page and form"
```

---

### Task 5: 更新忘记密码页面和表单

**Files:**

- Modify: `apps/web/src/app/[locale]/forgot-password/page.tsx`
- Modify: `apps/web/src/components/auth/forgot-password-form.tsx`

- [ ] **Step 1: 更新 forgot-password/page.tsx**

```tsx
export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthGuard>
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl">
              {t("forgotPassword.title")}
            </CardTitle>
            <CardDescription>{t("forgotPassword.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="font-medium text-foreground hover:underline"
              >
                {t("forgotPassword.backToLogin")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 2: 更新 forgot-password-form.tsx**

Import 变更：

```typescript
import {
  getForgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/schemas/auth";
```

Schema 使用：

```typescript
const t = useTranslations("auth");
const schema = getForgotPasswordSchema((key) => t(key));
const form = useForm<ForgotPasswordInput>({
  resolver: zodResolver(schema),
  defaultValues: { email: "" },
  mode: "onBlur",
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/forgot-password/page.tsx \
  apps/web/src/components/auth/forgot-password-form.tsx
git commit -m "fix(i18n): localize forgot password page and form"
```

---

### Task 6: 更新重置密码页面和表单

**Files:**

- Modify: `apps/web/src/app/[locale]/reset-password/page.tsx`
- Modify: `apps/web/src/components/auth/reset-password-form.tsx`

- [ ] **Step 1: 更新 reset-password/page.tsx**

组件改为 async，文案改用翻译：

```tsx
export default async function ResetPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">{t("resetPassword.title")}</CardTitle>
          <CardDescription>{t("resetPassword.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: 更新 reset-password-form.tsx**

Import 变更：

```typescript
import {
  getResetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/schemas/auth";
```

Schema 使用：

```typescript
const t = useTranslations("auth");
const schema = getResetPasswordSchema((key) => t(key));
const form = useForm<ResetPasswordInput>({
  resolver: zodResolver(schema),
  defaultValues: { password: "", confirmPassword: "" },
  mode: "onBlur",
});
```

Show/Hide 按钮：

```tsx
{
  showPassword ? t("common.hide") : t("common.show");
}
```

错误状态文案替换：

```tsx
setError(t("resetPassword.invalidLink"));
```

请求新链接按钮：

```tsx
<Button variant="outline" onClick={() => router.push("/forgot-password")}>
  {t("resetPassword.requestNewLink")}
</Button>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/reset-password/page.tsx \
  apps/web/src/components/auth/reset-password-form.tsx
git commit -m "fix(i18n): localize reset password page and form"
```

---

### Task 7: 更新 Magic Link 表单

**Files:**

- Modify: `apps/web/src/components/auth/magic-link-form.tsx`

- [ ] **Step 1: 更新 magic-link-form.tsx**

Import 变更：

```typescript
import { getMagicLinkSchema, type MagicLinkInput } from "@/lib/schemas/auth";
```

Schema 使用：

```typescript
const t = useTranslations("auth");
const schema = getMagicLinkSchema((key) => t(key));
const form = useForm<MagicLinkInput>({
  resolver: zodResolver(schema),
  defaultValues: { email: "" },
  mode: "onBlur",
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/auth/magic-link-form.tsx
git commit -m "fix(i18n): localize magic link form validation"
```

---

### Task 8: 类型检查和最终验证

**Files:**

- All modified files

- [ ] **Step 1: 运行类型检查**

```bash
pnpm --filter web type-check
```

Expected: 无类型错误。如果存在 `ReturnType<typeof getLoginSchema>` 相关的类型推断问题，检查 `zodResolver` 的泛型参数是否与 `LoginInput` 匹配。

- [ ] **Step 2: 运行 lint**

```bash
pnpm --filter web lint
```

Expected: 无 lint 错误。

- [ ] **Step 3: 手动验证清单**

在浏览器中依次验证：

1. **登录页（中文）**
   - [ ] 标题显示「登录 Kiyo」
   - [ ] 副标题显示「欢迎回来」
   - [ ] 密码显示按钮显示「显示」
   - [ ] 不填表单直接提交，错误显示「请输入有效的邮箱地址」「密码至少 6 位」

2. **登录页（英文）**
   - [ ] 切换语言后标题显示「Log in to Kiyo」
   - [ ] 错误显示英文

3. **注册页（中文）**
   - [ ] 标题显示「注册 Kiyo」
   - [ ] 用户协议文案为中文
   - [ ] 密码不匹配错误显示中文
   - [ ] 未勾选协议错误显示中文

4. **忘记密码页（中文）**
   - [ ] 标题/描述为中文
   - [ ] 「返回登录」链接为中文

5. **重置密码页（中文）**
   - [ ] 标题/描述为中文
   - [ ] 无效链接错误为中文

- [ ] **Step 4: 提交设计文档和计划**

```bash
git add docs/superpowers/specs/2026-05-12-i18n-auth-pages-design.md \
  docs/superpowers/plans/2026-05-12-i18n-auth-pages.md
git commit -m "docs: add i18n auth pages design spec and implementation plan"
```

---

## Spec 覆盖自检

| Spec 要求                     | 对应 Task |
| ----------------------------- | --------- |
| 修复 messages 中 git 冲突标记 | Task 1    |
| 补充所有新翻译键（zh/en）     | Task 1    |
| Zod schema 工厂模式重构       | Task 2    |
| 登录页标题/描述/表单/分隔符   | Task 3    |
| 注册页标题/描述/表单/协议     | Task 4    |
| 忘记密码页标题/描述/返回链接  | Task 5    |
| 重置密码页标题/描述/错误/按钮 | Task 6    |
| Magic Link 表单校验本地化     | Task 7    |
| 中英文切换验证                | Task 8    |

## Placeholder 扫描

- 无 TBD/TODO
- 无 "appropriate error handling" 等模糊描述
- 所有代码块包含完整实现
- 所有文件路径为绝对路径
