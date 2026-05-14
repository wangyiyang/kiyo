import { cn } from '../lib/utils'

type SongStatus = 'draft' | 'generating' | 'completed' | 'failed'

interface SongStatusBadgeProps {
  status: SongStatus
  label: string
}

const statusClassName: Record<SongStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  generating: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

export function SongStatusBadge({ status, label }: SongStatusBadgeProps) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0', statusClassName[status])}>
      {label}
    </span>
  )
}
