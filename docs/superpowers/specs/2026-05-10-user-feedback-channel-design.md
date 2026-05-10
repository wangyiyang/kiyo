# 用户反馈渠道设计规范

**日期**: 2026-05-10  
**状态**: 已批准  
**关联 Issue**: #56

---

## 背景

公测期间用户遇到问题没有反馈渠道，只能在社交媒体吐槽或放弃使用。需要建立最低限度的用户支持体系。

---

## 方案概述

| 模块 | 方案 |
|------|------|
| 反馈入口 | 双入口：Footer「联系我们」+ 用户菜单「反馈」弹窗 |
| 反馈表单 | 类型（Bug/建议/其他）+ 描述 + 联系方式（可选） |
| 数据存储 | Supabase `feedback` 表 |
| FAQ | 静态内容 + 数据库字段预留 |
| 联系邮箱 | `wangyiyang.kk@gmail.com` |

---

## 1. 数据库设计

### feedback 表

```sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id), -- 可选，登录用户可关联
  type TEXT NOT NULL CHECK (type IN ('bug', 'suggestion', 'other')),
  description TEXT NOT NULL,
  contact TEXT, -- 可选联系方式
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS 策略**: 仅管理员可读，普通用户可插入但不能查询自己或其他人的反馈。

### FAQ 预留字段

```sql
-- 后续扩展用，先加字段但不用
ALTER TABLE faq ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE faq ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT true;
```

---

## 2. 页面设计

### /contact 页面

**路由**: `/contact`

**内容**:
- 页面标题：「联系我们 / Contact Us」
- 联系邮箱：`wangyiyang.kk@gmail.com`
- 反馈表单（完整版）
- FAQ 区块（静态内容）

**布局**: 单列居中，最大宽度 640px，移动端友好。

### 反馈弹窗

**触发**: 用户下拉菜单 → 「反馈」

**内容**:
- 反馈类型选择
- 描述文本框
- 联系方式（可选）
- 提交按钮

**状态**: 提交中 / 成功 / 失败

---

## 3. 反馈表单字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | select | 是 | Bug 报告 / 功能建议 / 其他 |
| description | textarea | 是 | 问题描述，最少 10 字符 |
| contact | input | 否 | 邮箱或其他联系方式 |

---

## 4. FAQ 静态内容

```json
[
  {
    "question": "生成失败怎么办？",
    "answer": "检查网络连接是否稳定。部分模型可能在高峰期排队，建议稍后重试。如果持续失败，通过反馈表单提交，我们会尽快排查。"
  },
  {
    "question": "支持哪些音频格式？",
    "answer": "目前支持 MP3、WAV 格式导出。歌曲封面支持 JPG、PNG。"
  },
  {
    "question": "如何删除作品？",
    "answer": "进入歌曲/专辑详情页，点击删除按钮即可。删除后作品将无法恢复，请谨慎操作。"
  },
  {
    "question": "生成一首歌曲需要多长时间？",
    "answer": "根据歌曲长度和当前队列状态，通常需要 2-5 分钟。复杂编曲可能需要更长时间，请耐心等待。"
  },
  {
    "question": "生成的音乐版权归谁？",
    "answer": "您使用 Kiyo 生成的歌曲版权归您所有。请遵守当地法律法规，不要用于非法用途。"
  },
  {
    "question": "如何联系客服？",
    "answer": "发送邮件至 wangyiyang.kk@gmail.com，或通过页面底部的反馈表单提交问题。"
  }
]
```

---

## 5. 组件清单

| 组件 | 位置 | 说明 |
|------|------|------|
| `SiteFooter` | 已存在，修改 | 链接 group 添加「contact」入口 |
| `FeedbackDialog` | `apps/web/src/components/` | 反馈弹窗组件 |
| `ContactPage` | `apps/web/src/app/[locale]/contact/page.tsx` | 联系页面 |
| `FeedbackForm` | `apps/web/src/components/` | 反馈表单，可复用 |
| `FaqAccordion` | `apps/web/src/components/` | FAQ 手风琴组件 |

---

## 6. 国际化

需要新增翻译 key：

- `contact.title`
- `contact.subtitle`
- `feedback.type.label`
- `feedback.type.options.bug`
- `feedback.type.options.suggestion`
- `feedback.type.options.other`
- `feedback.description.label`
- `feedback.description.placeholder`
- `feedback.contact.label`
- `feedback.contact.placeholder`
- `feedback.submit`
- `feedback.submitting`
- `feedback.success`
- `faq.title`

---

## 7. 实现步骤（待 Plan）

1. 创建 Supabase `feedback` 表迁移文件
2. 新增国际化翻译 key
3. 实现 `FeedbackForm` 组件
4. 实现 `FeedbackDialog` 组件，添加到用户菜单
5. 修改 `SiteFooter`，链接到 `/contact`
6. 创建 `/contact` 页面
7. 实现 `FaqAccordion` 组件
8. 测试表单提交和数据存储

---

## 8. 验收标准

- [ ] 未登录用户可从 Footer 访问联系页面并提交反馈
- [ ] 登录用户可从用户菜单打开反馈弹窗并提交反馈
- [ ] 反馈数据正确存入 Supabase `feedback` 表
- [ ] FAQ 内容正确展示，支持展开/收起
- [ ] 表单提交有成功/失败反馈
- [ ] 中英文切换正常
