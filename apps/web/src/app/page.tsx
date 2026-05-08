import { redirect } from 'next/navigation'
import { withLocale } from '@/i18n/server'

export default async function RootPage() {
  redirect(await withLocale('/'))
}
