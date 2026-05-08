import { cn } from '../lib/utils'

type SongStatus = 'draft' | 'generating' | 'completed' | 'failed'

interface SongStatusBadgeProps {
  status: SongStatus
}

const statusConfig: Record<SongStatus, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  generating: { label: '生成中', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  completed: { label: '已完成', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  failed: { label: '失败', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

export function SongStatusBadge({ status }: SongStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.draft
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}
