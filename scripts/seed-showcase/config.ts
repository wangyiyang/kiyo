import 'dotenv/config'

export const CONFIG = {
  // Minimax API 限流（保守设置，避免触发 429）
  rateLimits: {
    lyrics: { rpm: 3, delayMs: 20000 },      // 3 req/min = 20s间隔
    songs: { rpm: 3, delayMs: 20000 },       // 3 req/min
    covers: { rpm: 5, delayMs: 12000 },      // 5 req/min = 12s间隔
  },

  // 重试策略
  retries: {
    maxAttempts: 3,
    baseDelayMs: 2000,
  },

  // 批次大小
  batchSize: {
    lyrics: 3,
    songs: 3,
    covers: 5,
  },

  // 生成数量
  counts: {
    totalSongs: Number(process.env.LIMIT) || 100,
    totalAlbums: 10,
    songsPerAlbum: 10,
    lyricsSongsPerAlbum: 3,   // 每张专辑 3 首带歌词
    featuredPerAlbum: 2,       // 每张专辑 2 首精选
    albumCovers: 10,
    songCovers: 40,
  },

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  // Seed 用户
  seedUserId: process.env.SEED_USER_ID,

  // 进度文件
  progressFile: 'scripts/seed-showcase/seed-progress.json',
}

// 验证必填配置
if (!CONFIG.supabaseUrl || !CONFIG.supabaseServiceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}
