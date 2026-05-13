import { config as dotenvConfig } from 'dotenv'
import { existsSync } from 'fs'
import { mkdir, writeFile, rm, readFile } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { resolve } from 'path'

const execFileAsync = promisify(execFile)

for (const candidate of [
  resolve(process.cwd(), 'apps/web/.env.local'),
  resolve(process.cwd(), '.env.local'),
]) {
  if (existsSync(candidate)) {
    dotenvConfig({ path: candidate, override: false })
  }
}

let generateLyrics: (options: { prompt: string; mode?: 'write_full_song' }) => Promise<{ text: string }>
let generateMusic: (options: {
  prompt?: string
  lyrics?: string
  genre?: string
  mood?: string
  isInstrumental?: boolean
  lyricsOptimizer?: boolean
}) => Promise<{ audioUrl: string; duration: number }>
let generateCover: (options: { voiceStyle: string; audioUrl: string }) => Promise<{ audioUrl: string; duration: number }>
let generateImage: (options: {
  prompt: string
  width?: number
  height?: number
  model?: string
}) => Promise<{ imageUrl: string }>

const RUN_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
}).format(new Date())

const RUN_ROOT = resolve(process.cwd(), 'generated/minimax', RUN_DATE, 'quota-burn')
const LYRIC_ROOT = resolve(RUN_ROOT, 'lyrics-music')
const COVER_ROOT = resolve(RUN_ROOT, 'music-cover')
const IMAGE_ROOT = resolve(RUN_ROOT, 'images')
const SUMMARY_PATH = resolve(RUN_ROOT, 'summary.json')

const TARGETS = {
  lyricsMusic: 63,
  lyricsOnly: 0,
  musicOnly: 6,
  cover: 63,
  image: 4,
}

type ExistingTrack = {
  batch: string
  title: string
  audioUrl: string
}

type BurnSummary = {
  runDate: string
  generatedAt: string
  targets: typeof TARGETS
  completed: {
    lyricsMusic: number
    lyricsOnly: number
    musicOnly: number
    cover: number
    image: number
  }
  failures: string[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

class RateGate {
  private queue: Promise<void> = Promise.resolve()
  private nextStartAt = 0

  constructor(private readonly minIntervalMs: number) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const scheduled = this.queue.then(async () => {
      const waitMs = Math.max(0, this.nextStartAt - Date.now())
      if (waitMs > 0) {
        await sleep(waitMs)
      }

      this.nextStartAt = Date.now() + this.minIntervalMs
      return fn()
    })

    this.queue = scheduled.then(
      () => undefined,
      () => undefined
    )

    return scheduled
  }
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 4,
  baseDelayMs = 3000
): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[${label}] attempt ${attempt} failed: ${message}`)

      if (attempt < attempts) {
        const waitMs = baseDelayMs * 2 ** (attempt - 1)
        console.warn(`[${label}] retrying in ${waitMs}ms`)
        await sleep(waitMs)
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed`)
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

async function fetchBinary(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function saveMp3(url: string, filePath: string): Promise<void> {
  const bytes = await fetchBinary(url)
  await writeFile(filePath, bytes)
}

async function savePng(url: string, filePath: string): Promise<void> {
  const tmpPath = filePath.replace(/\.png$/i, '.jpg')
  const bytes = await fetchBinary(url)
  await writeFile(tmpPath, bytes)
  try {
    await execFileAsync('sips', ['-s', 'format', 'png', tmpPath, '--out', filePath])
  } finally {
    await rm(tmpPath, { force: true })
  }
}

function lyricPrompt(index: number): string {
  const themes = [
    'a city after rain',
    'late-night train rides',
    'a new beginning after loss',
    'glowing billboards at midnight',
    'quiet hope in a noisy world',
    'a summer drive with the windows down',
    'an honest goodbye',
    'finding a way back to yourself',
  ]
  const moods = ['hopeful', 'melancholic', 'uplifting', 'dreamy', 'restless', 'tender', 'resilient', 'nostalgic']
  const genres = ['synth-pop', 'indie pop', 'alt R&B', 'electro-pop', 'folk-pop', 'cinematic pop', 'dream pop', 'city pop']
  const theme = themes[index % themes.length]
  const mood = moods[(index * 3) % moods.length]
  const genre = genres[(index * 5) % genres.length]
  return `Write an original English ${genre} song with a ${mood} mood about ${theme}. Keep it singable, emotionally clear, and free of copyrighted references.`
}

function musicPrompt(index: number): { prompt: string; genre: string; mood: string } {
  const genres = ['synth-pop', 'indie pop', 'alt R&B', 'electro-pop', 'folk-pop', 'cinematic pop', 'dream pop', 'city pop']
  const moods = ['hopeful', 'melancholic', 'uplifting', 'dreamy', 'restless', 'tender', 'resilient', 'nostalgic']
  const genre = genres[index % genres.length]
  const mood = moods[(index * 2) % moods.length]
  const prompt = `A polished ${genre} track with a ${mood} emotional arc, strong chorus, and contemporary production.`
  return { prompt, genre, mood }
}

function coverStyle(index: number): string {
  const styles = [
    'smoky baritone',
    'breathy intimate delivery',
    'bright youthful vocals',
    'gritty emotional vocals',
    'smooth falsetto',
    'soulful lead with harmonies',
    'cool detached vocal tone',
    'dramatic heartfelt vocals',
  ]
  return styles[index % styles.length]
}

function imagePrompt(index: number): string {
  const concepts = [
    'neon highway at dawn',
    'rainy city street with reflections',
    'floating chrome flowers',
    'moonlit train platform',
    'glassy ocean horizon',
    'retro cassette dreamscape',
    'soft gradients and stars',
    'urban rooftop sunrise',
  ]
  const concept = concepts[index % concepts.length]
  return `Square album cover, ${concept}, cinematic composition, bold color contrast, no text, no logo.`
}

async function loadExistingTracks(): Promise<ExistingTrack[]> {
  const summaryPath = resolve(process.cwd(), 'generated/minimax/2026-05-13/summary.json')
  const raw = await readFile(summaryPath, 'utf8')
  const summary = JSON.parse(raw) as { tracks: ExistingTrack[] }
  return summary.tracks
}

async function loadAi(): Promise<void> {
  const aiModule = await import('../../packages/ai/index.ts')
  const ai = (aiModule as { default?: Record<string, unknown> }).default ?? aiModule
  const loaded = ai as {
    generateLyrics: (options: { prompt: string; mode?: 'write_full_song' }) => Promise<{ text: string }>
    generateMusic: (options: {
      prompt?: string
      lyrics?: string
      genre?: string
      mood?: string
      isInstrumental?: boolean
      lyricsOptimizer?: boolean
    }) => Promise<{ audioUrl: string; duration: number }>
    generateCover: (options: { voiceStyle: string; audioUrl: string }) => Promise<{ audioUrl: string; duration: number }>
    generateImage: (options: {
      prompt: string
      width?: number
      height?: number
      model?: string
    }) => Promise<{ imageUrl: string }>
  }

  generateLyrics = loaded.generateLyrics
  generateMusic = loaded.generateMusic
  generateCover = loaded.generateCover
  generateImage = loaded.generateImage
}

async function run(): Promise<void> {
  await ensureDir(LYRIC_ROOT)
  await ensureDir(COVER_ROOT)
  await ensureDir(IMAGE_ROOT)

  const tracks = await loadExistingTracks()
  const lyricGate = new RateGate(20_000)
  const musicGate = new RateGate(10_000)
  const coverGate = new RateGate(12_000)
  const imageGate = new RateGate(0)

  const summary: BurnSummary = {
    runDate: RUN_DATE,
    generatedAt: new Date().toISOString(),
    targets: TARGETS,
    completed: {
      lyricsMusic: 0,
      lyricsOnly: 0,
      musicOnly: 0,
      cover: 0,
      image: 0,
    },
    failures: [],
  }

  const lyricMusicTasks = Array.from({ length: TARGETS.lyricsMusic }, (_, index) => index)
  const musicOnlyTasks = Array.from({ length: TARGETS.musicOnly }, (_, index) => index)
  const coverTasks = Array.from({ length: TARGETS.cover }, (_, index) => index)
  const imageTasks = Array.from({ length: TARGETS.image }, (_, index) => index)

  const lyricMusicPromise = Promise.all(
    lyricMusicTasks.map((index) =>
      (async () => {
        const batch = `lyric-music-${String(index + 1).padStart(3, '0')}`
        const dir = resolve(LYRIC_ROOT, batch)
        await ensureDir(dir)
        try {
          const lyricsText = await withRetry(
            `${batch}/lyrics`,
            () =>
              lyricGate.run(async () => {
                const result = await generateLyrics({
                  prompt: lyricPrompt(index),
                  mode: 'write_full_song',
                })
                return result.text
              })
          )

          const musicResult = await withRetry(
            `${batch}/music`,
            () =>
              musicGate.run(async () => {
                const { prompt, genre, mood } = musicPrompt(index)
                return generateMusic({
                  prompt,
                  lyrics: lyricsText,
                  genre,
                  mood,
                })
              })
          )

          await writeFile(resolve(dir, 'lyrics.txt'), `${lyricsText.trim()}\n`, 'utf8')
          await saveMp3(musicResult.audioUrl, resolve(dir, 'song.mp3'))
          await writeFile(
            resolve(dir, 'song.json'),
            `${JSON.stringify({ batch, lyrics: lyricsText.trim(), audioUrl: musicResult.audioUrl, duration: musicResult.duration }, null, 2)}\n`,
            'utf8'
          )
          summary.completed.lyricsMusic++
          console.log(`[${batch}] done`)
        } catch (error) {
          const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
          summary.failures.push(`lyricsMusic:${index + 1}:${message}`)
          console.error(`[${batch}] failed: ${message}`)
        }
      })()
    )
  )

  const musicOnlyPromise = Promise.all(
    musicOnlyTasks.map((index) =>
      (async () => {
        const batch = `music-only-${String(index + 1).padStart(3, '0')}`
        const dir = resolve(LYRIC_ROOT, batch)
        await ensureDir(dir)
        try {
          const musicResult = await withRetry(
            `${batch}/music`,
            () =>
              musicGate.run(async () => {
                const { prompt, genre, mood } = musicPrompt(index + TARGETS.lyricsMusic)
                return generateMusic({
                  prompt,
                  genre,
                  mood,
                  isInstrumental: true,
                })
              })
          )

          await saveMp3(musicResult.audioUrl, resolve(dir, 'song.mp3'))
          await writeFile(
            resolve(dir, 'song.json'),
            `${JSON.stringify({ batch, audioUrl: musicResult.audioUrl, duration: musicResult.duration, instrumental: true }, null, 2)}\n`,
            'utf8'
          )
          summary.completed.musicOnly++
          console.log(`[${batch}] done`)
        } catch (error) {
          const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
          summary.failures.push(`musicOnly:${index + 1}:${message}`)
          console.error(`[${batch}] failed: ${message}`)
        }
      })()
    )
  )

  const coverPromise = Promise.all(
    coverTasks.map((index) =>
      (async () => {
        const batch = `cover-remix-${String(index + 1).padStart(3, '0')}`
        const dir = resolve(COVER_ROOT, batch)
        await ensureDir(dir)
        const source = tracks[index % tracks.length]
        try {
          const coverResult = await withRetry(
            `${batch}/cover`,
            () =>
              coverGate.run(async () =>
                generateCover({
                  voiceStyle: coverStyle(index),
                  audioUrl: source.audioUrl,
                })
              )
          )

          await saveMp3(coverResult.audioUrl, resolve(dir, 'cover.mp3'))
          await writeFile(
            resolve(dir, 'song.json'),
            `${JSON.stringify({ batch, sourceBatch: source.batch, sourceTitle: source.title, audioUrl: coverResult.audioUrl, duration: coverResult.duration }, null, 2)}\n`,
            'utf8'
          )
          summary.completed.cover++
          console.log(`[${batch}] done from ${source.batch}`)
        } catch (error) {
          const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
          summary.failures.push(`cover:${index + 1}:${message}`)
          console.error(`[${batch}] failed: ${message}`)
        }
      })()
    )
  )

  const imagePromise = Promise.all(
    imageTasks.map((index) =>
      (async () => {
        const batch = `image-${String(index + 1).padStart(3, '0')}`
        const dir = resolve(IMAGE_ROOT, batch)
        await ensureDir(dir)
        try {
          const imageResult = await withRetry(
            `${batch}/image`,
            () =>
              imageGate.run(async () =>
                generateImage({
                  prompt: imagePrompt(index),
                  width: 1024,
                  height: 1024,
                })
              )
          )

          await savePng(imageResult.imageUrl, resolve(dir, 'cover.png'))
          await writeFile(
            resolve(dir, 'song.json'),
            `${JSON.stringify({ batch, imageUrl: imageResult.imageUrl }, null, 2)}\n`,
            'utf8'
          )
          summary.completed.image++
          console.log(`[${batch}] done`)
        } catch (error) {
          const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
          summary.failures.push(`image:${index + 1}:${message}`)
          console.error(`[${batch}] failed: ${message}`)
        }
      })()
    )
  )

  await Promise.all([lyricMusicPromise, musicOnlyPromise, coverPromise, imagePromise])

  await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  await writeFile(
    resolve(RUN_ROOT, 'README.md'),
    `# ${RUN_DATE} MiniMax 清额度记录\n\n` +
      `- lyrics + music: ${summary.completed.lyricsMusic}/${TARGETS.lyricsMusic}\n` +
      `- music only: ${summary.completed.musicOnly}/${TARGETS.musicOnly}\n` +
      `- music-cover: ${summary.completed.cover}/${TARGETS.cover}\n` +
      `- image-01: ${summary.completed.image}/${TARGETS.image}\n` +
      `- failures: ${summary.failures.length}\n`,
    'utf8'
  )
}

async function bootstrap(): Promise<void> {
  await loadAi()
  await run()
}

void bootstrap().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
