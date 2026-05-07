import { z } from 'zod'

// 单一真理来源：前端表单校验 + Server Action safeParse 共用
export const waitlistSchema = z.object({
  email: z
    .string()
    .min(1, '请输入邮箱')
    .email('请输入有效邮箱')
    .max(254, '邮箱过长'),
  role: z.enum(['producer', 'songwriter', 'enthusiast', 'other']).optional(),
})

export type WaitlistInput = z.infer<typeof waitlistSchema>
