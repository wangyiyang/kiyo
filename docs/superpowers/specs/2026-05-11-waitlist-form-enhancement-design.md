# Waitlist 表单增强设计

> Issue: #107 — Landing Page Waitlist 表单转化设计不足，需要丰富字段与分层运营

## 背景

当前 Waitlist 仅收集邮箱和一个简单的角色标签（producer / songwriter / enthusiast / other），信息单薄，无法支撑后续的用户分层运营。需要扩展表单字段，同时保持转化漏斗的低门槛。

## 设计目标

1. **丰富用户画像**：增加经验层级、功能偏好、使用场景三个维度的数据
2. **差异化转化路径**：Hero 区域保持极简（降低首屏跳出），底部区域提供完整表单（高意愿用户）
3. **组件可复用**：表单逻辑抽离，支持 Dialog 和内联两种载体
4. **零破坏迁移**：旧数据保留，新增字段不影响现有记录

---

## 数据模型

### 数据库变更

```sql
-- 新增列（不删除旧 role，保留历史数据）
alter table public.waitlist
  add column role_new text,
  add column interests text[],
  add column use_scenes text[];

-- 保留旧 role 列用于历史数据兼容
-- 新字段使用新列名，避免与旧数据类型冲突
```

约束：
- `email` 仍为唯一键
- `role_new`、`interests`、`use_scenes` 均为 nullable
- RLS 策略保持不变（anon/authenticated 可 insert，不可 select）

### 前端 Schema

```typescript
import { z } from 'zod'

export const waitlistSchema = z.object({
  email: z
    .string()
    .min(1, '请输入邮箱')
    .email('请输入有效邮箱')
    .max(254, '邮箱过长'),
  role: z.enum([
    'beginner',      // 音乐初学者
    'enthusiast',    // 音乐爱好者
    'indie',         // 独立制作人
    'professional',  // 专业音乐人
    'songwriter',    // 词曲作者
    'other',         // 其他
  ]).optional(),
  interests: z.array(
    z.enum([
      'composition',  // AI 作曲
      'arrangement',  // AI 编曲
      'vocal',        // 人声合成
      'mixing',       // 混音母带
      'cover',        // AI 翻唱
      'lyrics',       // 智能歌词创作
    ])
  ).max(6).optional(),
  useScenes: z.array(
    z.enum([
      'personal',     // 个人创作
      'commercial',   // 商业项目
      'education',    // 教育学习
      'social',       // 社交分享
    ])
  ).max(4).optional(),
})

export type WaitlistInput = z.infer<typeof waitlistSchema>
```

### Server Action 更新

`joinWaitlist` 接收 `WaitlistInput`，写入新增列：

```typescript
const { error } = await supabase.from('waitlist').insert({
  email: parsed.data.email.trim().toLowerCase(),
  role_new: parsed.data.role ?? null,
  interests: parsed.data.interests ?? null,
  use_scenes: parsed.data.useScenes ?? null,
  source: 'landing',
  user_agent: userAgent,
})
```

---

## 组件架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Hero CTA  │────▶│ WaitlistDialog│──▶│ joinWaitlist │
│   (simple)  │     │  mode="simple" │   │   (server)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
┌─────────────┐     ┌─────────────┐            │
│  FinalCta   │────▶│ WaitlistForm │───────────┘
│   (full)    │     │  mode="full"  │
└─────────────┘     └─────────────┘
```

### WaitlistDialog（Hero 区域）

- 职责：提供 Dialog 外壳（标题、描述、关闭按钮）
- 内部渲染 `<WaitlistForm mode="simple" />`
- `mode="simple"`：只显示邮箱 + 角色（单选）

### InlineWaitlistForm（底部区域）

- 职责：在页面内联渲染表单，无 Dialog 壳
- 内部渲染 `<WaitlistForm mode="full" inline />`
- 默认状态：只显示邮箱输入框 + 提交按钮 + "展开更多"按钮
- 展开后：显示角色 + 功能偏好 + 使用场景
- 用户可直接填邮箱提交，无需展开

### WaitlistForm（复用核心）

- 职责：实际表单渲染与提交逻辑
- 接收 `mode: 'simple' | 'full'`、`inline?: boolean`
- 使用 react-hook-form + zodResolver
- 提交成功后调用 `onSuccess` callback，由父组件处理 UI 反馈（Dialog 关闭或内联区域替换为感谢文案）

---

## UI 设计

### Hero WaitlistDialog（simple 模式）

```
┌─────────────────────────────────┐
│     加入 Kiyo Waitlist          │
│   留下邮箱，上线第一时间告诉你。  │
│                                 │
│  ┌──────────────────────────┐   │
│  │ you@example.com          │   │
│  └──────────────────────────┘   │
│                                 │
│  [可选] 你在音乐创作中的角色      │
│  ┌──────────┐ ┌──────────┐     │
│  │ 初学者   │ │ 爱好者   │     │
│  ├──────────┼─┼──────────┤     │
│  │ 独立制作 │ │ 专业音乐 │     │
│  ├──────────┼─┼──────────┤     │
│  │ 词曲作者 │ │ 其他     │     │
│  └──────────┘ └──────────┘     │
│                                 │
│  [取消]    [加入 Waitlist]      │
└─────────────────────────────────┘
```

- 角色为单选，2×3 网格布局
- 所有非邮箱字段均为可选

### 底部 InlineWaitlistForm（full 模式，默认折叠）

```
┌──────────────────────────────────────┐
│    把正在哼的旋律变成完整作品          │
│    Kiyo 正在内测中...                │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ you@example.com              │    │
│  └──────────────────────────────┘    │
│                                      │
│  [↓ 展开更多，帮助我们了解你的需求]     │
│                                      │
│  [加入 Waitlist]                     │
└──────────────────────────────────────┘
```

### 底部展开后（full 模式）

```
┌──────────────────────────────────────┐
│    ...                               │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ you@example.com              │    │
│  └──────────────────────────────┘    │
│                                      │
│  你的创作角色：                       │
│  [初学者] [爱好者] [独立制作]          │
│  [专业音乐] [词曲作者] [其他]          │
│                                      │
│  感兴趣的功能（可多选）：               │
│  ☑ AI 作曲  ☑ AI 编曲  ☑ 人声合成    │
│  ☐ 混音母带  ☑ AI 翻唱  ☐ 歌词创作   │
│                                      │
│  使用场景（可多选）：                  │
│  ☑ 个人创作 ☐ 商业项目 ☐ 教育学习    │
│  ☐ 社交分享                           │
│                                      │
│  [加入 Waitlist]                     │
└──────────────────────────────────────┘
```

---

## 状态流转

### Hero 路径

```
点击"加入 Waitlist" → 打开 Dialog (simple)
  → 填写邮箱（+可选角色）
  → 提交 → 成功 Toast → 关闭 Dialog → 重置表单
```

### 底部路径

```
显示内联表单（精简）
  ├─ 直接填邮箱提交
  │    → 成功 → 表单替换为感谢文案
  │
  └─ 点击"展开更多"
       → 平滑展开完整字段
       → 填写任意字段
       → 提交 → 成功 → 表单替换为感谢文案
```

---

## 错误处理

| 场景 | 前端行为 | 后端行为 |
|---|---|---|
| 邮箱重复 | `toast.warning`（非 error，文案温和） | 返回 `DUPLICATE` code |
| 邮箱格式错误 | 表单 inline 校验，zod 拦截 | 不触发请求 |
| 提交网络失败 | `toast.error` + 保留表单数据，允许重试 | — |
| 必填字段为空 | 表单校验阻止提交 | — |
| 服务端未知错误 | `toast.error` + 文案提示联系支持 | 返回 `UNKNOWN` code，Sentry 上报 |

---

## 测试策略

| 类型 | 内容 |
|---|---|
| **Schema 单元测试** | `waitlistSchema` 对有效/无效输入的校验 |
| **组件测试** | `WaitlistForm` 在 `simple` 和 `full` 模式下的渲染差异；多选/单选交互 |
| **集成测试** | `joinWaitlist` server action：正常插入、重复检测、RLS 验证 |
| **E2E 测试** | Hero Dialog 完整提交流程；底部表单展开→提交→感谢文案流程 |

---

## 迁移与回滚

### 正向迁移

1. 创建 migration 文件，新增 `role_new`、`interests`、`use_scenes` 三列
2. 部署前端代码，新字段开始写入
3. 旧 `role` 列保留，不做数据迁移（数据量小，后续可手动清理）

### 回滚策略

- 前端 `waitlistSchema` 如果新增字段校验失败，可以回退到旧 schema
- 数据库新增列为 nullable，回滚时前端不发送新字段即可，无需删列
- Server Action 如果接收不到新字段，写 `null` 即可兼容

---

## i18n 键值规划

```json
{
  "waitlist": {
    "title": "加入 Kiyo Waitlist",
    "description": "留下邮箱，上线第一时间告诉你。",
    "inline": {
      "expand": "展开更多，帮助我们了解你的需求",
      "collapse": "收起",
      "thanks": "已加入！感谢你的支持，上线时我们会第一时间通知你。"
    },
    "fields": {
      "email": {
        "label": "邮箱",
        "placeholder": "you@example.com"
      },
      "role": {
        "label": "你在音乐创作中的角色（可选）",
        "options": {
          "beginner": "音乐初学者",
          "enthusiast": "音乐爱好者",
          "indie": "独立制作人",
          "professional": "专业音乐人",
          "songwriter": "词曲作者",
          "other": "其他"
        }
      },
      "interests": {
        "label": "感兴趣的功能（可多选）",
        "options": {
          "composition": "AI 作曲",
          "arrangement": "AI 编曲",
          "vocal": "人声合成",
          "mixing": "混音母带",
          "cover": "AI 翻唱",
          "lyrics": "智能歌词创作"
        }
      },
      "useScenes": {
        "label": "使用场景（可多选）",
        "options": {
          "personal": "个人创作",
          "commercial": "商业项目",
          "education": "教育学习",
          "social": "社交分享"
        }
      }
    },
    "actions": {
      "cancel": "取消",
      "submit": "加入 Waitlist",
      "submitting": "提交中…"
    },
    "toast": {
      "success": {
        "title": "已加入 Waitlist！",
        "description": "上线第一时间会发邮件通知你。"
      },
      "duplicate": "该邮箱已在 Waitlist 中。如需更新信息，请联系 hello@kiyo.ai。",
      "invalid": "请检查邮箱格式后重试。",
      "unknown": "稍后再试一次，或邮件联系 hello@kiyo.ai。"
    }
  }
}
```

---

## 待办清单

- [ ] 创建数据库 migration（新增三列）
- [ ] 更新 `waitlistSchema`（新增 role/interests/useScenes）
- [ ] 重构 `WaitlistDialog` → 复用 `WaitlistForm`
- [ ] 创建 `WaitlistForm` 组件（支持 simple/full 模式）
- [ ] 创建 `InlineWaitlistForm` 组件（底部内联）
- [ ] 更新 `FinalCta` 组件，替换为内联表单
- [ ] 更新 `joinWaitlist` server action，写入新列
- [ ] 更新 `zh.json` / `en.json` i18n 文案
- [ ] 编写/更新测试
