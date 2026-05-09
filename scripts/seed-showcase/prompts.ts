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
