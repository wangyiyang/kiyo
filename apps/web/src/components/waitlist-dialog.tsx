'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useWaitlist } from '@/lib/waitlist-context'
import { waitlistSchema, type WaitlistInput } from '@/lib/schemas/waitlist'

const roleOptions: { value: NonNullable<WaitlistInput['role']>; label: string }[] = [
  { value: 'producer', label: '制作人' },
  { value: 'songwriter', label: '词曲创作' },
  { value: 'enthusiast', label: '音乐爱好者' },
  { value: 'other', label: '其它' },
]

export function WaitlistDialog() {
  const { open, setOpen, hide } = useWaitlist()
  const [pending, startTransition] = React.useTransition()

  const form = useForm<WaitlistInput>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: { email: '', role: undefined },
    mode: 'onSubmit',
  })

  const onSubmit = (values: WaitlistInput) => {
    startTransition(async () => {
      const result = await joinWaitlist(values)
      if (result.ok) {
        toast.success('已加入 Waitlist!', {
          description: '我们会第一时间发邮件通知你产品上线。',
        })
        form.reset()
        hide()
        return
      }

      const description =
        result.code === 'DUPLICATE'
          ? '换个邮箱试试,或者耐心等待我们的通知。'
          : result.code === 'INVALID'
            ? '请检查邮箱格式后重新提交。'
            : '稍后再试,或联系 hello@kiyo.ai。'

      toast.error(result.message, { description })
    })
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset()
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>加入 Kiyo Waitlist</DialogTitle>
          <DialogDescription>
            留下邮箱,第一时间获取产品上线通知。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>邮箱</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      autoFocus
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>你是…(可选)</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-2">
                      {roleOptions.map((option) => {
                        const active = field.value === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              field.onChange(active ? undefined : option.value)
                            }
                            className={cn(
                              'rounded-md border px-3 py-2 text-sm transition-colors',
                              active
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                            )}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                取消
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? '提交中…' : '加入 Waitlist'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
