import { z } from 'zod'

export const getLyricCreateSchema = (t: (key: string) => string) =>
  z.object({
    title: z.string().min(1, t('error.emptyTitle')),
    content: z.string().min(1, t('error.emptyContent')),
    language: z.string().optional(),
    style: z.string().optional(),
    mood: z.string().optional(),
  })

export type LyricCreateInput = z.infer<ReturnType<typeof getLyricCreateSchema>>
