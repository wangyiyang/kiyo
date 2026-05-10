import { createClient } from '@supabase/supabase-js'
import { CONFIG } from './config'

const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceRoleKey)

async function verify() {
  console.log('🔍 Verifying seed data...\n')

  const { count: albumCount } = await supabase.from('albums').select('*', { count: 'exact', head: true })
  const { count: songCount } = await supabase.from('songs').select('*', { count: 'exact', head: true })
  const { count: lyricCount } = await supabase.from('lyrics').select('*', { count: 'exact', head: true })
  const { count: relationCount } = await supabase.from('album_songs').select('*', { count: 'exact', head: true })

  const { data: songsWithoutAudio } = await supabase.from('songs').select('id, title').is('audio_url', null)
  const { data: songsWithoutCover } = await supabase.from('songs').select('id, title').is('cover_url', null)
  const { data: albumsWithoutCover } = await supabase.from('albums').select('id, title').is('cover_url', null)

  console.log(`Albums: ${albumCount}/10`)
  console.log(`Songs: ${songCount}/100`)
  console.log(`Lyrics: ${lyricCount}/30`)
  console.log(`Relations: ${relationCount}/100`)
  console.log()
  console.log(`Songs without audio: ${songsWithoutAudio?.length ?? 0}`)
  console.log(`Songs without cover: ${songsWithoutCover?.length ?? 0}`)
  console.log(`Albums without cover: ${albumsWithoutCover?.length ?? 0}`)
  console.log()

  const allGood = albumCount === 10 && songCount === 100 && (songsWithoutAudio?.length ?? 0) === 0
  console.log(allGood ? '✅ All checks passed' : '⚠️ Some checks failed')
}

verify().catch(console.error)
