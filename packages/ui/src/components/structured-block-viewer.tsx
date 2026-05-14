import * as React from 'react'
import { cn } from '../lib/utils'
import type { Block } from '../lib/blocks'

export interface StructuredBlockViewerProps {
  blocks: Block[]
  className?: string
}

export function StructuredBlockViewer({
  blocks,
  className,
}: StructuredBlockViewerProps) {
  return (
    <article className={cn('space-y-6', className)}>
      {blocks.map((block) => (
        <section key={block.id}>
          <h3 className="mb-2 text-sm font-semibold text-primary">
            [{block.tag}]
          </h3>
          {block.content.trim() ? (
            <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
              {block.content}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </section>
      ))}
    </article>
  )
}
