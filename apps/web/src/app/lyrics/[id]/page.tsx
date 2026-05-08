import { createServerClient } from '@kiyo/supabase'
import Link from 'next/link'
import { StructuredBlockEditor, textToBlocks, Button } from '@kiyo/ui'
import { Pencil, ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

export default async function LyricDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="container mx-auto py-8">请先登录</div>
  }

  const { data: lyric } = await supabase
    .from('lyrics')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!lyric) {
    notFound()
  }

  const blocks = textToBlocks(lyric.content)

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/lyrics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{lyric.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                lyric.source === 'ai_generated'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {lyric.source === 'ai_generated' ? 'AI 生成' : '手动创建'}
            </span>
            {lyric.language && <span>{lyric.language}</span>}
            {lyric.style && <span>{lyric.style}</span>}
            {lyric.mood && <span>{lyric.mood}</span>}
          </div>
        </div>
        <Link href={`/lyrics/${lyric.id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-1 h-4 w-4" />
            编辑
          </Button>
        </Link>
      </div>

      <StructuredBlockEditor blocks={blocks} onChange={() => {}} readOnly />
    </div>
  )
}
