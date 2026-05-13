import { config as dotenvConfig } from 'dotenv'
import { existsSync } from 'fs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { execFile } from 'child_process'
import { resolve } from 'path'
import { promisify } from 'util'

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
let generateImage: (options: {
  prompt: string
  width?: number
  height?: number
  model?: string
}) => Promise<{ imageUrl: string }>

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
    generateImage: (options: {
      prompt: string
      width?: number
      height?: number
      model?: string
    }) => Promise<{ imageUrl: string }>
  }

  generateLyrics = loaded.generateLyrics
  generateMusic = loaded.generateMusic
  generateImage = loaded.generateImage
}

type Concept = {
  title: string
  genre: string
  mood: string
  theme: string
  sonic: string
  visual: string
}

type TrackRecord = {
  batch: string
  title: string
  genre: string
  mood: string
  theme: string
  sonic: string
  visual: string
  lyricsPrompt: string
  musicPrompt: string
  coverPrompt: string
  lyrics: string
  audioUrl: string
  imageUrl: string
  durationSeconds: number
  files: {
    lyrics: string
    song: string
    cover: string
    songJson: string
    audioUrl: string
  }
}

type Summary = {
  runDate: string
  generatedAt: string
  totalConcepts: number
  finalCount: number
  discardedCount: number
  tracks: TrackRecord[]
}

const c = (
  title: string,
  genre: string,
  mood: string,
  theme: string,
  sonic: string,
  visual: string
): Concept => ({ title, genre, mood, theme, sonic, visual })

const CONCEPTS: Concept[] = [
  c(
    'Neon Harbor',
    'synth-pop',
    'hopeful',
    'a rain-soaked harbor city where the narrator chooses a second chance at love',
    'shimmering arpeggiators, punchy four-on-the-floor drums, glossy bass, wide chorus',
    'rain-slick waterfront street, harbor lights, teal and magenta reflections, solitary figure under an awning'
  ),
  c(
    'Glass Suns',
    'dream pop',
    'bittersweet',
    'a long drive toward sunrise after a hard goodbye',
    'washed guitars, drifting pads, soft pulse drums, airy vocal layers',
    'desert highway at dawn, pale gold sky, violet horizon, chrome car'
  ),
  c(
    'Static Hearts',
    'electro-pop',
    'rebellious',
    'breaking free from a stale digital romance',
    'tight bass synth, clipped drums, neon stabs, anthemic chorus',
    'rooftop antennas, electric blue sparks, night skyline, glitch accents'
  ),
  c(
    'Paper Lantern Road',
    'indie folk',
    'intimate',
    'a quiet road home with memories tucked in the glovebox',
    'fingerpicked acoustic guitar, brushed percussion, warm harmonies, subtle cello',
    'country road at dusk, paper lanterns hanging from trees, amber light'
  ),
  c(
    'After the Flood',
    'cinematic ballad',
    'resilient',
    'rebuilding after a storm and finding grace in the aftermath',
    'piano-led intro, swelling strings, slow drums, big final lift',
    'floodwater receding from a small town street, dawn breaking through clouds'
  ),
  c(
    'Velvet City',
    'alt R&B',
    'luxurious',
    'a midnight conversation in a velvet lounge that turns into a confession',
    'silky bass, Rhodes chords, sparse drums, breathy ad-libs',
    'crimson lounge, gold mirrors, velvet curtains, soft cigarette haze'
  ),
  c(
    'Midnight Algorithm',
    'techno',
    'precise',
    'a mind racing through data and loneliness after midnight',
    'mechanical kick, rolling percussion, filtered synth sequence, cold metallic textures',
    'server farm corridors, laser grid, chrome and black, blue glow'
  ),
  c(
    'Rain on the Skylines',
    'piano pop',
    'reflective',
    'watching the city through a rainy window and learning to forgive',
    'upright piano, restrained beat, string swells, heartfelt chorus',
    'skyscrapers blurred by rain on glass, muted neon, city lights'
  ),
  c(
    'Carousel Without Lights',
    'indie rock',
    'nostalgic',
    'returning to an abandoned amusement park where childhood still echoes',
    'jangly guitars, driving bass, live drums, singalong bridge',
    'empty carousel at twilight, rusted lights, faded balloons'
  ),
  c(
    'Silver Current',
    'ambient electronica',
    'peaceful',
    'drifting with the tide until the body and mind slow down',
    'soft pulses, granular pads, distant piano notes, slow motion textures',
    'moonlit ocean current, silver ripples, navy sky, minimal composition'
  ),
  c(
    'Borrowed Light',
    'folk-pop',
    'tender',
    'sharing a borrowed apartment and realizing warmth can be temporary yet real',
    'acoustic guitar, hand percussion, close harmonies, gentle banjo',
    'small apartment window at dawn, striped curtains, warm lamp light'
  ),
  c(
    'Ghosts in the Kitchen',
    'soul',
    'warm',
    'late-night cooking for the people who stay when everything else leaves',
    'smoky organ, bass groove, brushed snare, gospel backing vocals',
    'kitchen steam, yellow pendant light, cast iron pans, intimate home scene'
  ),
  c(
    'Fire Escape Sunday',
    'indie pop',
    'youthful',
    'a lazy city Sunday spent on a fire escape, laughing at the future',
    'bright guitar hooks, loose drums, clapping rhythm, sunny hook',
    'brick apartment fire escape, laundry lines, blue sky, city haze'
  ),
  c(
    'Zero Gravity Kiss',
    'futuristic pop',
    'euphoric',
    'two people floating above a neon orbit and letting go of fear',
    'sparkling synth leads, deep sub bass, pulsing beat, euphoric lift',
    'futuristic space station, floating bodies, neon rings, starfield'
  ),
  c(
    'Broken Compass',
    'post-rock',
    'searching',
    'a stormy coastline where the narrator learns to navigate by feeling',
    'slow build guitars, tremolo lines, huge crescendos, cinematic drums',
    'shattered compass on wet rocks, storm sea, gray sky'
  ),
  c(
    'Sugar Satellites',
    'bubblegum pop',
    'playful',
    'a candy-colored romance between two people orbiting each other',
    'bouncy synth bass, sparkling bells, handclaps, high-energy chorus',
    'pastel planets, candy stripes, glossy stars, bright playful palette'
  ),
  c(
    'Last Train Home',
    'blues-folk',
    'weary',
    'missing the last train and deciding to walk through the night instead',
    'slide guitar, harmonica, woody kick drum, smoky vocal',
    'empty platform, sepia streetlights, steam, worn benches'
  ),
  c(
    'Echo Park Memory',
    'alternative rock',
    'haunting',
    'a city park lake that reflects every version of a lost friendship',
    'chorused guitars, pulsing bass, emotional lift, wide drums',
    'urban park lake at night, mirrored skyline, faint ripples, cool shadows'
  ),
  c(
    'Blue Neon Prayer',
    'gospel R&B',
    'uplifted',
    'turning a private plea into a communal shout of hope',
    'organ swells, choir responses, groove bass, strong vocal ad-libs',
    'stained-glass chapel with neon light spilling in, blue and gold'
  ),
  c(
    'Soft Launch',
    'synthwave',
    'flirty',
    'testing the waters of a new romance with a wink and a smile',
    'retro drum machine, warm analog pads, catchy hook, shimmering chorus',
    'retro computer screens, sunset gradients, chrome details, playful geometry'
  ),
  c(
    'Lake House Static',
    'acoustic ambient',
    'contemplative',
    'staying at a lake house where the radio only catches fragments of the past',
    'open-tuned acoustic guitar, field-recorded ambience, sparse piano, long decay',
    'misty lake cabin, quiet dock, radio glow, morning fog'
  ),
  c(
    'Chrome Wildflower',
    'art pop',
    'defiant',
    'a flower pushing through concrete and learning to shine anyway',
    'glittering synths, angular percussion, dramatic chorus, bold vocal lines',
    'metallic flowers growing through cracked concrete, reflective chrome petals'
  ),
  c(
    'Moonlit Repairs',
    'singer-songwriter',
    'healing',
    'fixing broken things in the workshop after everyone else has gone to bed',
    'gentle guitar, soft brushed drums, cello undercurrent, intimate vocal',
    'late-night workshop, tools on a bench, moonlight through windows'
  ),
  c(
    'Fever in the Arcade',
    'dance pop',
    'energized',
    'falling for a stranger under blinking arcade lights',
    'four-on-the-floor beat, punchy synth brass, catchy chants, glittering drops',
    'neon arcade interior, motion blur, bright cabinets, spinning lights'
  ),
  c(
    'Quiet Riot',
    'punk-indie',
    'fierce',
    'a small act of resistance that starts with a whisper',
    'crunchy guitars, fast drums, shouted chorus, raw edges',
    'torn posters, sticker-covered walls, alley protest scene, bold reds'
  ),
  c(
    'North Star Motel',
    'country folk',
    'lonely',
    'sleeping at a roadside motel and following the north star home',
    'acoustic strums, pedal steel, gentle fiddle, dusty rhythm',
    'desert roadside motel, neon sign, starry sky, empty parking lot'
  ),
  c(
    'Tidal Memory',
    'lounge/soul',
    'smoky',
    'remembering a summer that still tastes like salt and citrus',
    'laid-back groove, electric piano, mellow bass, brushed drums',
    'jazz bar by the sea, blue tide reflections, amber interior light'
  ),
  c(
    'Warm Data',
    'future funk',
    'optimistic',
    'turning numbers and dashboards into a song about human possibility',
    'funk bass, bright synth horns, shuffled drums, upbeat chorus',
    'glowing dashboards, holographic graphs, warm orange and mint palette'
  ),
  c(
    'Open Window, Closed City',
    'chamber pop',
    'guarded',
    'standing at a window while the city sleeps and the heart stays cautious',
    'string quartet, soft piano, intimate percussion, restrained swell',
    'apartment window over silent streets, curtains moving, dim moonlight'
  ),
  c(
    'Final Bloom',
    'cinematic indie',
    'triumphant',
    'a final act of growth after grief, opening into spring',
    'anthemic drums, rising strings, guitar shimmer, cathartic final chorus',
    'single flower blooming through cracked pavement at sunrise, radiant gold light'
  ),
  c(
    'Concrete Aurora',
    'hyperpop',
    'electric',
    'a city waking up under a synthetic northern light',
    'glitchy synth bursts, elastic bass, pitched vocals, explosive chorus',
    'high-rise skyline under aurora ribbons, mirrored glass, intense cyan and pink glow'
  ),
  c(
    'Moon Market',
    'world pop',
    'curious',
    'wandering a night market that only appears under a full moon',
    'hand drums, plucked strings, bass groove, airy vocal hook',
    'open-air night market, moon overhead, lanterns, spices, silk textures'
  ),
  c(
    'Afterimage',
    'art rock',
    'haunted',
    'the lingering shape of someone who changed your life',
    'angular guitars, dramatic drums, shifting dynamics, echoing bridge',
    'double-exposure portrait, blurred motion trails, dusk city backdrop'
  ),
  c(
    'Run the Redline',
    'drum and bass',
    'urgent',
    'a night run through the city to catch a life-changing answer',
    'fast breakbeats, sub bass, sharp synths, high-energy drop',
    'speeding train lines, streaked neon, motion blur, midnight transit map'
  ),
  c(
    'Soft Machines',
    'minimal electronica',
    'thoughtful',
    'finding tenderness inside a world built from automation',
    'tiny pulses, sparse percussion, granular textures, restrained melody',
    'floating machine parts in a quiet white room, delicate blue highlights'
  ),
  c(
    'Lavender Signal',
    'dream synth',
    'romantic',
    'receiving a secret message on a frequency only hearts can hear',
    'lush pads, delayed keys, soft kick, glowing top-line melody',
    'lavender clouds over a radio tower, signal waves, dusk gradient sky'
  ),
  c(
    'Northbound Neon',
    'city pop',
    'hopeful',
    'driving north with the windows down and the future open wide',
    'bright bassline, crisp drums, glossy guitars, chorus lift',
    'night highway leading into sunrise, reflective car hood, neon signs fading behind'
  ),
  c(
    'Tideglass',
    'folk ambient',
    'serene',
    'watching the tide move through a glassy morning cove',
    'gentle acoustic layers, field recordings, soft drones, light flute',
    'shoreline cove with glass-like water, pale sand, misty horizon'
  ),
  c(
    'Velvet Exit',
    'dark pop',
    'sly',
    'slipping out of a glamorous party to reclaim your own night',
    'dark synth bass, snapping percussion, seductive hook, moody breakdown',
    'luxury hallway, velvet rope, chrome elevator, red and black palette'
  ),
  c(
    'Skyline Compost',
    'indie electronic',
    'grounded',
    'turning old regrets into soil for something greener',
    'organic percussion, pulsing synths, warm bass, hopeful lift',
    'rooftop garden growing from concrete, city skyline, sunrise haze'
  ),
]

const RUN_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
}).format(new Date())

const RUN_ROOT = resolve(process.cwd(), 'generated/minimax', RUN_DATE)
const FINAL_ROOT = resolve(RUN_ROOT, 'final')
const DISCARDED_ROOT = resolve(RUN_ROOT, 'discarded')
const SUMMARY_PATH = resolve(RUN_ROOT, 'summary.json')
const START_INDEX = Number(process.env.START_INDEX || '0')
const TARGET_COUNT = Number(process.env.COUNT || '30')
const SELECTED_CONCEPTS = CONCEPTS.slice(START_INDEX, START_INDEX + TARGET_COUNT)

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

class RateGate {
  private chain: Promise<void> = Promise.resolve()
  private nextStartAt = 0

  constructor(private readonly minIntervalMs: number) {}

  run<T>(fn: () => Promise<T>): Promise<T> {
    const scheduled = this.chain.then(async () => {
      const waitMs = Math.max(0, this.nextStartAt - Date.now())
      if (waitMs > 0) {
        await sleep(waitMs)
      }

      this.nextStartAt = Date.now() + this.minIntervalMs
      return fn()
    })

    this.chain = scheduled.then(
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

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed`)
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

async function downloadAudio(url: string, filePath: string): Promise<void> {
  const bytes = await fetchBinary(url)
  await writeFile(filePath, bytes)
}

async function downloadPng(url: string, filePath: string): Promise<void> {
  const tmpJpgPath = filePath.replace(/\.png$/i, '.jpg')
  const bytes = await fetchBinary(url)
  await writeFile(tmpJpgPath, bytes)
  try {
    await execFileAsync('sips', ['-s', 'format', 'png', tmpJpgPath, '--out', filePath])
  } finally {
    await rm(tmpJpgPath, { force: true })
  }
}

function batchName(index: number): string {
  return `batch-${String(START_INDEX + index + 1).padStart(3, '0')}`
}

function buildLyricsPrompt(concept: Concept): string {
  return [
    `Write an original English song titled "${concept.title}" in ${concept.genre} style.`,
    `Mood: ${concept.mood}. Theme: ${concept.theme}.`,
    `Sonic direction: ${concept.sonic}.`,
    'Structure: verse 1, pre-chorus, chorus, verse 2, pre-chorus, chorus, bridge, final chorus.',
    'Keep the lyrics singable, emotionally clear, and free of copyrighted references.',
  ].join(' ')
}

function buildMusicPrompt(concept: Concept): string {
  return `${concept.sonic}. ${concept.genre} production. ${concept.mood} emotion. Inspired by ${concept.theme}.`
}

function buildCoverPrompt(concept: Concept): string {
  return `Square album cover for "${concept.title}": ${concept.visual}. ${concept.genre} mood, ${concept.mood} emotion, cinematic lighting, high detail, no text, no logo.`
}

type JsonSongRecord = TrackRecord

async function readSongJson(filePath: string): Promise<JsonSongRecord | null> {
  if (!existsSync(filePath)) {
    return null
  }

  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw) as JsonSongRecord
}

async function loadExistingSummary(): Promise<Summary | null> {
  if (!existsSync(SUMMARY_PATH)) {
    return null
  }

  const raw = await readFile(SUMMARY_PATH, 'utf8')
  return JSON.parse(raw) as Summary
}

async function processConcept(
  concept: Concept,
  index: number,
  lyricGate: RateGate,
  musicGate: RateGate,
  coverGate: RateGate
): Promise<TrackRecord | null> {
  const batch = batchName(index)
  const batchDir = resolve(FINAL_ROOT, batch)
  await ensureDir(batchDir)

  const lyricsPath = resolve(batchDir, 'lyrics.txt')
  const songPath = resolve(batchDir, 'song.mp3')
  const coverPath = resolve(batchDir, 'cover.png')
  const songJsonPath = resolve(batchDir, 'song.json')
  const audioUrlPath = resolve(batchDir, 'audio_url.txt')

  const existing = await readSongJson(songJsonPath)

  try {
    const lyricsText = existing?.lyrics
      ? existing.lyrics
      : await withRetry(
          `${batch}/lyrics`,
          () =>
            lyricGate.run(async () => {
              const result = await generateLyrics({
                prompt: buildLyricsPrompt(concept),
                mode: 'write_full_song',
              })
              return result.text
            })
        )

    const coverUrlPromise = existing?.imageUrl
      ? Promise.resolve(existing.imageUrl)
      : withRetry(
          `${batch}/cover`,
          () =>
            coverGate.run(async () => {
              const result = await generateImage({
                prompt: buildCoverPrompt(concept),
                width: 1024,
                height: 1024,
              })
              return result.imageUrl
            })
        )

    const musicPromise = existing?.audioUrl && typeof existing.durationSeconds === 'number'
      ? Promise.resolve({
          audioUrl: existing.audioUrl,
          duration: existing.durationSeconds,
        })
      : withRetry(
          `${batch}/music`,
          () =>
            musicGate.run(async () => {
              const result = await generateMusic({
                prompt: buildMusicPrompt(concept),
                lyrics: lyricsText,
                genre: concept.genre,
                mood: concept.mood,
              })
              return result
            })
        )

    const [coverUrl, musicResult] = await Promise.all([coverUrlPromise, musicPromise])

    if (!existsSync(lyricsPath) || !existing?.lyrics) {
      await writeFile(lyricsPath, `${lyricsText.trim()}\n`, 'utf8')
    }

    if (!existsSync(songPath)) {
      await downloadAudio(musicResult.audioUrl, songPath)
    }

    if (!existsSync(coverPath)) {
      await downloadPng(coverUrl, coverPath)
    }

    await writeFile(audioUrlPath, `${musicResult.audioUrl}\n`, 'utf8')

    const record: TrackRecord = {
      batch,
      title: concept.title,
      genre: concept.genre,
      mood: concept.mood,
      theme: concept.theme,
      sonic: concept.sonic,
      visual: concept.visual,
      lyricsPrompt: buildLyricsPrompt(concept),
      musicPrompt: buildMusicPrompt(concept),
      coverPrompt: buildCoverPrompt(concept),
      lyrics: lyricsText.trim(),
      audioUrl: musicResult.audioUrl,
      imageUrl: coverUrl,
      durationSeconds: musicResult.duration,
      files: {
        lyrics: 'lyrics.txt',
        song: 'song.mp3',
        cover: 'cover.png',
        songJson: 'song.json',
        audioUrl: 'audio_url.txt',
      },
    }

    await writeFile(songJsonPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8')

    console.log(`[${batch}] done ${concept.title} (${record.durationSeconds}s)`)
    return record
  } catch (error) {
    const errorDir = resolve(DISCARDED_ROOT, batch)
    await ensureDir(errorDir)
    const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error)
    await writeFile(resolve(errorDir, 'error.txt'), `${concept.title}\n\n${message}\n`, 'utf8')
    console.error(`[${batch}] failed ${concept.title}: ${message.split('\n')[0]}`)
    return null
  }
}

function renderRunReadme(summary: Summary): string {
  const lines: string[] = []
  lines.push(`# ${summary.runDate} MiniMax 生成归档`)
  lines.push('')
  lines.push(`本次在本地生成了 ${summary.finalCount} 首完整歌曲，每首都包含 ` +
    '`lyrics.txt`、`song.mp3`、`cover.png`、`song.json` 和 `audio_url.txt`。')
  lines.push('')
  lines.push('## 说明')
  lines.push('')
  lines.push('- 仅本地保存，未上传')
  lines.push('- 歌词、提示词和封面提示词均为英文')
  lines.push('- `final/` 保存全部交付批次')
  lines.push('- `discarded/` 仅保存失败或废弃内容')
  lines.push('')
  lines.push('## 批次清单')
  lines.push('')
  lines.push('| 批次 | 标题 | 风格 | 情绪 | 时长 |')
  lines.push('| --- | --- | --- | --- | ---: |')

  for (const track of summary.tracks) {
    lines.push(`| ${track.batch} | ${track.title} | ${track.genre} | ${track.mood} | ${track.durationSeconds}s |`)
  }

  lines.push('')
  lines.push('## 结果')
  lines.push('')
  lines.push(`- final 批次数量: ${summary.finalCount}`)
  lines.push(`- discarded 批次数量: ${summary.discardedCount}`)
  lines.push('')

  return `${lines.join('\n')}\n`
}

function renderFinalReadme(summary: Summary): string {
  const lines: string[] = []
  lines.push('# Final 批次')
  lines.push('')
  lines.push('保留了全部完整交付批次。每个批次目录内都包含：')
  lines.push('')
  lines.push('- `lyrics.txt`')
  lines.push('- `song.mp3`')
  lines.push('- `cover.png`')
  lines.push('- `song.json`')
  lines.push('- `audio_url.txt`')
  lines.push('')
  lines.push('| 批次 | 标题 | 风格 | 情绪 |')
  lines.push('| --- | --- | --- | --- |')

  for (const track of summary.tracks) {
    lines.push(`| ${track.batch} | ${track.title} | ${track.genre} | ${track.mood} |`)
  }

  lines.push('')
  return `${lines.join('\n')}\n`
}

function renderDiscardedReadme(summary: Summary): string {
  const lines: string[] = []
  lines.push('# Discarded')
  lines.push('')
  if (summary.discardedCount === 0) {
    lines.push('本次没有废弃草稿。')
  } else {
    lines.push('本次有废弃内容，见对应 `batch-xxx/error.txt`。')
  }
  lines.push('')
  return `${lines.join('\n')}\n`
}

async function main(): Promise<void> {
  await ensureDir(FINAL_ROOT)
  await ensureDir(DISCARDED_ROOT)

  console.log(`Run date: ${RUN_DATE}`)
  console.log(`Output root: ${RUN_ROOT}`)
  console.log(`Target count: ${SELECTED_CONCEPTS.length}`)
  console.log(`Start index: ${START_INDEX}`)

  const existingSummary = await loadExistingSummary()
  const existingTracks = existingSummary?.tracks ?? []

  const lyricGate = new RateGate(20_000)
  const musicGate = new RateGate(10_000)
  const coverGate = new RateGate(12_000)

  const results = await Promise.all(
    SELECTED_CONCEPTS.map((concept, index) =>
      processConcept(concept, index, lyricGate, musicGate, coverGate)
    )
  )

  const newTracks = results.filter((item): item is TrackRecord => item !== null)
  const discardedCount = results.length - newTracks.length
  const trackMap = new Map<string, TrackRecord>()

  for (const track of existingTracks) {
    trackMap.set(track.batch, track)
  }
  for (const track of newTracks) {
    trackMap.set(track.batch, track)
  }

  const tracks = [...trackMap.values()].sort((a, b) => a.batch.localeCompare(b.batch))

  const summary: Summary = {
    runDate: RUN_DATE,
    generatedAt: new Date().toISOString(),
    totalConcepts: tracks.length,
    finalCount: tracks.length,
    discardedCount,
    tracks,
  }

  await writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  await writeFile(resolve(RUN_ROOT, 'README.md'), renderRunReadme(summary), 'utf8')
  await writeFile(resolve(FINAL_ROOT, 'README.md'), renderFinalReadme(summary), 'utf8')
  await writeFile(resolve(DISCARDED_ROOT, 'README.md'), renderDiscardedReadme(summary), 'utf8')

  console.log('')
  console.log('Generation complete')
  console.log(`  final: ${summary.finalCount}`)
  console.log(`  discarded: ${summary.discardedCount}`)

  if (newTracks.length !== SELECTED_CONCEPTS.length) {
    console.warn(`Only generated ${newTracks.length} / ${SELECTED_CONCEPTS.length} new full sets.`)
  }
}

async function bootstrap(): Promise<void> {
  await loadAi()
  await main()
}

void bootstrap().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
