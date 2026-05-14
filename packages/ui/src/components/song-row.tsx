import * as React from 'react'
import { Checkbox } from './ui/checkbox'

interface SongRowProps {
  id: string
  title: string
  mode: 'select' | 'drag'
  selected?: boolean
  onSelect?: (id: string, selected: boolean) => void
  dragHandle?: React.ReactNode
}

export function SongRow({ id, title, mode, selected, onSelect, dragHandle }: SongRowProps) {
  const checkboxId = React.useId() + '-' + id

  return (
    <div className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/50">
      {mode === 'select' && onSelect && (
        <Checkbox
          id={checkboxId}
          checked={selected}
          onCheckedChange={(checked) => onSelect(id, checked === true)}
        />
      )}
      {mode === 'drag' && dragHandle}
      <label
        htmlFor={mode === 'select' ? checkboxId : undefined}
        className="flex-1 text-sm font-medium cursor-pointer select-none"
      >
        {title}
      </label>
    </div>
  )
}
