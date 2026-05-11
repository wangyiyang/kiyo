import { z } from 'zod'

export const roleOptions = [
  'beginner',
  'enthusiast',
  'indie',
  'professional',
  'songwriter',
  'other',
] as const

export const interestOptions = [
  'composition',
  'arrangement',
  'vocal',
  'mixing',
  'cover',
  'lyrics',
] as const

export const useSceneOptions = [
  'personal',
  'commercial',
  'education',
  'social',
] as const

// 单一真理来源：前端表单校验 + Server Action safeParse 共用
export const waitlistSchema = z.object({
  email: z
    .string()
    .min(1, '请输入邮箱')
    .email('请输入有效邮箱')
    .max(254, '邮箱过长'),
  role: z.enum(roleOptions).optional(),
  interests: z.array(z.enum(interestOptions)).max(6).optional(),
  useScenes: z.array(z.enum(useSceneOptions)).max(4).optional(),
})

export type WaitlistInput = z.infer<typeof waitlistSchema>
