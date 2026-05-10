# 合规页面实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 创建隐私政策和用户协议页面，更新 Footer 和注册表单以满足公测合规要求

**架构:** 多语言路由组 + 共享 LegalLayout 组件，内容与布局分离便于维护

**技术栈:** Next.js 14 App Router、next-intl、TypeScript、Tailwind CSS

---

## 文件清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `apps/web/src/app/[locale]/privacy/page.tsx` | 创建 | 隐私政策页面 |
| `apps/web/src/app/[locale]/terms/page.tsx` | 创建 | 用户协议页面 |
| `apps/web/messages/en.json` | 修改 | 添加英文 i18n |
| `apps/web/messages/zh.json` | 修改 | 添加中文 i18n |
| `apps/web/src/components/site-footer.tsx` | 修改 | 更新链接 + locale 支持 |
| `apps/web/src/lib/schemas/auth.ts` | 修改 | 添加 termsAccepted 校验 |
| `apps/web/src/components/auth/register-form.tsx` | 修改 | 添加协议勾选框 |
| `apps/web/src/app/register/page.tsx` | 修改 | 传递 locale 给 Link |

---

## Task 1: 创建隐私政策页面

**Files:**
- Create: `apps/web/src/app/[locale]/privacy/page.tsx`

- [ ] **Step 1: 创建隐私政策页面组件**

```tsx
import { Metadata } from 'next'
import { getTranslations, getLocale } from 'next-intl/server'
import { CalendarDays } from 'lucide-react'

import { Separator } from '@kiyo/ui'

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="mb-8">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.privacy')
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function PrivacyPage() {
  const t = await getTranslations('legal.privacy')
  const locale = await getLocale()

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>{t('lastUpdated')}</span>
        </div>
      </div>

      <Separator className="mb-10" />

      <div className="prose prose-sm max-w-none">
        <Section title={t('sections.intro.title')}>
          <p>{t('sections.intro.p1')}</p>
          <p>{t('sections.intro.p2')}</p>
        </Section>

        <Section title={t('sections.collection.title')}>
          <p>{t('sections.collection.p1')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('sections.collection.items.email')}</li>
            <li>{t('sections.collection.items.content')}</li>
            <li>{t('sections.collection.items.usage')}</li>
            <li>{t('sections.collection.items.cookies')}</li>
          </ul>
        </Section>

        <Section title={t('sections.usage.title')}>
          <p>{t('sections.usage.p1')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('sections.usage.items.service')}</li>
            <li>{t('sections.usage.items.personalization')}</li>
            <li>{t('sections.usage.items.ai')}</li>
            <li>{t('sections.usage.items.communication')}</li>
          </ul>
        </Section>

        <Section title={t('sections.storage.title')}>
          <p>{t('sections.storage.p1')}</p>
          <p>{t('sections.storage.p2')}</p>
        </Section>

        <Section title={t('sections.thirdParty.title')}>
          <p>{t('sections.thirdParty.p1')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('sections.thirdParty.items.supabase')}</li>
            <li>{t('sections.thirdParty.items.minimax')}</li>
            <li>{t('sections.thirdParty.items.vercel')}</li>
          </ul>
        </Section>

        <Section title={t('sections.rights.title')}>
          <p>{t('sections.rights.p1')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('sections.rights.items.access')}</li>
            <li>{t('sections.rights.items.correction')}</li>
            <li>{t('sections.rights.items.deletion')}</li>
            <li>{t('sections.rights.items.withdraw')}</li>
          </ul>
          <p className="mt-3">{t('sections.rights.contact')}</p>
        </Section>

        <Section title={t('sections.security.title')}>
          <p>{t('sections.security.p1')}</p>
        </Section>

        <Section title={t('sections.changes.title')}>
          <p>{t('sections.changes.p1')}</p>
        </Section>

        <Section title={t('sections.contact.title')}>
          <p>{t('sections.contact.p1')}</p>
          <p className="font-medium text-foreground">hello@kiyo.ai</p>
        </Section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/[locale]/privacy/page.tsx
git commit -m "feat(pages): add privacy policy page for #53"
```

---

## Task 2: 创建用户协议页面

**Files:**
- Create: `apps/web/src/app/[locale]/terms/page.tsx`

- [ ] **Step 1: 创建用户协议页面组件**

```tsx
import { Metadata } from 'next'
import { getTranslations, getLocale } from 'next-intl/server'
import { CalendarDays } from 'lucide-react'

import { Separator } from '@kiyo/ui'

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="mb-8">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.terms')
  return {
    title: t('title'),
    description: t('description'),
  }
}

export default async function TermsPage() {
  const t = await getTranslations('legal.terms')

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>{t('lastUpdated')}</span>
        </div>
      </div>

      <Separator className="mb-10" />

      <div className="prose prose-sm max-w-none">
        <Section title={t('sections.intro.title')}>
          <p>{t('sections.intro.p1')}</p>
          <p>{t('sections.intro.p2')}</p>
        </Section>

        <Section title={t('sections.service.title')}>
          <p>{t('sections.service.p1')}</p>
          <p>{t('sections.service.p2')}</p>
        </Section>

        <Section title={t('sections.account.title')}>
          <p>{t('sections.account.p1')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('sections.account.items.register')}</li>
            <li>{t('sections.account.items.accurate')}</li>
            <li>{t('sections.account.items.security')}</li>
            <li>{t('sections.account.items.age')}</li>
          </ul>
        </Section>

        <Section title={t('sections.content.title')}>
          <p>{t('sections.content.p1')}</p>
          <p>{t('sections.content.p2')}</p>
        </Section>

        <Section title={t('sections.prohibited.title')}>
          <p>{t('sections.prohibited.p1')}</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{t('sections.prohibited.items.illegal')}</li>
            <li>{t('sections.prohibited.items.infringe')}</li>
            <li>{t('sections.prohibited.items.harmful')}</li>
            <li>{t('sections.prohibited.items.spam')}</li>
          </ul>
        </Section>

        <Section title={t('sections.changes.title')}>
          <p>{t('sections.changes.p1')}</p>
        </Section>

        <Section title={t('sections.termination.title')}>
          <p>{t('sections.termination.p1')}</p>
        </Section>

        <Section title={t('sections.disclaimer.title')}>
          <p>{t('sections.disclaimer.p1')}</p>
          <p>{t('sections.disclaimer.p2')}</p>
        </Section>

        <Section title={t('sections.law.title')}>
          <p>{t('sections.law.p1')}</p>
        </Section>

        <Section title={t('sections.contact.title')}>
          <p>{t('sections.contact.p1')}</p>
          <p className="font-medium text-foreground">hello@kiyo.ai</p>
        </Section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/[locale]/terms/page.tsx
git commit -m "feat(pages): add terms of service page for #53"
```

---

## Task 3: 添加国际翻译文本

**Files:**
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/zh.json`

- [ ] **Step 1: 添加英文翻译**

在 `en.json` 末尾添加:

```json
,
"legal": {
  "privacy": {
    "title": "Privacy Policy",
    "description": "How Kiyo collects, uses, and protects your information",
    "lastUpdated": "Last updated: May 10, 2026",
    "sections": {
      "intro": {
        "title": "Introduction",
        "p1": "Kiyo (\"we,\" \"us,\" or \"our\") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI music creation platform.",
        "p2": "By using our service, you agree to the collection and use of information in accordance with this policy."
      },
      "collection": {
        "title": "Information We Collect",
        "p1": "We collect the following types of information:",
        "items": {
          "email": "Account information (email address, password) when you register",
          "content": "User-generated content (lyrics, songs, albums) you create",
          "usage": "Usage data (how you interact with our platform, features used)",
          "cookies": "Cookies and similar tracking technologies"
        }
      },
      "usage": {
        "title": "How We Use Your Information",
        "p1": "We use the information we collect for the following purposes:",
        "items": {
          "service": "Providing, maintaining, and improving our services",
          "personalization": "Personalizing your experience",
          "ai": "Processing content through AI models (Minimax) to generate music",
          "communication": "Sending service-related notifications and updates"
        }
      },
      "storage": {
        "title": "Data Storage and Security",
        "p1": "Your data is stored securely using Supabase (our backend infrastructure) with industry-standard encryption.",
        "p2": "Audio files and user content are stored in secure object storage with regular backups."
      },
      "thirdParty": {
        "title": "Third-Party Services",
        "p1": "We use third-party services that may have access to your data:",
        "items": {
          "supabase": "Supabase - Backend database and authentication",
          "minimax": "Minimax - AI model provider for music generation",
          "vercel": "Vercel - Hosting and deployment platform"
        }
      },
      "rights": {
        "title": "Your Rights",
        "p1": "You have the following rights regarding your personal data:",
        "items": {
          "access": "Right to access your personal data",
          "correction": "Right to correct inaccurate data",
          "deletion": "Right to request deletion of your data",
          "withdraw": "Right to withdraw consent"
        },
        "contact": "To exercise any of these rights, please contact us at:"
      },
      "security": {
        "title": "Data Security",
        "p1": "We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction."
      },
      "changes": {
        "title": "Changes to This Policy",
        "p1": "We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the \"last updated\" date."
      },
      "contact": {
        "title": "Contact Us",
        "p1": "If you have any questions about this Privacy Policy, please contact us at:"
      }
    }
  },
  "terms": {
    "title": "Terms of Service",
    "description": "Terms and conditions for using Kiyo",
    "lastUpdated": "Last updated: May 10, 2026",
    "sections": {
      "intro": {
        "title": "Agreement to Terms",
        "p1": "These Terms of Service (\"Terms\") govern your access to and use of Kiyo, an AI-powered music creation platform operated by Kiyo (\"we,\" \"us,\" or \"our\").",
        "p2": "By accessing or using our service, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the service."
      },
      "service": {
        "title": "Description of Service",
        "p1": "Kiyo provides an AI-powered platform for music creation, allowing users to generate, edit, and manage music tracks using artificial intelligence models.",
        "p2": "We reserve the right to modify, suspend, or discontinue any part of the service at any time."
      },
      "account": {
        "title": "User Accounts",
        "p1": "To access certain features, you must create an account. You agree to:",
        "items": {
          "register": "Provide accurate and complete registration information",
          "accurate": "Keep your account information up to date",
          "security": "Maintain the security of your account credentials",
          "age": "Be at least 16 years old to create an account"
        }
      },
      "content": {
        "title": "User Content and Intellectual Property",
        "p1": "You retain ownership of the content you create using Kiyo. By uploading or creating content, you grant us a license to use, store, and process it to provide our services.",
        "p2": "AI-generated music using our platform can be used for personal and commercial purposes, subject to these Terms."
      },
      "prohibited": {
        "title": "Prohibited Conduct",
        "p1": "You agree not to:",
        "items": {
          "illegal": "Use the service for any illegal purpose",
          "infringe": "Infringe on the intellectual property rights of others",
          "harmful": "Upload content that is harmful, offensive, or violates others' rights",
          "spam": "Send spam or distribute malware"
        }
      },
      "changes": {
        "title": "Modifications to Terms",
        "p1": "We reserve the right to modify these Terms at any time. We will provide notice of significant changes by posting the updated Terms on this page."
      },
      "termination": {
        "title": "Termination",
        "p1": "We may terminate or suspend your access to the service immediately, without prior notice, for any reason, including breach of these Terms."
      },
      "disclaimer": {
        "title": "Disclaimer of Warranties",
        "p1": "THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.",
        "p2": "We do not guarantee that the service will be uninterrupted, secure, or error-free."
      },
      "law": {
        "title": "Governing Law",
        "p1": "These Terms shall be governed by and construed in accordance with applicable laws, without regard to its conflict of law provisions."
      },
      "contact": {
        "title": "Contact",
        "p1": "For questions about these Terms, please contact us at:"
      }
    }
  }
}
```

- [ ] **Step 2: 添加中文翻译**

在 `zh.json` 末尾添加:

```json
,
"legal": {
  "privacy": {
    "title": "隐私政策",
    "description": "Kiyo 如何收集、使用和保护您的信息",
    "lastUpdated": "最后更新：2026年5月10日",
    "sections": {
      "intro": {
        "title": "引言",
        "p1": "Kiyo（"我们"或"我们的"）致力于保护您的隐私。本隐私政策说明了我们如何在您使用 AI 音乐创作平台时收集、使用、披露和保护您的信息。",
        "p2": "使用我们的服务即表示您同意按照本政策收集和使用信息。"
      },
      "collection": {
        "title": "我们收集的信息",
        "p1": "我们收集以下类型的信息：",
        "items": {
          "email": "账户信息（注册时的邮箱地址和密码）",
          "content": "您创建的用户内容（歌词、歌曲、专辑）",
          "usage": "使用数据（您如何与平台互动、使用哪些功能）",
          "cookies": "Cookie 和类似的追踪技术"
        }
      },
      "usage": {
        "title": "我们如何使用您的信息",
        "p1": "我们收集的信息用于以下目的：",
        "items": {
          "service": "提供、维护和改进我们的服务",
          "personalization": "个性化您的体验",
          "ai": "通过 AI 模型（Minimax）处理内容以生成音乐",
          "communication": "发送服务相关的通知和更新"
        }
      },
      "storage": {
        "title": "数据存储与安全",
        "p1": "您的数据使用 Supabase（我们的后端基础设施）安全存储，采用行业标准的加密措施。",
        "p2": "音频文件和用户内容存储在安全的对象存储中，并有定期备份。"
      },
      "thirdParty": {
        "title": "第三方服务",
        "p1": "我们使用的第三方服务可能会访问您的数据：",
        "items": {
          "supabase": "Supabase - 后端数据库和身份验证",
          "minimax": "Minimax - 音乐生成的 AI 模型提供商",
          "vercel": "Vercel - 托管和部署平台"
        }
      },
      "rights": {
        "title": "您的权利",
        "p1": "您对个人数据拥有以下权利：",
        "items": {
          "access": "访问您的个人数据的权利",
          "correction": "更正不准确数据的权利",
          "deletion": "请求删除您数据的权利",
          "withdraw": "撤回同意的权利"
        },
        "contact": "如需行使上述任何权利，请通过以下方式联系我们："
      },
      "security": {
        "title": "数据安全",
        "p1": "我们实施适当的技术和组织措施，保护您的个人数据免受未经授权的访问、更改、披露或销毁。"
      },
      "changes": {
        "title": "政策变更",
        "p1": "我们可能会不时更新本隐私政策。如有任何更改，我们将通过在本页面发布新政策并更新"最后更新"日期来通知您。"
      },
      "contact": {
        "title": "联系我们",
        "p1": "如果您对本隐私政策有任何疑问，请通过以下方式联系我们："
      }
    }
  },
  "terms": {
    "title": "用户协议",
    "description": "使用 Kiyo 的条款和条件",
    "lastUpdated": "最后更新：2026年5月10日",
    "sections": {
      "intro": {
        "title": "条款确认",
        "p1": "本用户协议（"条款"）管辖您访问和使用 Kiyo（由 Kiyo 运营的 AI 驱动的音乐创作平台）。",
        "p2": "访问或使用我们的服务即表示您同意受本条款约束。如果您不同意条款的任何部分，则不得访问服务。"
      },
      "service": {
        "title": "服务说明",
        "p1": "Kiyo 提供 AI 驱动的音乐创作平台，允许用户使用人工智能模型生成、编辑和管理音乐曲目。",
        "p2": "我们保留随时修改、暂停或停止服务任何部分的权利。"
      },
      "account": {
        "title": "用户账户",
        "p1": "要访问某些功能，您必须创建账户。您同意：",
        "items": {
          "register": "提供准确完整的注册信息",
          "accurate": "保持您的账户信息最新",
          "security": "维护您账户凭证的安全",
          "age": "年满 16 周岁以上方可创建账户"
        }
      },
      "content": {
        "title": "用户内容与知识产权",
        "p1": "您保留使用 Kiyo 创建的内容的所有权。上传或创建内容即表示您授予我们使用、存储和处理这些内容的许可，以提供服务。",
        "p2": "使用我们平台生成的 AI 音乐可用于个人和商业目的，但须遵守本条款。"
      },
      "prohibited": {
        "title": "禁止行为",
        "p1": "您同意不：",
        "items": {
          "illegal": "将服务用于任何非法目的",
          "infringe": "侵犯他人的知识产权",
          "harmful": "上传有害、冒犯性或侵犯他人权利的内容",
          "spam": "发送垃圾邮件或分发恶意软件"
        }
      },
      "changes": {
        "title": "条款修改",
        "p1": "我们保留随时修改本条款的权利。我们将通过在本页面发布更新的条款来通知您重大更改。"
      },
      "termination": {
        "title": "终止",
        "p1": "对于任何原因违反本条款的情况，我们可能会立即终止或暂停您访问服务，无需事先通知。"
      },
      "disclaimer": {
        "title": "免责声明",
        "p1": "服务按"原样"和"可用"提供，不提供任何类型的明示或暗示保证。",
        "p2": "我们不保证服务将是不间断、安全或无错误的。"
      },
      "law": {
        "title": "适用法律",
        "p1": "本条款应按照适用法律进行解释和执行，不考虑法律冲突规定。"
      },
      "contact": {
        "title": "联系方式",
        "p1": "如对本条款有任何疑问，请通过以下方式联系我们："
      }
    }
  }
}
```

- [ ] **Step 3: 验证 JSON 格式正确**

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/en.json'))" && echo "en.json OK"
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/zh.json'))" && echo "zh.json OK"
```

- [ ] **Step 4: 提交**

```bash
git add apps/web/messages/en.json apps/web/messages/zh.json
git commit -m "feat(i18n): add legal pages translations for #53"
```

---

## Task 4: 更新 Footer 链接

**Files:**
- Modify: `apps/web/src/components/site-footer.tsx`

- [ ] **Step 1: 更新 Footer 组件**

将 `about` 链接组更新为：

```tsx
about: [
  { href: '#', key: 'team' },
  { href: '#', key: 'contact' },
  { href: `/${locale}/privacy`, key: 'privacy' },
  { href: `/${locale}/terms`, key: 'terms' },
],
```

在 `SiteFooter` 组件中添加 `locale` 变量：

```tsx
import { getLocale } from 'next-intl/server'

export async function SiteFooter() {
  const t = useTranslations('footer')
  const locale = await getLocale()
  // ... rest of component
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/components/site-footer.tsx
git commit -m "feat(footer): add terms link and update privacy link for #53"
```

---

## Task 5: 更新注册表单 Schema

**Files:**
- Modify: `apps/web/src/lib/schemas/auth.ts`

- [ ] **Step 1: 查看当前 schema 结构**

```bash
cat apps/web/src/lib/schemas/auth.ts
```

- [ ] **Step 2: 更新 RegisterInput 类型**

在 `registerSchema` 的 `confirmPassword` 之后添加 `termsAccepted` 字段：

```typescript
import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().min(1, 'emailRequired').email('invalidEmail'),
  password: z.string().min(6, 'passwordMin'),
  confirmPassword: z.string(),
  termsAccepted: z.boolean().refine(val => val === true, {
    message: 'termsRequired',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: 'passwordMatch',
  path: ['confirmPassword'],
})

export type RegisterInput = z.infer<typeof registerSchema>
```

- [ ] **Step 3: 添加错误文案**

在 `en.json` 和 `zh.json` 的 `auth.errors` 下添加：

```json
"termsRequired": "You must accept the terms and privacy policy"
```

```json
"termsRequired": "请阅读并同意用户协议和隐私政策"
```

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/lib/schemas/auth.ts apps/web/messages/en.json apps/web/messages/zh.json
git commit -m "feat(auth): add terms acceptance requirement to register schema"
```

---

## Task 6: 更新 RegisterForm UI

**Files:**
- Modify: `apps/web/src/components/auth/register-form.tsx`

- [ ] **Step 1: 在 form 的 defaultValues 添加 termsAccepted: false**

```tsx
const form = useForm<RegisterInput>({
  resolver: zodResolver(registerSchema),
  defaultValues: { email: '', password: '', confirmPassword: '', termsAccepted: false },
  mode: 'onBlur',
})
```

- [ ] **Step 2: 在密码确认字段之后、提交按钮之前添加勾选框**

```tsx
<FormField
  control={form.control}
  name="termsAccepted"
  render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-4">
      <FormControl>
        <Checkbox
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel className="text-sm font-normal cursor-pointer">
          I have read and agree to the{' '}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>
        </FormLabel>
        <FormMessage />
      </div>
    </FormItem>
  )}
/>
```

- [ ] **Step 3: 添加 Link 导入**

```tsx
import Link from 'next/link'
```

- [ ] **Step 4: 验证构建**

```bash
pnpm --filter web type-check
```

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/components/auth/register-form.tsx
git commit -m "feat(auth): add terms checkbox to register form for #53"
```

---

## Task 6b: 更新注册页面获取 locale

**Files:**
- Modify: `apps/web/src/app/register/page.tsx`

- [ ] **Step 1: 添加 getLocale 导入并传递 locale**

```tsx
import { getLocale } from 'next-intl/server'

export default async function RegisterPage() {
  const locale = await getLocale()
  // ... JSX, 确保 Link href 使用 locale
}
```

注意：如果 Link 组件使用 `@/i18n/navigation`，则使用 `href={{ pathname: '/terms' }}`（自动处理 locale），不需要手动传递 locale。

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/register/page.tsx
git commit -m "chore(register): ensure locale-aware navigation"
```

---

## Task 7: 验证实现

- [ ] **Step 1: 启动开发服务器**

```bash
pnpm --filter web dev
```

- [ ] **Step 2: 验证路由**

- 访问 `/en/privacy` - 应显示英文隐私政策
- 访问 `/zh/privacy` - 应显示中文隐私政策
- 访问 `/en/terms` - 应显示英文用户协议
- 访问 `/zh/terms` - 应显示中文用户协议

- [ ] **Step 3: 验证 Footer 链接**

- Footer 中的"隐私政策"应链接到 `/{locale}/privacy`
- Footer 中应有"用户协议"链接到 `/{locale}/terms`

- [ ] **Step 4: 验证注册表单**

- 访问 `/register`
- 尝试不勾选协议直接提交，应显示错误提示
- 勾选协议后可正常提交

- [ ] **Step 5: 提交最终验证**

```bash
git add -A
git commit -m "fix: final verification for #53"
```

---

## 自检清单

- [ ] 所有页面路由 `/privacy` 和 `/terms` 在 en/zh 下可访问
- [ ] Footer 链接正确指向带 locale 的路由
- [ ] 注册表单必须勾选协议才能提交
- [ ] i18n 文案覆盖中英文
- [ ] 构建通过 `pnpm build` 或 `pnpm type-check`
- [ ] 所有更改已提交