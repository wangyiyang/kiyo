'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@kiyo/ui'

import { useWaitlist } from '@/lib/waitlist-context'

export function WaitlistDialog() {
  const { open, setOpen } = useWaitlist()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>加入 Kiyo Waitlist</DialogTitle>
          <DialogDescription>
            留下邮箱,第一时间获取产品上线通知。
          </DialogDescription>
        </DialogHeader>
        {/* 表单将在 Phase D 接入 react-hook-form + zod + Server Action */}
      </DialogContent>
    </Dialog>
  )
}
