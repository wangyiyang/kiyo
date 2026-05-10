'use server'

import { createServerClient } from '@kiyo/supabase/server'
import { feedbackSchema } from '@/lib/schemas/feedback'

export type FeedbackResult =
  | { ok: true }
  | { ok: false; code: 'INVALID' | 'UNKNOWN'; message: string }

export async function submitFeedback(input: unknown): Promise<FeedbackResult> {
  const parsed = feedbackSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'INVALID',
      message: parsed.error.errors[0]?.message ?? '输入格式不正确',
    }
  }

  const supabase = await createServerClient()

  // 尝试获取当前用户（可能未登录）
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('feedback').insert({
    type: parsed.data.type,
    description: parsed.data.description.trim(),
    contact: parsed.data.contact?.trim() || null,
    user_id: user?.id ?? null,
  })

  if (error) {
    console.error('Feedback insert error:', error)
    return { ok: false, code: 'UNKNOWN', message: '提交失败，请稍后重试' }
  }

  return { ok: true }
}