# Showcase Seed 数据生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 批量生成 100 首 AI 歌曲 + 50 张配图，写入数据库并标记精选，替换 Showcase 假数据。

**Architecture:** 独立 Node.js seed 脚本直接调用 `@kiyo/ai` 的同步 API（`generateMusic`/`generateLyrics`/`generateImage`），下载资源后通过 service_role key 写入 Supabase Storage 和数据库。Showcase 组件改造为 Server Component 查询真实数据。

**Tech Stack:** TypeScript, `@kiyo/ai`, `@supabase/supabase-js`, `tsx`

---

## File Structure

```
supabase-local/migrations/20260509150001_add_songs_is_featured.sql  # 新增 is_featured + anon RLS
scripts/seed-showcase/
  config.ts                # 限流、重试、批次配置
  types.ts                 # 内部类型定义
  prompts.ts               # 100 首歌的 prompt 生成器
  utils/
    rate-limiter.ts        # 令牌桶限流器
    progress.ts            # 断点续跑 JSON 读写
  generators/
    lyrics.ts              # 歌词生成（30首）
    songs.ts               # 歌曲生成（100首）
    covers.ts              # 封面生成（50张）
  writers/
    database.ts            # Supabase 数据写入 + Storage 上传
  index.ts                 # 主入口 + 执行编排
package.json               # 新增 seed:showcase 脚本
apps/web/src/components/sections/showcase.tsx  # 改造为 Server Component
```

---

### Task 1: 数据库迁移 — 新增 `is_featured` 字段和 anon RLS 策略

**Files:**
- Create: `supabase-local/migrations/20260509150001_add_songs_is_featured.sql`

- [ ] **Step 1: 编写迁移文件**

```sql
-- 新增 is_featured 字段
alter table songs add column if not exists is_featured boolean default false;

-- 新增 description 到 albums（如果已存在则跳过）
alter table albums add column if not exists description text;

-- 新增 genre 到 albums（方便分类展示）
alter table albums add column if not exists genre text;

-- 匿名用户可读取精选歌曲
 create policy if not exists "anon_read_featured_songs"
  on songs for select
  to anon
  using (is_featured = true);

-- 匿名用户可读取精选歌曲关联的专辑（通过 album_songs 反向查找）
-- 注意： albums 的 RLS 策略为 authenticated only，需要增加 anon 策略
 create policy if not exists "anon_read_featured_albums"
  on albums for select
  to anon
  using (id in (
    select distinct a.id from albums a
    join album_songs als on a.id = als.album_id
    join songs s on als.song_id = s.id
    where s.is_featured = true
  ));

-- 匿名用户可读取 album_songs 关联（精选歌曲对应的专辑曲目关系）
 create policy if not exists "anon_read_featured_album_songs"
  on album_songs for select
  to anon
  using (song_id in (select id from songs where is_featured = true));
```

- [ ] **Step 2: 本地应用迁移**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
pnpm supabase:db:reset
```

Expected: 迁移成功应用，无报错。

- [ ] **Step 3: 验证字段存在**

```bash
npx supabase --workdir supabase-local gen types typescript --local > /tmp/db-check.ts
grep -n "is_featured" /tmp/db-check.ts
grep -n "description" /tmp/db-check.ts | head -5
```

Expected: 输出包含 `is_featured` 和 `description` 字段定义。

- [ ] **Step 4: Commit**

```bash
git add supabase-local/migrations/20260509150001_add_songs_is_featured.sql
git commit -m "feat(db): add is_featured to songs and anon RLS policies for showcase"
```

---

### Task 2: 创建 Seed 脚本目录和 .env 模板

**Files:**
- Create: `scripts/seed-showcase/.env.example`
- Create: `scripts/seed-showcase/.gitignore`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p /Users/wangyiyang/Documents/Github/kiyo/scripts/seed-showcase/{utils,generators,writers}
```

- [ ] **Step 2: 编写 .env.example**

```bash
cat > /Users/wangyiyang/Documents/Github/kiyo/scripts/seed-showcase/.env.example << 'EOF'
# Supabase（需要 service_role key，用于绕过 RLS 直接写入）
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Minimax
MINIMAX_API_KEY=your-minimax-api-key

# Seed 用户 ID（预先在 auth.users 中创建的系统用户）
# 如果不设置，脚本会尝试创建一个新用户
SEED_USER_ID=

# 可选：限制生成数量（用于测试）
# LIMIT=5
EOF
```

- [ ] **Step 3: 编写 .gitignore**

```bash
cat > /Users/wangyiyang/Documents/Github/kiyo/scripts/seed-showcase/.gitignore << 'EOF'
.env
seed-progress.json
*.log
EOF
```

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-showcase/
git commit -m "chore(seed): create seed-showcase script directory"
```

---

### Task 3: 配置和类型定义

**Files:**
- Create: `scripts/seed-showcase/config.ts`
- Create: `scripts/seed-showcase/types.ts`

- [ ] **Step 1: 编写 config.ts**

```typescript
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
```

- [ ] **Step 2: 编写 types.ts**

```typescript
export interface TrackPrompt {
  id: number
  albumIndex: number
  title: string
  prompt: string
  genre: string
  mood: string
  hasLyrics: boolean
  isFeatured: boolean
  bpm?: number
}

export interface AlbumPrompt {
  index: number
  title: string
  genre: string
  description: string
}

export interface GeneratedLyric {
  trackId: number
  title: string
  content: string
}

export interface GeneratedSong {
  trackId: number
  title: string
  audioUrl: string
  duration: number
  lyricId?: string
}

export interface GeneratedCover {
  targetId: string   // song_id or album_id
  targetType: 'song' | 'album'
  imageUrl: string
}

export interface SeedProgress {
  phase: 'lyrics' | 'songs' | 'covers' | 'database' | 'completed'
  completedLyrics: number[]
  completedSongs: number[]
  completedCovers: string[]
  failedTrackIds: number[]
  failedCoverIds: string[]
  songResults: Record<number, { audioUrl: string; duration: number; storagePath: string }>
  lyricResults: Record<number, { content: string; dbId: string }>
  coverResults: Record<string, { imageUrl: string; storagePath: string }>
  dbAlbumIds: string[]
  dbSongIds: Record<number, string>
  dbLyricIds: Record<number, string>
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-showcase/config.ts scripts/seed-showcase/types.ts
git commit -m "feat(seed): add config and types for showcase seeding"
```

---

### Task 4: 预定义 100 首 Prompts

**Files:**
- Create: `scripts/seed-showcase/prompts.ts`

- [ ] **Step 1: 编写 prompts.ts**

```typescript
import { TrackPrompt, AlbumPrompt } from './types'
import { CONFIG } from './config'

// 10 大 Genre 定义
const GENRES = [
  { name: 'Pop & Dance', subGenres: ['Pop', 'Dance Pop', 'Electropop', 'Synth-pop', 'Dream Pop', 'City Pop', 'House', 'Future Bass'] },
  { name: 'Rock & Alt', subGenres: ['Indie Rock', 'Pop Rock', 'Post-Rock', 'Shoegaze', 'Alternative', 'Punk'] },
  { name: 'R&B/Soul/Funk', subGenres: ['R&B', 'Neo-Soul', 'Contemporary R&B', 'Funk', 'Gospel', 'Soul'] },
  { name: 'Hip-Hop', subGenres: ['Hip-Hop', 'Trap', 'Boom Bap', 'Lo-fi Hip-Hop', 'Cloud Rap', 'Afrobeats'] },
  { name: 'Electronic', subGenres: ['Ambient', 'Techno', 'Drum and Bass', 'Chillwave', 'Vaporwave', 'Amapiano'] },
  { name: 'Folk/Acoustic', subGenres: ['Folk', 'Indie Folk', 'Country', 'Chinese Traditional', 'Celtic Folk'] },
  { name: 'Jazz/Blues', subGenres: ['Jazz', 'Smooth Jazz', 'Jazz Fusion', 'Bossa Nova', 'Blues', 'Avant-Garde Jazz'] },
  { name: 'Classical', subGenres: ['Classical', 'Orchestral', 'Cinematic', 'Film Score', 'Epic', 'Neoclassical'] },
  { name: 'World', subGenres: ['Reggae', 'Latin', 'Waltz', 'Tango', 'Flamenco', 'Island Reggae'] },
  { name: 'Fusion', subGenres: ['Avant-Garde Jazz and Neo-Soul fusion', 'Pop-House', 'Electronic and Folk blend', 'Jazz and Hip-Hop fusion', 'Classical and Electronic', 'World and Ambient'] },
]

const MOODS = [
  'melancholic', 'uplifting', 'dreamy', 'energetic', 'introspective',
  'nostalgic', 'rebellious', 'romantic', 'mysterious', 'peaceful',
  'defiant', 'bittersweet', 'empowering', 'playful', 'somber',
  'euphoric', 'contemplative', 'warm', 'dark', 'hopeful',
]

const VOCAL_STYLES = [
  'smooth emotional vocals',
  'raw unpolished vocals shifting between whispers and screams',
  'breathy delivery with intimate phrasing',
  'powerful soulful vocals with gospel inflections',
  'sultry sophisticated baritone with jazz inflections',
  'ethereal crystal-clear vocals with lush reverb',
  'aggressive vocal delivery with rhythmic intensity',
  'relaxed soul-flavored vocals with ad-libs and melodic scats',
]

const SCENES = [
  'a rainy night in a neon-lit city',
  'a sunrise drive along a coastal highway',
  'a high-end rooftop lounge at night',
  'a small town market on a sunny afternoon',
  'walking through an empty museum at midnight',
  'sitting by a campfire under the stars',
  'a crowded subway during rush hour',
  'a quiet library on a Sunday morning',
  'dancing in an abandoned warehouse',
  'a garden after a spring rain',
]

const INSTRUMENTS = [
  'bright acoustic guitar fingerpicking, gentle ukulele, light hand claps',
  'warm fretless bassline, shimmering Rhodes piano, brushed jazz drums',
  'electric guitar riffs, synth pad, electronic drums',
  'violin, cello, piano trio',
  'saxophone, trumpet, double bass',
  'synth lead, arpeggiator, 808 hi-hats',
  'acoustic guitar, harmonica, cajon',
  'piano, strings section, ambient pads',
  'erhu, guzheng, bamboo flute',
  'organ, choir, timpani',
]

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

function generateTrackPrompt(trackId: number, albumIndex: number): TrackPrompt {
  const genreDef = GENRES[albumIndex]
  const subGenre = pick(genreDef.subGenres, trackId + albumIndex * 100)
  const mood = pick(MOODS, trackId * 7 + albumIndex)
  const scene = pick(SCENES, trackId * 13 + albumIndex)
  const instrument = pick(INSTRUMENTS, trackId * 17 + albumIndex)

  const hasLyrics = (trackId % CONFIG.counts.songsPerAlbum) < CONFIG.counts.lyricsSongsPerAlbum
  const isFeatured = (trackId % CONFIG.counts.songsPerAlbum) < CONFIG.counts.featuredPerAlbum

  let prompt: string
  if (hasLyrics) {
    const vocalStyle = pick(VOCAL_STYLES, trackId * 23 + albumIndex)
    prompt = `A ${mood} ${subGenre} song, featuring ${vocalStyle}, about ${scene}, with ${instrument}.`
  } else {
    prompt = `A ${mood} ${subGenre} instrumental piece, evoking ${scene}, featuring ${instrument}.`
  }

  const titleWords = [
    mood,
    subGenre.split(' ')[0],
    scene.split(' ').slice(-2).join(' '),
  ]
  const title = titleWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  return {
    id: trackId,
    albumIndex,
    title: `${title} #${trackId}`,
    prompt,
    genre: genreDef.name,
    mood,
    hasLyrics,
    isFeatured,
  }
}

export function generateAllPrompts(): { tracks: TrackPrompt[]; albums: AlbumPrompt[] } {
  const tracks: TrackPrompt[] = []
  const albums: AlbumPrompt[] = []

  for (let a = 0; a < CONFIG.counts.totalAlbums; a++) {
    const genreDef = GENRES[a]
    albums.push({
      index: a,
      title: `${genreDef.name} Collection`,
      genre: genreDef.name,
      description: `A curated collection of ${genreDef.name.toLowerCase()} tracks exploring diverse moods and textures.`,
    })

    for (let s = 0; s < CONFIG.counts.songsPerAlbum; s++) {
      const trackId = a * CONFIG.counts.songsPerAlbum + s + 1
      if (trackId > CONFIG.counts.totalSongs) break
      tracks.push(generateTrackPrompt(trackId, a))
    }
  }

  return { tracks, albums }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed-showcase/prompts.ts
git commit -m "feat(seed): add prompt generator for 100 tracks across 10 genres"
```

---

### Task 5: 限流器和进度追踪工具

**Files:**
- Create: `scripts/seed-showcase/utils/rate-limiter.ts`
- Create: `scripts/seed-showcase/utils/progress.ts`

- [ ] **Step 1: 编写 rate-limiter.ts**

```typescript
import { CONFIG } from '../config'

export class RateLimiter {
  private lastCallTime = 0
  private minIntervalMs: number

  constructor(type: 'lyrics' | 'songs' | 'covers') {
    this.minIntervalMs = CONFIG.rateLimits[type].delayMs
  }

  async acquire(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastCallTime
    if (elapsed < this.minIntervalMs) {
      await new Promise(r => setTimeout(r, this.minIntervalMs - elapsed))
    }
    this.lastCallTime = Date.now()
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  for (let attempt = 1; attempt <= CONFIG.retries.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[${context}] Attempt ${attempt} failed: ${message}`)

      if (attempt === CONFIG.retries.maxAttempts) {
        throw new Error(`[${context}] All ${CONFIG.retries.maxAttempts} attempts failed: ${message}`)
      }

      const delay = CONFIG.retries.baseDelayMs * 2 ** (attempt - 1)
      console.log(`[${context}] Retrying in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Unreachable')
}
```

- [ ] **Step 2: 编写 progress.ts**

```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { SeedProgress } from '../types'
import { CONFIG } from '../config'

const DEFAULT_PROGRESS: SeedProgress = {
  phase: 'lyrics',
  completedLyrics: [],
  completedSongs: [],
  completedCovers: [],
  failedTrackIds: [],
  failedCoverIds: [],
  songResults: {},
  lyricResults: {},
  coverResults: {},
  dbAlbumIds: [],
  dbSongIds: {},
  dbLyricIds: {},
}

export function loadProgress(): SeedProgress {
  if (existsSync(CONFIG.progressFile)) {
    const raw = readFileSync(CONFIG.progressFile, 'utf-8')
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) }
  }
  return { ...DEFAULT_PROGRESS }
}

export function saveProgress(progress: SeedProgress): void {
  writeFileSync(CONFIG.progressFile, JSON.stringify(progress, null, 2))
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-showcase/utils/
git commit -m "feat(seed): add rate limiter and progress tracker"
```

---

### Task 6: 歌词生成器

**Files:**
- Create: `scripts/seed-showcase/generators/lyrics.ts`

- [ ] **Step 1: 编写 lyrics.ts**

```typescript
import { generateLyrics } from '@kiyo/ai'
import { TrackPrompt, GeneratedLyric, SeedProgress } from '../types'
import { RateLimiter, withRetry } from '../utils/rate-limiter'
import { saveProgress } from '../utils/progress'

const limiter = new RateLimiter('lyrics')

export async function generateAllLyrics(
  tracks: TrackPrompt[],
  progress: SeedProgress
): Promise<GeneratedLyric[]> {
  const results: GeneratedLyric[] = []

  const pendingTracks = tracks.filter(
    t => t.hasLyrics && !progress.completedLyrics.includes(t.id) && !progress.failedTrackIds.includes(t.id)
  )

  console.log(`[Lyrics] Generating ${pendingTracks.length} lyrics...`)

  for (const track of pendingTracks) {
    try {
      await limiter.acquire()

      const { text } = await withRetry(
        () => generateLyrics({ prompt: track.prompt }),
        `lyrics-${track.id}`
      )

      const lyric: GeneratedLyric = {
        trackId: track.id,
        title: track.title,
        content: text,
      }

      results.push(lyric)
      progress.completedLyrics.push(track.id)
      progress.lyricResults[track.id] = { content: text, dbId: '' }
      saveProgress(progress)

      console.log(`[Lyrics] ✅ Track ${track.id}: "${track.title}"`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Lyrics] ❌ Track ${track.id}: ${message}`)
      progress.failedTrackIds.push(track.id)
      saveProgress(progress)
    }
  }

  return results
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed-showcase/generators/lyrics.ts
git commit -m "feat(seed): add lyrics generator"
```

---

### Task 7: 歌曲生成器

**Files:**
- Create: `scripts/seed-showcase/generators/songs.ts`

- [ ] **Step 1: 编写 songs.ts**

```typescript
import { generateMusic } from '@kiyo/ai'
import { TrackPrompt, GeneratedSong, GeneratedLyric, SeedProgress } from '../types'
import { RateLimiter, withRetry } from '../utils/rate-limiter'
import { saveProgress } from '../utils/progress'

const limiter = new RateLimiter('songs')

export async function generateAllSongs(
  tracks: TrackPrompt[],
  lyrics: GeneratedLyric[],
  progress: SeedProgress
): Promise<GeneratedSong[]> {
  const results: GeneratedSong[] = []
  const lyricMap = new Map(lyrics.map(l => [l.trackId, l.content]))

  const pendingTracks = tracks.filter(
    t => !progress.completedSongs.includes(t.id) && !progress.failedTrackIds.includes(t.id)
  )

  console.log(`[Songs] Generating ${pendingTracks.length} songs...`)

  for (const track of pendingTracks) {
    try {
      await limiter.acquire()

      const lyricContent = track.hasLyrics ? lyricMap.get(track.id) : undefined

      const { audioUrl, duration } = await withRetry(
        () => generateMusic({
          prompt: track.prompt,
          lyrics: lyricContent,
          isInstrumental: !track.hasLyrics,
        }),
        `song-${track.id}`
      )

      const song: GeneratedSong = {
        trackId: track.id,
        title: track.title,
        audioUrl,
        duration,
      }

      results.push(song)
      progress.completedSongs.push(track.id)
      progress.songResults[track.id] = { audioUrl, duration, storagePath: '' }
      saveProgress(progress)

      console.log(`[Songs] ✅ Track ${track.id}: "${track.title}" (${duration}s)`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Songs] ❌ Track ${track.id}: ${message}`)
      progress.failedTrackIds.push(track.id)
      saveProgress(progress)
    }
  }

  return results
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed-showcase/generators/songs.ts
git commit -m "feat(seed): add song generator"
```

---

### Task 8: 封面生成器

**Files:**
- Create: `scripts/seed-showcase/generators/covers.ts`

- [ ] **Step 1: 编写 covers.ts**

```typescript
import { generateImage } from '@kiyo/ai'
import { TrackPrompt, AlbumPrompt, GeneratedCover, SeedProgress } from '../types'
import { RateLimiter, withRetry } from '../utils/rate-limiter'
import { saveProgress } from '../utils/progress'

const limiter = new RateLimiter('covers')

function buildAlbumCoverPrompt(album: AlbumPrompt): string {
  return `Album cover art for "${album.title}". ${album.description}. Abstract, artistic, high quality, no text.`
}

function buildSongCoverPrompt(track: TrackPrompt): string {
  return `Music cover art for a ${track.mood} ${track.genre} track titled "${track.title}". Abstract, artistic, high quality, no text.`
}

export async function generateAlbumCovers(
  albums: AlbumPrompt[],
  dbAlbumIds: string[],
  progress: SeedProgress
): Promise<GeneratedCover[]> {
  const results: GeneratedCover[] = []

  for (let i = 0; i < albums.length; i++) {
    const album = albums[i]
    const dbId = dbAlbumIds[i]
    const coverId = `album-${dbId}`

    if (progress.completedCovers.includes(coverId)) {
      console.log(`[Covers] ⏭️ Album ${album.index} already generated`)
      continue
    }

    try {
      await limiter.acquire()

      const prompt = buildAlbumCoverPrompt(album)
      const { imageUrl } = await withRetry(
        () => generateImage({ prompt, width: 1024, height: 1024 }),
        `cover-album-${album.index}`
      )

      const cover: GeneratedCover = {
        targetId: dbId,
        targetType: 'album',
        imageUrl,
      }

      results.push(cover)
      progress.completedCovers.push(coverId)
      progress.coverResults[coverId] = { imageUrl, storagePath: '' }
      saveProgress(progress)

      console.log(`[Covers] ✅ Album ${album.index}: "${album.title}"`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Covers] ❌ Album ${album.index}: ${message}`)
      progress.failedCoverIds.push(coverId)
      saveProgress(progress)
    }
  }

  return results
}

export async function generateSongCovers(
  tracks: TrackPrompt[],
  dbSongIds: Record<number, string>,
  progress: SeedProgress
): Promise<GeneratedCover[]> {
  const results: GeneratedCover[] = []

  // 每张专辑选 4 首做封面（优先精选）
  const tracksByAlbum = new Map<number, TrackPrompt[]>()
  for (const track of tracks) {
    if (!tracksByAlbum.has(track.albumIndex)) {
      tracksByAlbum.set(track.albumIndex, [])
    }
    tracksByAlbum.get(track.albumIndex)!.push(track)
  }

  const selectedTracks: TrackPrompt[] = []
  for (const [, albumTracks] of tracksByAlbum) {
    // 先选精选，再补充到4首
    const featured = albumTracks.filter(t => t.isFeatured)
    const others = albumTracks.filter(t => !t.isFeatured)
    const selected = [...featured, ...others].slice(0, 4)
    selectedTracks.push(...selected)
  }

  console.log(`[Covers] Generating ${selectedTracks.length} song covers...`)

  for (const track of selectedTracks) {
    const dbId = dbSongIds[track.id]
    if (!dbId) {
      console.warn(`[Covers] ⚠️ Track ${track.id} has no db ID, skipping`)
      continue
    }

    const coverId = `song-${dbId}`
    if (progress.completedCovers.includes(coverId)) {
      console.log(`[Covers] ⏭️ Song ${track.id} already generated`)
      continue
    }

    try {
      await limiter.acquire()

      const prompt = buildSongCoverPrompt(track)
      const { imageUrl } = await withRetry(
        () => generateImage({ prompt, width: 1024, height: 1024 }),
        `cover-song-${track.id}`
      )

      const cover: GeneratedCover = {
        targetId: dbId,
        targetType: 'song',
        imageUrl,
      }

      results.push(cover)
      progress.completedCovers.push(coverId)
      progress.coverResults[coverId] = { imageUrl, storagePath: '' }
      saveProgress(progress)

      console.log(`[Covers] ✅ Song ${track.id}: "${track.title}"`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Covers] ❌ Song ${track.id}: ${message}`)
      progress.failedCoverIds.push(coverId)
      saveProgress(progress)
    }
  }

  return results
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed-showcase/generators/covers.ts
git commit -m "feat(seed): add cover generator for albums and songs"
```

---

### Task 9: 数据库写入器

**Files:**
- Create: `scripts/seed-showcase/writers/database.ts`

- [ ] **Step 1: 编写 database.ts**

```typescript
import { createClient } from '@supabase/supabase-js'
import { TrackPrompt, AlbumPrompt, GeneratedLyric, GeneratedSong, GeneratedCover, SeedProgress } from '../types'
import { CONFIG } from '../config'
import { saveProgress } from '../utils/progress'

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceRoleKey)

async function ensureSeedUser(): Promise<string> {
  if (CONFIG.seedUserId) {
    return CONFIG.seedUserId
  }

  // 尝试创建系统用户
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'seed@kiyo.local',
    password: crypto.randomUUID(),
    email_confirm: true,
  })

  if (error) {
    if (error.message.includes('already been registered')) {
      // 用户已存在，查找它
      const { data: users } = await supabase.auth.admin.listUsers()
      const existing = users?.users.find(u => u.email === 'seed@kiyo.local')
      if (existing) return existing.id
    }
    throw new Error(`Failed to create seed user: ${error.message}`)
  }

  if (!data.user) throw new Error('Seed user creation returned no user')
  console.log(`[DB] Created seed user: ${data.user.id}`)
  return data.user.id
}

async function downloadAndUploadAudio(userId: string, songId: string, audioUrl: string): Promise<string> {
  const res = await fetch(audioUrl)
  if (!res.ok) throw new Error(`Failed to download audio: ${res.status}`)
  const buffer = await res.arrayBuffer()

  const filePath = `${userId}/${songId}/${Date.now()}.mp3`
  const { error } = await supabase.storage
    .from('audio')
    .upload(filePath, buffer, { contentType: 'audio/mpeg' })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from('audio').getPublicUrl(filePath)
  return data.publicUrl
}

async function downloadAndUploadCover(userId: string, targetId: string, imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`Failed to download cover: ${res.status}`)
  const buffer = await res.arrayBuffer()

  const filePath = `${userId}/${targetId}/${Date.now()}.png`
  const { error } = await supabase.storage
    .from('covers')
    .upload(filePath, buffer, { contentType: 'image/png' })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from('covers').getPublicUrl(filePath)
  return data.publicUrl
}

export async function writeAlbums(
  albums: AlbumPrompt[],
  userId: string,
  progress: SeedProgress
): Promise<string[]> {
  console.log(`[DB] Writing ${albums.length} albums...`)

  const albumData = albums.map(album => ({
    user_id: userId,
    title: album.title,
    description: album.description,
    genre: album.genre,
    status: 'completed',
    cover_status: 'none',
  }))

  const { data, error } = await supabase.from('albums').insert(albumData).select('id')
  if (error) throw new Error(`Album insert failed: ${error.message}`)

  const ids = data.map((a: { id: string }) => a.id)
  progress.dbAlbumIds = ids
  saveProgress(progress)

  console.log(`[DB] ✅ ${ids.length} albums written`)
  return ids
}

export async function writeLyrics(
  lyrics: GeneratedLyric[],
  userId: string,
  progress: SeedProgress
): Promise<Record<number, string>> {
  console.log(`[DB] Writing ${lyrics.length} lyrics...`)

  const lyricData = lyrics.map(lyric => ({
    user_id: userId,
    title: lyric.title,
    content: lyric.content,
    source: 'ai_generated',
    status: 'draft',
    ai_prompt: lyric.content.slice(0, 200),
  }))

  const { data, error } = await supabase.from('lyrics').insert(lyricData).select('id')
  if (error) throw new Error(`Lyrics insert failed: ${error.message}`)

  const ids: Record<number, string> = {}
  for (let i = 0; i < lyrics.length; i++) {
    ids[lyrics[i].trackId] = data[i].id
    progress.lyricResults[lyrics[i].trackId].dbId = data[i].id
  }
  progress.dbLyricIds = ids
  saveProgress(progress)

  console.log(`[DB] ✅ ${Object.keys(ids).length} lyrics written`)
  return ids
}

export async function writeSongs(
  tracks: TrackPrompt[],
  songs: GeneratedSong[],
  lyricIds: Record<number, string>,
  userId: string,
  progress: SeedProgress
): Promise<Record<number, string>> {
  console.log(`[DB] Writing ${songs.length} songs...`)

  const songMap = new Map(songs.map(s => [s.trackId, s]))
  const ids: Record<number, string> = {}

  // 分批写入（每批10首）
  const BATCH_SIZE = 10
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    const batch = tracks.slice(i, i + BATCH_SIZE)
    const batchData = []

    for (const track of batch) {
      const song = songMap.get(track.id)
      if (!song) continue

      batchData.push({
        user_id: userId,
        title: track.title,
        genre: track.genre,
        mood: track.mood,
        ai_prompt: track.prompt,
        source: 'ai_generated',
        status: 'completed',
        is_featured: track.isFeatured,
        lyric_id: track.hasLyrics ? lyricIds[track.id] ?? null : null,
      })
    }

    if (batchData.length === 0) continue

    const { data, error } = await supabase.from('songs').insert(batchData).select('id')
    if (error) throw new Error(`Songs insert failed: ${error.message}`)

    for (let j = 0; j < batch.length; j++) {
      const track = batch[j]
      const song = songMap.get(track.id)
      if (!song || j >= data.length) continue
      ids[track.id] = data[j].id
    }
  }

  progress.dbSongIds = ids
  saveProgress(progress)

  console.log(`[DB] ✅ ${Object.keys(ids).length} songs written`)
  return ids
}

export async function uploadAudioFiles(
  songs: GeneratedSong[],
  dbSongIds: Record<number, string>,
  userId: string,
  progress: SeedProgress
): Promise<void> {
  console.log(`[DB] Uploading ${songs.length} audio files...`)

  for (const song of songs) {
    const dbId = dbSongIds[song.trackId]
    if (!dbId) continue

    try {
      const publicUrl = await downloadAndUploadAudio(userId, dbId, song.audioUrl)
      const storagePath = publicUrl.replace(/^.*\/storage\/v1\/object\/public\/audio\//, '')

      const { error } = await supabase
        .from('songs')
        .update({ audio_url: publicUrl, duration: song.duration, file_path: storagePath })
        .eq('id', dbId)

      if (error) throw new Error(`Update failed: ${error.message}`)

      progress.songResults[song.trackId].storagePath = storagePath
      saveProgress(progress)

      console.log(`[DB] ✅ Audio uploaded for track ${song.trackId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[DB] ❌ Audio upload failed for track ${song.trackId}: ${message}`)
    }
  }
}

export async function writeAlbumSongs(
  tracks: TrackPrompt[],
  dbAlbumIds: string[],
  dbSongIds: Record<number, string>,
  progress: SeedProgress
): Promise<void> {
  console.log(`[DB] Writing album_songs relations...`)

  const relations = tracks
    .map(track => ({
      album_id: dbAlbumIds[track.albumIndex],
      song_id: dbSongIds[track.id],
      order_index: track.id % CONFIG.counts.songsPerAlbum,
    }))
    .filter(r => r.album_id && r.song_id)

  if (relations.length === 0) {
    console.log('[DB] No relations to write')
    return
  }

  const { error } = await supabase.from('album_songs').insert(relations)
  if (error) throw new Error(`Album songs insert failed: ${error.message}`)

  console.log(`[DB] ✅ ${relations.length} album_songs relations written`)
}

export async function uploadCoverFiles(
  covers: GeneratedCover[],
  userId: string,
  progress: SeedProgress
): Promise<void> {
  console.log(`[DB] Uploading ${covers.length} covers...`)

  for (const cover of covers) {
    const coverId = `${cover.targetType}-${cover.targetId}`

    try {
      const publicUrl = await downloadAndUploadCover(userId, cover.targetId, cover.imageUrl)
      const storagePath = publicUrl.replace(/^.*\/storage\/v1\/object\/public\/covers\//, '')

      const table = cover.targetType === 'album' ? 'albums' : 'songs'
      const { error } = await supabase
        .from(table)
        .update({ cover_url: publicUrl, cover_status: 'completed' })
        .eq('id', cover.targetId)

      if (error) throw new Error(`Update failed: ${error.message}`)

      progress.coverResults[coverId].storagePath = storagePath
      saveProgress(progress)

      console.log(`[DB] ✅ Cover uploaded for ${cover.targetType} ${cover.targetId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[DB] ❌ Cover upload failed for ${cover.targetType} ${cover.targetId}: ${message}`)
    }
  }
}

export { ensureSeedUser }
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed-showcase/writers/database.ts
git commit -m "feat(seed): add database writer with audio/cover upload"
```

---

### Task 10: 主入口脚本

**Files:**
- Create: `scripts/seed-showcase/index.ts`

- [ ] **Step 1: 编写 index.ts**

```typescript
import 'dotenv/config'
import { generateAllPrompts } from './prompts'
import { generateAllLyrics } from './generators/lyrics'
import { generateAllSongs } from './generators/songs'
import { generateAlbumCovers, generateSongCovers } from './generators/covers'
import {
  ensureSeedUser,
  writeAlbums,
  writeLyrics,
  writeSongs,
  uploadAudioFiles,
  writeAlbumSongs,
  uploadCoverFiles,
} from './writers/database'
import { loadProgress, saveProgress } from './utils/progress'
import { CONFIG } from './config'

async function main() {
  console.log('🎵 Kiyo Showcase Seed Generator')
  console.log(`   Target: ${CONFIG.counts.totalSongs} songs, ${CONFIG.counts.totalAlbums} albums`)
  console.log('')

  const progress = loadProgress()

  // Phase 0: Ensure seed user
  const userId = await ensureSeedUser()
  console.log(`[System] Seed user ID: ${userId}`)

  // Generate prompts
  const { tracks, albums } = generateAllPrompts()
  console.log(`[System] Generated ${tracks.length} track prompts, ${albums.length} album prompts`)

  // Phase 1: Generate lyrics
  if (progress.phase === 'lyrics') {
    const lyrics = await generateAllLyrics(tracks, progress)
    console.log(`[Phase 1] Generated ${lyrics.length} lyrics`)
    progress.phase = 'songs'
    saveProgress(progress)
  }

  // Phase 2: Generate songs
  if (progress.phase === 'songs') {
    const lyricList = Object.values(progress.lyricResults).map((r, i) => ({
      trackId: Object.keys(progress.lyricResults).map(Number)[i],
      title: tracks.find(t => t.id === Object.keys(progress.lyricResults).map(Number)[i])?.title ?? '',
      content: r.content,
    }))
    const songs = await generateAllSongs(tracks, lyricList, progress)
    console.log(`[Phase 2] Generated ${songs.length} songs`)
    progress.phase = 'covers'
    saveProgress(progress)
  }

  // Phase 3: Write albums + lyrics + songs to DB, upload audio
  if (progress.phase === 'covers') {
    // Write albums first
    if (progress.dbAlbumIds.length === 0) {
      progress.dbAlbumIds = await writeAlbums(albums, userId, progress)
    }

    // Write lyrics
    if (Object.keys(progress.dbLyricIds).length === 0) {
      const lyricList = Object.values(progress.lyricResults).map((r, i) => ({
        trackId: Object.keys(progress.lyricResults).map(Number)[i],
        title: tracks.find(t => t.id === Object.keys(progress.lyricResults).map(Number)[i])?.title ?? '',
        content: r.content,
      }))
      progress.dbLyricIds = await writeLyrics(lyricList, userId, progress)
    }

    // Write songs
    if (Object.keys(progress.dbSongIds).length === 0) {
      const songList = Object.values(progress.songResults).map((r, i) => ({
        trackId: Object.keys(progress.songResults).map(Number)[i],
        title: tracks.find(t => t.id === Object.keys(progress.songResults).map(Number)[i])?.title ?? '',
        audioUrl: r.audioUrl,
        duration: r.duration,
      }))
      progress.dbSongIds = await writeSongs(tracks, songList, progress.dbLyricIds, userId, progress)
    }

    // Upload audio files
    const songList = Object.values(progress.songResults).map((r, i) => ({
      trackId: Object.keys(progress.songResults).map(Number)[i],
      title: tracks.find(t => t.id === Object.keys(progress.songResults).map(Number)[i])?.title ?? '',
      audioUrl: r.audioUrl,
      duration: r.duration,
    }))
    await uploadAudioFiles(songList, progress.dbSongIds, userId, progress)

    // Write album_songs relations
    await writeAlbumSongs(tracks, progress.dbAlbumIds, progress.dbSongIds, progress)

    progress.phase = 'database'
    saveProgress(progress)
  }

  // Phase 4: Generate and upload covers
  if (progress.phase === 'database') {
    // Album covers
    const albumCovers = await generateAlbumCovers(albums, progress.dbAlbumIds, progress)
    await uploadCoverFiles(albumCovers, userId, progress)

    // Song covers
    const songCovers = await generateSongCovers(tracks, progress.dbSongIds, progress)
    await uploadCoverFiles(songCovers, userId, progress)

    progress.phase = 'completed'
    saveProgress(progress)
  }

  console.log('')
  console.log('✅ Seed generation complete!')
  console.log(`   Albums: ${progress.dbAlbumIds.length}`)
  console.log(`   Songs: ${Object.keys(progress.dbSongIds).length}`)
  console.log(`   Lyrics: ${Object.keys(progress.dbLyricIds).length}`)
  console.log(`   Covers: ${progress.completedCovers.length}`)
  console.log(`   Failed tracks: ${progress.failedTrackIds.length}`)
  console.log(`   Failed covers: ${progress.failedCoverIds.length}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed-showcase/index.ts
git commit -m "feat(seed): add main entry point with phased execution"
```

---

### Task 11: 根目录 package.json 添加 seed 脚本

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 修改 package.json**

在 `scripts` 中添加：

```json
{
  "scripts": {
    "seed:showcase": "tsx scripts/seed-showcase/index.ts"
  }
}
```

同时确保根目录安装了 `tsx`：

```bash
pnpm add -D tsx dotenv
```

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(seed): add seed:showcase npm script and tsx dependency"
```

---

### Task 12: Showcase 组件改造

**Files:**
- Modify: `apps/web/src/components/sections/showcase.tsx`

- [ ] **Step 1: 改造 showcase.tsx 为 Server Component**

```tsx
import { createClient } from '@supabase/supabase-js'
import { ScrollReveal } from '../scroll-reveal'

interface FeaturedTrack {
  id: string
  title: string
  genre: string | null
  mood: string | null
  cover_url: string | null
  duration: number | null
  albums: { title: string } | null
}

async function getFeaturedTracks(): Promise<FeaturedTrack[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars')
    return []
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase
    .from('songs')
    .select('id, title, genre, mood, cover_url, duration, albums(title)')
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(6)

  if (error) {
    console.error('Failed to fetch featured tracks:', error)
    return []
  }

  return data as FeaturedTrack[]
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export async function Showcase() {
  const tracks = await getFeaturedTracks()

  if (!tracks || tracks.length === 0) {
    return null
  }

  return (
    <section id="showcase" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Featured Works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Created with Kiyo
          </h2>
          <p className="mt-4 text-muted-foreground">
            Discover what creators are making with AI-powered music generation.
          </p>
        </ScrollReveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track, idx) => (
            <ScrollReveal key={track.id} delay={(idx % 3) * 0.08}>
              <article className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-card">
                {track.cover_url ? (
                  <img
                    src={track.cover_url}
                    alt={track.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-cyan-400 opacity-90 transition-transform duration-700 group-hover:scale-105" />
                )}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.5)_85%)]"
                />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-xs uppercase tracking-wider opacity-80">
                    {track.genre ?? 'Music'}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">
                    {track.title}
                  </h3>
                  <p className="mt-1 text-xs opacity-75">
                    {track.mood ?? 'Various'} · {formatDuration(track.duration)}
                  </p>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
```

注意：这里 `ScrollReveal` 是 client component，在 Server Component 中使用 client component 是允许的。但需要确保 `ScrollReveal` 接受 children。

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/sections/showcase.tsx
git commit -m "feat(showcase): rewrite as Server Component querying real featured tracks"
```

---

### Task 13: 类型检查与测试

**Files:**
- Run: 命令

- [ ] **Step 1: 安装 dotenv 并验证脚本可编译**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
pnpm add -D dotenv
```

- [ ] **Step 2: 类型检查**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
npx tsc --noEmit scripts/seed-showcase/index.ts --moduleResolution node --esModuleInterop --target es2022 --module esnext
```

Expected: 无类型错误。

- [ ] **Step 3: 运行 dry-run 测试（不调用 API）**

这个需要手动确认。先配置 `.env`：

```bash
cp scripts/seed-showcase/.env.example scripts/seed-showcase/.env
# 编辑 .env 填入真实值
```

然后设置 `LIMIT=2` 测试：

```bash
LIMIT=2 pnpm seed:showcase
```

Expected: 生成 2 首歌，成功写入数据库和 Storage。

- [ ] **Step 4: 验证 Showcase 组件**

```bash
pnpm type-check -- --filter=web
```

Expected: 无类型错误。

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(seed): add dotenv and verify types"
```

---

## Self-Review

### Spec Coverage Check

| Spec 需求 | 对应 Task |
|-----------|-----------|
| 100 首歌 + 50 张封面 | Task 4 (prompts), Task 6-8 (generators), Task 9 (writer) |
| 10 张专辑 × 10 首 | Task 4 (albums array), Task 9 (writeAlbums + writeAlbumSongs) |
| 70 首纯音乐 + 30 首带歌词 | Task 4 (hasLyrics flag), Task 6 (conditional lyrics) |
| 混合组织（专辑+散装） | Task 4 (albums + tracks relation), Task 9 (album_songs) |
| 限流 | Task 5 (RateLimiter) |
| 重试 | Task 5 (withRetry) |
| 断点续跑 | Task 5 (progress.ts), Task 10 (phased execution) |
| 数据库写入 | Task 9 (database.ts) |
| is_featured 字段 | Task 1 (migration) |
| anon RLS 策略 | Task 1 (migration) |
| Showcase 组件改造 | Task 12 |
| 用户归属 | Task 9 (ensureSeedUser) |

### Placeholder Scan

- 无 TBD/TODO
- 所有步骤都有具体代码
- 所有文件路径都是绝对路径

### Type Consistency

- `TrackPrompt.id` 是 `number`，在 generators 和 writers 中一致使用
- `SeedProgress` 的 key 命名在各文件中一致
- `GeneratedCover.targetId` 是 `string`（数据库 UUID），与 `dbSongIds` / `dbAlbumIds` 类型一致

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-09-showcase-seed.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review

**Which approach?**
