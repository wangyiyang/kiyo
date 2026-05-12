'use server'

import { headers } from 'next/headers'

import { captureAppException } from '@/lib/monitoring'
import { createServerClient } from '@kiyo/supabase/server'

import { waitlistSchema } from '@/lib/schemas/waitlist'

// discriminated union：调用方一处 switch 即可覆盖所有路径
export type WaitlistResult =
  | { ok: true }
  | { ok: false; code: 'INVALID' | 'DUPLICATE' | 'UNKNOWN'; message: string }

export async function joinWaitlist(input: unknown): Promise<WaitlistResult> {
  const parsed = waitlistSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, code: 'INVALID', message: '邮箱格式不正确' }
  }

  const supabase = await createServerClient()
  const headerList = await headers()
  const userAgent = headerList.get('user-agent') ?? null

  const { error } = await supabase.from('waitlist').insert({
    email: parsed.data.email.trim().toLowerCase(),
    role_new: parsed.data.role ?? null,
    interests: parsed.data.interests ?? null,
    use_scenes: parsed.data.useScenes ?? null,
    source: 'landing',
    user_agent: userAgent,
  })

  if (error) {
    // 23505 = unique_violation，命中 waitlist_email_unique 约束
    if (error.code === '23505') {
      return {
        ok: false,
        code: 'DUPLICATE',
        message: '该邮箱已在 Waitlist 中，感谢支持',
      }
    }
    console.error('[waitlist] insert failed', error)
    captureAppException(error, {
      tags: { area: 'waitlist', operation: 'insert' },
    })
    return { ok: false, code: 'UNKNOWN', message: '提交失败，请稍后再试' }
  }

  return { ok: true }
}
