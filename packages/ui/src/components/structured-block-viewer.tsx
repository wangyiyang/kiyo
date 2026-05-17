import * as React from 'react'
import { cn } from '../lib/utils'
import type { Block } from '../lib/blocks'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion'

export interface StructuredBlockViewerProps {
  blocks: Block[]
  className?: string
}

// 段落类型配置：标签 -> 名称和样式
const TAG_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  verse: { label: '主歌', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  chorus: {
    label: '副歌',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  bridge: { label: '桥段', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  intro: { label: '引子', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  outro: { label: '尾奏', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  pre_chorus: {
    label: '预副歌',
    color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  },
  hook: { label: '钩子', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
}

const DEFAULT_TAG_CONFIG = {
  label: '段落',
  color: 'bg-muted text-muted-foreground',
}

function getTagLabel(tag: string): { label: string; color: string } {
  const lowerTag = tag.toLowerCase()
  if (TAG_CONFIG[lowerTag]) {
    return TAG_CONFIG[lowerTag]
  }
  // 处理带数字的标签，如 Verse 1, Verse 2
  const baseTag = lowerTag.replace(/\s*\d+$/, '').trim()
  if (TAG_CONFIG[baseTag]) {
    return {
      ...TAG_CONFIG[baseTag],
      label: `${TAG_CONFIG[baseTag].label} ${tag.replace(/[^\d]/g, '')}`,
    }
  }
  return DEFAULT_TAG_CONFIG
}

export function StructuredBlockViewer({
  blocks,
  className,
}: StructuredBlockViewerProps) {
  return (
    <Accordion type="multiple" className={cn('w-full', className)}>
      {blocks.map((block) => {
        const { label, color } = getTagLabel(block.tag)
        return (
          <AccordionItem key={block.id} value={block.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    color
                  )}
                >
                  {label}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {block.content.trim() ? (
                <p className="whitespace-pre-wrap py-2 text-base leading-relaxed text-foreground">
                  {block.content}
                </p>
              ) : (
                <p className="py-2 text-sm text-muted-foreground">—</p>
              )}
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}