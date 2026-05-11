import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

/**
 * 限流动作类型
 */
export type RateLimitAction =
  | 'lyrics_generate'
  | 'song_generate'
  | 'cover_generate'
  | 'image_generate'
  | 'task_retry'

/**
 * 限流配置
 */
interface RateLimitConfig {
  /** 时间窗口（毫秒） */
  windowMs: number
  /** 窗口内最大请求次数 */
  maxRequests: number
}

/**
 * 各动作的默认限流配置
 */
const DEFAULT_CONFIGS: Record<RateLimitAction, RateLimitConfig> = {
  lyrics_generate: { windowMs: 60 * 60 * 1000, maxRequests: 10 }, // 10次/小时
  song_generate: { windowMs: 60 * 60 * 1000, maxRequests: 5 },    // 5次/小时
  cover_generate: { windowMs: 60 * 60 * 1000, maxRequests: 5 },   // 5次/小时
  image_generate: { windowMs: 60 * 60 * 1000, maxRequests: 10 },  // 10次/小时
  task_retry: { windowMs: 60 * 60 * 1000, maxRequests: 10 },      // 10次/小时
}

/**
 * 限流检查结果
 */
export interface RateLimitResult {
  /** 是否允许请求 */
  allowed: boolean
  /** 当前窗口内已使用次数 */
  currentCount: number
  /** 最大允许次数 */
  limit: number
  /** 距离窗口重置的剩余秒数 */
  resetAfterSeconds: number
}

/**
 * 从请求中提取客户端 IP 地址
 */
function getClientIp(request: Request): string {
  // 优先使用 X-Forwarded-For（Vercel 等代理会设置）
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  // 回退到 X-Real-IP
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  // 最后回退到固定标识（无法获取真实 IP 时）
  return 'unknown'
}

/**
 * 构建限流 key
 * 优先使用用户 ID，未登录时使用 IP 地址
 */
function buildRateLimitKey(userId: string | undefined, ip: string): string {
  if (userId) {
    return `user:${userId}`
  }
  return `ip:${ip}`
}

/**
 * 检查并记录限流
 *
 * 使用滑动窗口计数器算法：
 * 1. 删除窗口期外的旧记录
 * 2. 统计窗口期内记录数
 * 3. 若未超限，插入新记录
 *
 * @param action 限流动作类型
 * @param userId 用户 ID（可选）
 * @param request HTTP 请求对象（用于获取 IP）
 * @param config 自定义限流配置（可选，默认使用 DEFAULT_CONFIGS）
 */
export async function checkRateLimit(
  action: RateLimitAction,
  userId: string | undefined,
  request: Request,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const supabase = await createServerClient()
  const { windowMs, maxRequests } = config ?? DEFAULT_CONFIGS[action]
  const windowStart = new Date(Date.now() - windowMs).toISOString()
  const key = buildRateLimitKey(userId, getClientIp(request))

  // 1. 清理过期记录（滑动窗口：删除窗口期外的数据）
  const { error: deleteError } = await supabase
    .from('rate_limits')
    .delete()
    .lt('created_at', windowStart)

  if (deleteError) {
    // 清理失败不影响主逻辑，记录但不抛出
    console.warn('Rate limit cleanup failed:', deleteError.message)
  }

  // 2. 统计当前窗口内请求次数
  const { count, error: countError } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .eq('action', action)
    .gte('created_at', windowStart)

  if (countError) {
    // 查询失败时，出于安全考虑拒绝请求
    console.error('Rate limit count failed:', countError.message)
    return {
      allowed: false,
      currentCount: 0,
      limit: maxRequests,
      resetAfterSeconds: Math.ceil(windowMs / 1000),
    }
  }

  const currentCount = count ?? 0

  // 3. 检查是否超限
  if (currentCount >= maxRequests) {
    return {
      allowed: false,
      currentCount,
      limit: maxRequests,
      resetAfterSeconds: Math.ceil(windowMs / 1000),
    }
  }

  // 4. 记录本次请求
  const { error: insertError } = await supabase
    .from('rate_limits')
    .insert({ key, action })

  if (insertError) {
    // 插入失败时，出于安全考虑拒绝请求
    console.error('Rate limit insert failed:', insertError.message)
    return {
      allowed: false,
      currentCount,
      limit: maxRequests,
      resetAfterSeconds: Math.ceil(windowMs / 1000),
    }
  }

  return {
    allowed: true,
    currentCount: currentCount + 1,
    limit: maxRequests,
    resetAfterSeconds: Math.ceil(windowMs / 1000),
  }
}

/**
 * 构建 429 Too Many Requests 响应
 */
export function createRateLimitResponse(
  result: RateLimitResult
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Limit: ${result.limit} requests per hour. Please try again after ${result.resetAfterSeconds} seconds.`,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.resetAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(Math.max(0, result.limit - result.currentCount)),
        'X-RateLimit-Reset': String(result.resetAfterSeconds),
      },
    }
  )
}
