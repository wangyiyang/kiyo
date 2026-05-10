'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@kiyo/ui'

interface FaqItem {
  question: string
  answer: string
}

const staticFaqs: FaqItem[] = [
  {
    question: '生成失败怎么办？',
    answer:
      '检查网络连接是否稳定。部分模型可能在高峰期排队，建议稍后重试。如果持续失败，通过反馈表单提交，我们会尽快排查。',
  },
  {
    question: '支持哪些音频格式？',
    answer: '目前支持 MP3、WAV 格式导出。歌曲封面支持 JPG、PNG。',
  },
  {
    question: '如何删除作品？',
    answer:
      '进入歌曲/专辑详情页，点击删除按钮即可。删除后作品将无法恢复，请谨慎操作。',
  },
  {
    question: '生成一首歌曲需要多长时间？',
    answer:
      '根据歌曲长度和当前队列状态，通常需要 2-5 分钟。复杂编曲可能需要更长时间，请耐心等待。',
  },
  {
    question: '生成的音乐版权归谁？',
    answer:
      '您使用 Kiyo 生成的歌曲版权归您所有。请遵守当地法律法规，不要用于非法用途。',
  },
  {
    question: '如何联系客服？',
    answer: '发送邮件至 wangyiyang.kk@gmail.com，或通过页面底部的反馈表单提交问题。',
  },
]

export function FaqAccordion() {
  const t = useTranslations('contact.faq')

  return (
    <div className="w-full">
      <h2 className="mb-6 text-2xl font-bold">{t('title')}</h2>
      <Accordion type="single" collapsible className="w-full">
        {staticFaqs.map((faq, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}