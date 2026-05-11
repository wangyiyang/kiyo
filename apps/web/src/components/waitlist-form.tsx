'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp } from 'lucide-react'

import {
  Button,
  Checkbox,
  cn,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  toast,
} from '@kiyo/ui'

import { joinWaitlist } from '@/app/actions/waitlist'
import {
  waitlistSchema,
  roleOptions,
  interestOptions,
  useSceneOptions,
  type WaitlistInput,
} from '@/lib/schemas/waitlist'

export type WaitlistFormMode = 'simple' | 'full'

export interface WaitlistFormProps {
  mode: WaitlistFormMode
  /** 内联模式时显示折叠/展开控制 */
  collapsible?: boolean
  onSuccess?: () => void
}

export function WaitlistForm({ mode, collapsible, onSuccess }: WaitlistFormProps) {
  const [pending, startTransition] = React.useTransition()
  const [expanded, setExpanded] = React.useState(!collapsible)
  const t = useTranslations('waitlist')

  const form = useForm<WaitlistInput>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      email: '',
      role: undefined,
      interests: [],
      useScenes: [],
    },
    mode: 'onSubmit',
  })

  const onSubmit = (values: WaitlistInput) => {
    startTransition(async () => {
      const result = await joinWaitlist(values)
      if (result.ok) {
        toast.success(t('toast.success.title'), {
          description: t('toast.success.description'),
        })
        form.reset()
        onSuccess?.()
        return
      }

      const description =
        result.code === 'DUPLICATE'
          ? t('toast.duplicate')
          : result.code === 'INVALID'
            ? t('toast.invalid')
            : t('toast.unknown')

      toast.error(result.message, { description })
    })
  }

  const toggleExpanded = () => setExpanded((v) => !v)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.email.label')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t('fields.email.placeholder')}
                  autoComplete="email"
                  autoFocus={mode === 'simple'}
                  disabled={pending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* simple 模式下直接显示角色 */}
        {mode === 'simple' && (
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fields.role.label')}</FormLabel>
                <FormControl>
                  <RoleGrid
                    value={field.value}
                    onChange={field.onChange}
                    disabled={pending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* full 模式下折叠控制 */}
        {mode === 'full' && collapsible && !expanded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleExpanded}
            className="w-full"
          >
            <ChevronDown className="mr-1 h-4 w-4" />
            {t('inline.expand')}
          </Button>
        )}

        {/* full 模式下展开后显示所有字段 */}
        {mode === 'full' && expanded && (
          <>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.role.label')}</FormLabel>
                  <FormControl>
                    <RoleGrid
                      value={field.value}
                      onChange={field.onChange}
                      disabled={pending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="interests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.interests.label')}</FormLabel>
                  <FormControl>
                    <CheckboxGrid
                      options={interestOptions}
                      value={field.value ?? []}
                      onChange={field.onChange}
                      disabled={pending}
                      tPrefix="fields.interests.options"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="useScenes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.useScenes.label')}</FormLabel>
                  <FormControl>
                    <CheckboxGrid
                      options={useSceneOptions}
                      value={field.value ?? []}
                      onChange={field.onChange}
                      disabled={pending}
                      tPrefix="fields.useScenes.options"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {collapsible && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleExpanded}
                className="w-full"
              >
                <ChevronUp className="mr-1 h-4 w-4" />
                {t('inline.collapse')}
              </Button>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={pending} className="min-w-[140px]">
            {pending ? t('actions.submitting') : t('actions.submit')}
          </Button>
        </div>
      </form>
    </Form>
  )
}

/* ── 子组件 ── */

function RoleGrid({
  value,
  onChange,
  disabled,
}: {
  value?: WaitlistInput['role']
  onChange: (v: WaitlistInput['role']) => void
  disabled?: boolean
}) {
  const t = useTranslations('waitlist')

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {roleOptions.map((roleKey) => {
        const active = value === roleKey
        return (
          <button
            key={roleKey}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(active ? undefined : roleKey)}
            className={cn(
              'rounded-md border px-3 py-2 text-sm transition-colors',
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {t(`fields.role.options.${roleKey}`)}
          </button>
        )
      })}
    </div>
  )
}

function CheckboxGrid({
  options,
  value,
  onChange,
  disabled,
  tPrefix,
}: {
  options: readonly string[]
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
  tPrefix: string
}) {
  const t = useTranslations('waitlist')

  const toggle = (key: string) => {
    onChange(
      value.includes(key) ? value.filter((v) => v !== key) : [...value, key]
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {options.map((key) => {
        const checked = value.includes(key)
        return (
          <label
            key={key}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
              checked
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={() => toggle(key)}
              disabled={disabled}
              className="shrink-0"
            />
            <span>{t(`${tPrefix}.${key}`)}</span>
          </label>
        )
      })}
    </div>
  )
}
