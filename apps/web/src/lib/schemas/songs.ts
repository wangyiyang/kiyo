import { z } from 'zod'

export const getSongCreateSchema = (t: (key: string) => string) =>
  z
    .object({
      title: z.string().min(1, t('error.emptyTitle')),
      prompt: z.string().min(1, t('error.emptyPrompt')),
      genre: z.string().optional(),
      mood: z.string().optional(),
      language: z.string().optional(),
      mode: z.enum(['instrumental', 'auto_lyrics', 'existing_lyric']),
      lyricId: z.string().optional(),
    })
    .refine(
      (data) => {
        if (data.mode === 'existing_lyric') {
          return !!data.lyricId?.trim()
        }
        return true
      },
      {
        message: t('error.noLyricSelected'),
        path: ['lyricId'],
      }
    )

export type SongCreateInput = z.infer<ReturnType<typeof getSongCreateSchema>>
