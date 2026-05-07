'use client'

import * as React from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { ChevronUp, ChevronDown, X, Plus } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Block } from '../lib/blocks'
import { generateId } from '../lib/blocks'

const DEFAULT_TAGS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro']

export interface StructuredBlockEditorProps {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  availableTags?: string[]
  readOnly?: boolean
}

export function StructuredBlockEditor({
  blocks,
  onChange,
  availableTags = DEFAULT_TAGS,
  readOnly = false,
}: StructuredBlockEditorProps) {
  const updateBlock = (index: number, updates: Partial<Block>) => {
    const next = blocks.map((b, i) => (i === index ? { ...b, ...updates } : b))
    onChange(next)
  }

  const addBlock = (index: number) => {
    const next = [...blocks]
    next.splice(index + 1, 0, {
      id: generateId(),
      tag: availableTags[0] ?? 'Text',
      content: '',
    })
    onChange(next)
  }

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return
    const next = blocks.filter((_, i) => i !== index)
    onChange(next)
  }

  const moveBlock = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= blocks.length) return
    const next = [...blocks]
    const [moved] = next.splice(index, 1)
    next.splice(newIndex, 0, moved)
    onChange(next)
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className={cn(
            'rounded-lg border bg-card p-4 shadow-sm',
            readOnly && 'opacity-80'
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            {!readOnly && (
              <div className="flex flex-col gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveBlock(index, -1)}
                  disabled={index === 0}
                  aria-label="向上移动"
                  className="h-6 w-6"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => moveBlock(index, 1)}
                  disabled={index === blocks.length - 1}
                  aria-label="向下移动"
                  className="h-6 w-6"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <Label htmlFor={`tag-input-${block.id}`} className="sr-only">
              段落标签
            </Label>
            {readOnly ? (
              <span className="text-sm font-semibold text-primary">[{block.tag}]</span>
            ) : (
              <>
                <Input
                  id={`tag-input-${block.id}`}
                  list={`tag-suggestions-${block.id}`}
                  value={block.tag}
                  onChange={(e) => updateBlock(index, { tag: e.target.value })}
                  className="h-8 w-40 text-sm font-semibold"
                  placeholder="标签"
                />
                <datalist id={`tag-suggestions-${block.id}`}>
                  {availableTags.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </>
            )}
            <div className="flex-1" />
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeBlock(index)}
                disabled={blocks.length <= 1}
                aria-label="删除区块"
                className="h-7 w-7 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Textarea
            value={block.content}
            onChange={(e) => updateBlock(index, { content: e.target.value })}
            readOnly={readOnly}
            className="min-h-[80px] resize-y font-mono text-sm leading-relaxed"
            placeholder="在此输入歌词内容..."
          />
          {!readOnly && (
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addBlock(index)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                添加区块
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
