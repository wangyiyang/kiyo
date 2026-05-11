'use client'

import * as React from 'react'
import { cn } from '@kiyo/ui'

interface SettingsSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  variant?: 'default' | 'danger'
}

export function SettingsSection({
  title,
  description,
  children,
  variant = 'default',
}: SettingsSectionProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-6',
        variant === 'danger'
          ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20'
          : 'border-border bg-card'
      )}
    >
      <div className="mb-4">
        <h2
          className={cn(
            'text-lg font-semibold',
            variant === 'danger' && 'text-red-600 dark:text-red-400'
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
