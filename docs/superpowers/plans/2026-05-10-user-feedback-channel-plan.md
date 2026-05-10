# 用户反馈渠道实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现用户反馈渠道，包含反馈表单、联系页面和 FAQ

**Architecture:**

- 反馈数据存入 Supabase `feedback` 表
- 反馈表单通过 Server Action 提交
- 双入口：Footer「联系我们」链接到 `/contact` 页面；用户菜单「反馈」打开弹窗
- FAQ 使用静态数据，可扩展到数据库

**Tech Stack:** Next.js 14, Supabase, React Hook Form, Zod, shadcn/ui (Dialog, Textarea, Input)

---

## 文件结构

```
新增文件:
- supabase-local/migrations/20260510120001_create_feedback.sql
- apps/web/src/lib/schemas/feedback.ts
- apps/web/src/app/actions/feedback.ts
- apps/web/src/components/feedback-form.tsx
- apps/web/src/components/feedback-dialog.tsx
- apps/web/src/components/faq-accordion.tsx
- apps/web/src/app/[locale]/contact/page.tsx
- apps/web/messages/zh.json (添加翻译)
- apps/web/messages/en.json (添加翻译)

修改文件:
- apps/web/src/components/site-footer.tsx: 添加「contact」链接
- apps/web/src/components/auth/user-menu.tsx: 添加「反馈」菜单项
- packages/ui/index.ts: 导出 Select 组件
- packages/ui/src/components/ui/select.tsx: Select 组件
```

---

## Task 1: 创建 Supabase feedback 表迁移

**Files:**

- Create: `supabase-local/migrations/20260510120001_create_feedback.sql`

- [ ] **Step 1: 创建迁移文件**

```sql
-- 用户反馈表
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),

  -- 用户信息（可选，未登录用户可提交）
  user_id uuid references auth.users(id) on delete set null,

  -- 反馈类型
  type text not null check (type in ('bug', 'suggestion', 'other')),

  -- 反馈描述
  description text not null,

  -- 联系方式（可选）
  contact text,

  -- 时间戳
  created_at timestamptz default now()
);

-- 索引
create index idx_feedback_created_at on feedback (created_at desc);
create index idx_feedback_type on feedback (type);

-- RLS 策略
alter table feedback enable row level security;

-- 所有人可插入（匿名反馈）
create policy "feedback_insert"
  on feedback
  for insert
  to public
  with check (true);

-- 仅管理员可查询和删除（通过服务角色 key）
create policy "feedback_admin_read"
  on feedback
  for select
  to service_role
  using (true);

create policy "feedback_admin_delete"
  on feedback
  for delete
  to service_role
  using (true);
```

- [ ] **Step 2: 提交**

```bash
git add supabase-local/migrations/20260510120001_create_feedback.sql
git commit -m "feat(db): add feedback table for #56"
```

---

## Task 2: 创建反馈 Schema 和 Server Action

**Files:**

- Create: `apps/web/src/lib/schemas/feedback.ts`
- Create: `apps/web/src/app/actions/feedback.ts`

- [ ] **Step 1: 创建 feedback schema**

```typescript
// apps/web/src/lib/schemas/feedback.ts
import { z } from "zod";

export const feedbackSchema = z.object({
  type: z.enum(["bug", "suggestion", "other"], {
    required_error: "请选择反馈类型",
  }),
  description: z
    .string()
    .min(10, "请至少输入 10 个字符")
    .max(2000, "反馈内容不能超过 2000 字符"),
  contact: z.string().max(254, "联系方式过长").optional().or(z.literal("")),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
```

- [ ] **Step 2: 创建 Server Action**

```typescript
// apps/web/src/app/actions/feedback.ts
"use server";

import { createServerClient } from "@kiyo/supabase/server";
import { feedbackSchema, type FeedbackInput } from "@/lib/schemas/feedback";

export type FeedbackResult =
  | { ok: true }
  | { ok: false; code: "INVALID" | "UNKNOWN"; message: string };

export async function submitFeedback(input: unknown): Promise<FeedbackResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      message: parsed.error.errors[0]?.message ?? "输入格式不正确",
    };
  }

  const supabase = await createServerClient();

  // 尝试获取当前用户（可能未登录）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("feedback").insert({
    type: parsed.data.type,
    description: parsed.data.description.trim(),
    contact: parsed.data.contact?.trim() || null,
    user_id: user?.id ?? null,
  });

  if (error) {
    console.error("Feedback insert error:", error);
    return { ok: false, code: "UNKNOWN", message: "提交失败，请稍后重试" };
  }

  return { ok: true };
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/lib/schemas/feedback.ts apps/web/src/app/actions/feedback.ts
git commit -m "feat(feedback): add schema and server action for #56"
```

---

## Task 3: 创建 Select 组件

**Files:**

- Create: `packages/ui/src/components/ui/select.tsx`
- Modify: `packages/ui/index.ts`

- [ ] **Step 1: 创建 Select 组件**

```typescript
// packages/ui/src/components/ui/select.tsx
import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "../../lib/utils"

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
        <ChevronUp className="h-4 w-4" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
        <ChevronDown className="h-4 w-4" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
}
```

- [ ] **Step 2: 安装依赖并更新导出**

```bash
cd packages/ui
pnpm add @radix-ui/react-select
```

- [ ] **Step 3: 更新 packages/ui/index.ts**

在 Textarea 导出后添加：

```typescript
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from "./src/components/ui/select";
```

- [ ] **Step 4: 提交**

```bash
git add packages/ui/src/components/ui/select.tsx packages/ui/index.ts packages/ui/package.json
git commit -m "feat(ui): add Select component for #56"
```

---

## Task 4: 添加国际化翻译

**Files:**

- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 添加中文翻译**

在 `zh.json` 的 footer 后面添加：

```json
"feedback": {
  "type": {
    "label": "反馈类型",
    "placeholder": "选择类型",
    "options": {
      "bug": "Bug 报告",
      "suggestion": "功能建议",
      "other": "其他"
    }
  },
  "description": {
    "label": "问题描述",
    "placeholder": "请详细描述您遇到的问题或建议..."
  },
  "contact": {
    "label": "联系方式（可选）",
    "placeholder": "邮箱或其他联系方式"
  },
  "submit": "提交反馈",
  "submitting": "提交中...",
  "success": "感谢您的反馈！",
  "error": "提交失败，请稍后重试"
},
"contact": {
  "title": "联系我们",
  "subtitle": "遇到问题或有建议？我们随时为您服务",
  "email": "邮箱",
  "faq": {
    "title": "常见问题"
  }
},
"userMenu": {
  "feedback": "反馈"
}
```

- [ ] **Step 2: 添加英文翻译**

在 `en.json` 的 footer 后面添加：

```json
"feedback": {
  "type": {
    "label": "Feedback Type",
    "placeholder": "Select type",
    "options": {
      "bug": "Bug Report",
      "suggestion": "Feature Suggestion",
      "other": "Other"
    }
  },
  "description": {
    "label": "Description",
    "placeholder": "Please describe your issue or suggestion in detail..."
  },
  "contact": {
    "label": "Contact (Optional)",
    "placeholder": "Email or other contact info"
  },
  "submit": "Submit Feedback",
  "submitting": "Submitting...",
  "success": "Thank you for your feedback!",
  "error": "Failed to submit. Please try again later."
},
"contact": {
  "title": "Contact Us",
  "subtitle": "Have questions or suggestions? We're here to help.",
  "email": "Email",
  "faq": {
    "title": "FAQ"
  }
},
"userMenu": {
  "feedback": "Feedback"
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "i18n: add feedback and contact translations for #56"
```

---

## Task 5: 创建 FeedbackForm 和 FeedbackDialog 组件

**Files:**

- Create: `apps/web/src/components/feedback-form.tsx`
- Create: `apps/web/src/components/feedback-dialog.tsx`

- [ ] **Step 1: 创建 FeedbackForm 组件**

```typescript
// apps/web/src/components/feedback-form.tsx
'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { MessageSquare } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@kiyo/ui'

import { submitFeedback } from '@/app/actions/feedback'
import { feedbackSchema, type FeedbackInput } from '@/lib/schemas/feedback'

const typeOptions = ['bug', 'suggestion', 'other'] as const

interface FeedbackFormProps {
  className?: string
}

export function FeedbackForm({ className }: FeedbackFormProps) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const t = useTranslations('feedback')

  const form = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { type: undefined, description: '', contact: '' },
    mode: 'onSubmit',
  })

  const onSubmit = (values: FeedbackInput) => {
    startTransition(async () => {
      const result = await submitFeedback(values)
      if (result.ok) {
        toast.success(t('success'))
        form.reset()
        setOpen(false)
        return
      }

      toast.error(result.message)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('type.label')}
          </DialogTitle>
          <DialogDescription>{t('type.label')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('type.label')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('type.placeholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {typeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`type.options.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('description.label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('description.placeholder')}
                      rows={4}
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('contact.label')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('contact.placeholder')}
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                取消
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t('submitting') : t('submit')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 创建 FeedbackDialog 触发器组件**

```typescript
// apps/web/src/components/feedback-dialog.tsx
'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { MessageSquare } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@kiyo/ui'

import { submitFeedback } from '@/app/actions/feedback'
import { feedbackSchema, type FeedbackInput } from '@/lib/schemas/feedback'

const typeOptions = ['bug', 'suggestion', 'other'] as const

export function FeedbackDialog() {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const t = useTranslations('feedback')
  const formRef = React.useRef<HTMLFormElement>(null)

  const onSubmit = (values: FeedbackInput) => {
    startTransition(async () => {
      const result = await submitFeedback(values)
      if (result.ok) {
        toast.success(t('success'))
        formRef.current?.reset()
        setOpen(false)
        return
      }

      toast.error(result.message)
    })
  }

  // 暴露 open setter 给外部调用
  React.useImperativeHandle(
    React.useRef(null),
    () => ({ open: () => setOpen(true) }),
    []
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('type.label')}
          </DialogTitle>
        </DialogHeader>

        <Form action={onSubmit}>
          <form ref={formRef} className="space-y-5">
            <FormField
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('type.label')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('type.placeholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {typeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`type.options.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('description.label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('description.placeholder')}
                      rows={4}
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('contact.label')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('contact.placeholder')}
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                取消
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t('submitting') : t('submit')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

实际上需要重写，用标准的 react-hook-form：

```typescript
// apps/web/src/components/feedback-dialog.tsx
'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { MessageSquare } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@kiyo/ui'

import { submitFeedback } from '@/app/actions/feedback'
import { feedbackSchema, type FeedbackInput } from '@/lib/schemas/feedback'

const typeOptions = ['bug', 'suggestion', 'other'] as const

export function FeedbackDialog() {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const t = useTranslations('feedback')

  const form = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { type: undefined, description: '', contact: '' },
    mode: 'onSubmit',
  })

  const onSubmit = (values: FeedbackInput) => {
    startTransition(async () => {
      const result = await submitFeedback(values)
      if (result.ok) {
        toast.success(t('success'))
        form.reset()
        setOpen(false)
        return
      }

      toast.error(result.message)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('type.label')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('type.label')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('type.placeholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {typeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`type.options.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('description.label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('description.placeholder')}
                      rows={4}
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('contact.label')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('contact.placeholder')}
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                取消
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t('submitting') : t('submit')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/components/feedback-dialog.tsx
git commit -m "feat(feedback): add feedback dialog component for #56"
```

---

## Task 6: 创建 FAQ Accordion 组件

**Files:**

- Create: `apps/web/src/components/faq-accordion.tsx`

- [ ] **Step 1: 创建 FAQ Accordion 组件**

```typescript
// apps/web/src/components/faq-accordion.tsx
'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@kiyo/ui'

interface FaqItem {
  question: string
  answer: string
}

const staticFaqs: FaqItem[] = [
  {
    question: '生成失败怎么办？',
    answer:
      '检查网络连接是否稳定。部分模型可能在高峰期排队，建议稍后重试。如果持续失败，通过反馈表单提交，我们会尽快排查。',
  },
  {
    question: '支持哪些音频格式？',
    answer: '目前支持 MP3、WAV 格式导出。歌曲封面支持 JPG、PNG。',
  },
  {
    question: '如何删除作品？',
    answer:
      '进入歌曲/专辑详情页，点击删除按钮即可。删除后作品将无法恢复，请谨慎操作。',
  },
  {
    question: '生成一首歌曲需要多长时间？',
    answer:
      '根据歌曲长度和当前队列状态，通常需要 2-5 分钟。复杂编曲可能需要更长时间，请耐心等待。',
  },
  {
    question: '生成的音乐版权归谁？',
    answer:
      '您使用 Kiyo 生成的歌曲版权归您所有。请遵守当地法律法规，不要用于非法用途。',
  },
  {
    question: '如何联系客服？',
    answer: '发送邮件至 wangyiyang.kk@gmail.com，或通过页面底部的反馈表单提交问题。',
  },
]

export function FaqAccordion() {
  const t = useTranslations('contact.faq')

  return (
    <div className="w-full">
      <h2 className="mb-6 text-2xl font-bold">{t('title')}</h2>
      <Accordion type="single" collapsible className="w-full">
        {staticFaqs.map((faq, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
```

- [ ] **Step 2: 添加 Accordion 组件到 @kiyo/ui**

检查 packages/ui 是否有 Accordion，没有则创建：

```typescript
// packages/ui/src/components/ui/accordion.tsx
import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"

const Accordion = AccordionPrimitive.Root
const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b", className)}
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
```

安装依赖并导出：

```bash
cd packages/ui
pnpm add @radix-ui/react-accordion
```

更新 `packages/ui/index.ts`:

```typescript
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./src/components/ui/accordion";
```

- [ ] **Step 3: 提交**

```bash
git add packages/ui/src/components/ui/accordion.tsx packages/ui/index.ts packages/ui/package.json apps/web/src/components/faq-accordion.tsx
git commit -m "feat(ui): add Accordion component and FaqAccordion for #56"
```

---

## Task 7: 创建 Contact 页面

**Files:**

- Create: `apps/web/src/app/[locale]/contact/page.tsx`

- [ ] **Step 1: 创建 Contact 页面**

```typescript
// apps/web/src/app/[locale]/contact/page.tsx
import { useTranslations } from 'next-intl'
import { Mail } from 'lucide-react'

import { FaqAccordion } from '@/components/faq-accordion'
import { FeedbackForm } from '@/components/feedback-form'

export default function ContactPage() {
  const t = useTranslations('contact')

  return (
    <div className="container mx-auto max-w-2xl px-4 py-16">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* 联系邮箱 */}
      <div className="mb-12 flex items-center justify-center gap-3 rounded-lg border bg-card p-6">
        <Mail className="h-6 w-6 text-primary" />
        <a
          href="mailto:wangyiyang.kk@gmail.com"
          className="text-lg font-medium hover:underline"
        >
          wangyiyang.kk@gmail.com
        </a>
      </div>

      {/* 反馈表单 */}
      <div className="mb-16">
        <FeedbackForm />
      </div>

      {/* FAQ */}
      <FaqAccordion />
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/[locale]/contact/page.tsx
git commit -m "feat(pages): add contact page for #56"
```

---

## Task 8: 修改 SiteFooter 和 UserMenu

**Files:**

- Modify: `apps/web/src/components/site-footer.tsx`
- Modify: `apps/web/src/components/auth/user-menu.tsx`

- [ ] **Step 1: 修改 SiteFooter**

在 `groupLinks.about` 中添加 contact 链接：

```typescript
const groupLinks: Record<GroupKey, { href: string; key: string }[]> = {
  // ...
  about: [
    { href: "#", key: "team" },
    { href: "/contact", key: "contact" }, // 新增
    { href: "/privacy", key: "privacy" },
  ],
};
```

在 `zh.json` 和 `en.json` 的 `footer.groups.about.links` 中添加翻译：

```json
"contact": "联系我们"
```

- [ ] **Step 2: 修改 UserMenu**

在 DropdownMenuContent 中，在 settings 菜单项之前添加反馈入口：

```typescript
<DropdownMenuSeparator />
<DropdownMenuItem onClick={() => /* 打开反馈弹窗 */}>
  <MessageSquare className="mr-2 h-4 w-4" />
  {t('userMenu.feedback')}
</DropdownMenuItem>
<DropdownMenuItem asChild>
  <Link href="/settings">
    <Settings className="mr-2 h-4 w-4" />
    {t('userMenu.settings')}
  </Link>
</DropdownMenuItem>
```

需要创建 context 来控制 FeedbackDialog：

```typescript
// apps/web/src/lib/feedback-context.tsx
'use client'

import * as React from 'react'

interface FeedbackContextValue {
  open: () => void
}

const FeedbackContext = React.createContext<FeedbackContextValue | null>(null)

export function useFeedback() {
  const context = React.useContext(FeedbackContext)
  if (!context) throw new Error('useFeedback must be used within FeedbackProvider')
  return context
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return (
    <FeedbackContext.Provider value={{ open: () => setOpen(true) }}>
      {children}
    </FeedbackContext.Provider>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/components/site-footer.tsx apps/web/src/components/auth/user-menu.tsx apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "feat(ui): add feedback entry to footer and user menu for #56"
```

---

## Task 9: 整合所有组件到 Layout

**Files:**

- Modify: `apps/web/src/app/[locale]/layout.tsx`

- [ ] **Step 1: 修改 Layout**

导入并使用 FeedbackDialog 和 FeedbackProvider：

```typescript
import { FeedbackDialog } from '@/components/feedback-dialog'
import { FeedbackProvider } from '@/lib/feedback-context'

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale}>
          <FeedbackProvider>
            {/* ... 现有内容 */}
            <FeedbackDialog />
          </FeedbackProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/[locale]/layout.tsx
git commit -m "feat: integrate feedback dialog in layout for #56"
```

---

## Task 10: 测试验证

- [ ] **Step 1: 运行类型检查**

```bash
pnpm type-check
```

- [ ] **Step 2: 运行 lint**

```bash
pnpm lint
```

- [ ] **Step 3: 本地测试**

1. 启动 Supabase 本地环境：`pnpm supabase:start`
2. 应用迁移：`pnpm supabase:db:reset`
3. 启动开发服务器：`pnpm dev`
4. 测试反馈表单提交
5. 测试 FAQ 展开/收起
6. 测试 Footer 链接跳转

- [ ] **Step 4: 提交最终版本**

```bash
git add .
git commit -m "feat(feedback): complete user feedback channel implementation for #56"
```
