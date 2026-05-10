# 公开歌曲探索页设计文档

> **目标**：让未登录用户也能发现和试听全部 seed 歌曲，解决生成的 100 首歌曲仅在首页展示 6 首造成的资源浪费问题。

**架构**：新增 `/explore` 公开路由页，展示所有 `is_featured = true` 的歌曲。Showcase 区域增加"查看全部"入口引导用户跳转。复用现有组件（ShowcaseCard、ScrollReveal、MiniPlayer），零新造轮子。

**技术栈**：Next.js App Router + Supabase + Tailwind CSS + 已有 UI 组件库

---

## 背景

- 已生成 100 首 seed 歌曲存入数据库，均标记 `is_featured = true`
- 首页 Showcase 仅展示 6 首精选歌曲
- 现有 `/songs` 页面需要登录，且只展示当前用户的歌曲
- 匿名用户无法访问全部 seed 歌曲内容

## 方案概述

新增公开可访问的 `/explore` 页面，展示全部 featured 歌曲，支持筛选和分页。Showcase 区域增加"查看全部歌曲"按钮作为入口。

## 页面设计

### 路由

- **路径**：`/[locale]/explore`
- **访问权限**：公开，无需登录
- **数据权限**：利用已有 RLS 策略 `anon_read_featured_songs`，匿名用户可读取 `is_featured = true` 的歌曲

### 布局结构

```
┌─────────────────────────────────────┐
│  探索歌曲                  (标题区)  │
│  发现 AI 生成的精选音乐...           │
├─────────────────────────────────────┤
│  风格 ▼    情绪 ▼         (筛选栏)  │
├─────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐               │
│  │歌曲│ │歌曲│ │歌曲│  (歌曲网格)    │
│  │卡片│ │卡片│ │卡片│               │
│  └────┘ └────┘ └────┘               │
│  ...                                │
├─────────────────────────────────────┤
│        加载更多          (分页区)   │
└─────────────────────────────────────┘
```

### 组件清单

| 组件 | 来源 | 说明 |
|---|---|---|
| `ShowcaseCard` | 已有 | 歌曲卡片，含封面、标题、风格、情绪、播放按钮，点击触发 MiniPlayer 播放 |
| `ScrollReveal` | 已有 | 滚动渐入动画 |
| `EmptyState` | 已有 | 无数据时展示 |
| `MiniPlayer` | 已有（全局挂载） | 底部播放器，点击卡片后自动出现 |

### 筛选逻辑

- **风格筛选**：下拉框，选项从数据库 `genre` 字段 DISTINCT 获取
- **情绪筛选**：下拉框，选项从数据库 `mood` 字段 DISTINCT 获取
- **筛选参数**：通过 URL query params 传递（`?genre=Pop&mood=Happy`）
- **Server Component** 读取 params，直接体现在 Supabase query 中

### 分页逻辑

- **每页数量**：18 首（3列 × 6行）
- **实现方式**："加载更多"按钮，点击追加下一页（避免复杂分页器）
- **数据获取**：Server Component 根据 `page` param 计算 offset

## 数据流

```
/[locale]/explore/page.tsx (Server Component)
  │
  ├─ 读取 URL params: genre, mood, page
  │
  ├─ createClient() → Supabase (anon role)
  │
  └─ supabase.from('songs')
       .select('id, title, genre, mood, cover_url, audio_url, duration')
       .eq('is_featured', true)
       .eq('genre', genre?)     // 条件筛选
       .eq('mood', mood?)       // 条件筛选
       .order('created_at', { ascending: false })
       .range(offset, offset + 17)  // 分页
       │
       └─ RLS: anon_read_featured_songs ✅
           using (is_featured = true)
```

## Showcase 入口改造

在 `src/components/sections/showcase.tsx` 的 `</section>` 前增加：

```tsx
<div className="mt-10 text-center">
  <Link href={`/${locale}/explore`} className="...">
    查看全部歌曲 →
  </Link>
</div>
```

- **文案**："查看全部歌曲"（后续可通过 i18n 多语言化）
- **样式**：与现有设计系统一致，outline 按钮或文字链接

## 错误处理

| 场景 | 处理 |
|---|---|
| 无 featured 歌曲 | 展示 `EmptyState` |
| Supabase 查询失败 | 返回空数组，页面正常渲染空状态 |
| 筛选条件无结果 | 展示"未找到符合条件的歌曲"提示 |

## 与现有系统的边界

- **不改动** `/songs` 页面：该页面定位为用户个人歌曲管理
- **不改动** 数据库 schema：已有 `is_featured` 和 RLS 策略足够支撑
- **不新增** UI 组件：全部复用现有组件
- **不改动** 播放器逻辑：ShowcaseCard 已集成播放功能

## 验收标准

- [ ] 未登录用户可直接访问 `/explore`
- [ ] 页面展示全部 `is_featured = true` 的歌曲
- [ ] 点击歌曲卡片触发 MiniPlayer 播放
- [ ] 风格/情绪筛选正常工作
- [ ] "加载更多"分页正常工作
- [ ] 首页 Showcase 显示"查看全部歌曲"入口并正确跳转
- [ ] 空数据状态展示正确
