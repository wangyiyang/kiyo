# Kiyo

> **Kiyo** — AI音乐创作平台。让每一个人都能创造属于自己的声音。

## 简介

Kiyo 是一个面向创作者的 AI 音乐平台，专注于两大核心场景：

- **AI 生成原创音乐** — 输入风格、情绪或关键词，即可生成完整的人声+伴奏作品
- **AI 翻唱** — 用你喜欢的声音风格，重新演绎任意歌曲

无论你是音乐人、UP 主、短视频创作者，还是单纯热爱音乐的人，Kiyo 都能帮你把灵感快速变成作品。

## 核心功能

| 功能 | 描述 |
|------|------|
| 🎵 AI 作曲 | 文本生成音乐，支持多风格、多语言人声 |
| 🎤 AI 翻唱 | 一键切换歌手音色，保留原曲情感 |
| 🎛️ 智能编辑 | 分段调整、风格迁移、和声重构 |
| 📤 云端导出 | 支持 WAV/MP3/MIDI 多格式下载 |
| 💿 专辑管理 | 选中歌曲创建专辑，自动生成专辑封面 |
| 📝 AI 写词 | 输入主题、风格和情绪，AI 生成歌词 |
| ✏️ 歌词编辑 | 支持新建和编辑歌词，支持 AI 生成后二次修改 |

## 技术栈

- **前端**: Next.js + React + TypeScript + Tailwind CSS + shadcn/ui
- **后端**: Supabase（数据库 + 对象存储 + Auth + Edge Functions）
- **AI 服务**: Minimax（CN）——覆盖大模型、音乐生成、歌词生成、文生图
- **架构**: pnpm + Turborepo Monorepo
- **部署**: Vercel / 自有服务器

## 快速开始

```bash
# 克隆仓库
git clone git@github.com:wangyiyang/kiyo.git
cd kiyo

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

访问 http://localhost:3000 查看效果。

## 项目结构

```
kiyo/
├── apps/
│   └── web/                 # Next.js 前端应用
├── packages/
│   ├── ui/                  # shadcn/ui 组件库封装（共享 UI）
│   ├── shared/              # 共享类型、工具函数
│   ├── supabase/            # Supabase client 封装、schema 类型
│   ├── eslint-config/       # 共享 ESLint 配置
│   └── typescript-config/   # 共享 TypeScript 配置
├── supabase/
│   └── migrations/          # 数据库迁移文件
├── package.json             # workspace root 配置
├── pnpm-workspace.yaml      # pnpm workspace 定义
└── turbo.json               # Turborepo 任务编排
```

## 核心功能架构

### 专辑管理

用户可从自己的歌曲库中选择多首歌曲创建专辑，并支持 AI 生成专辑封面。

**数据模型**

- `albums` — 专辑主表，包含标题、描述、封面、状态等字段
- `album_songs` — 专辑与歌曲的多对多关联表，支持 `order_index` 排序

**关键流程**

1. 用户从歌曲库中选择歌曲
2. 创建专辑并建立歌曲关联（按选择顺序排序）
3. 调用 AI 生成服务创建专辑封面
4. 封面上传至 Supabase Storage 并关联到专辑

### 歌词管理

支持 AI 生成歌词、手动创建歌词，以及对歌词进行编辑和二次创作。

**数据模型**

- `lyrics` — 歌词主表，包含标题、内容、语言、风格、情绪、来源等字段

**关键流程**

1. **AI 生成歌词**：用户输入主题、风格、情绪等参数，调用 AI 服务生成歌词内容，保存为草稿
2. **手动创建歌词**：用户直接填写标题和内容，创建空白歌词草稿
3. **编辑歌词**：用户在编辑器中修改歌词内容或元数据，支持 AI 生成后的二次修改
4. **关联音乐**：后续可将歌词与 AI 生成的歌曲进行关联（通过 `songs.lyric_id`）

### 数据库与存储

- 所有 Schema 变更通过 `supabase/migrations/` 管理
- 音频文件、专辑封面等存储在 Supabase Storage
- RLS（Row Level Security）策略确保用户只能访问自己的数据

## 开发规范

### 常用命令

```bash
# 根目录命令
pnpm dev          # 启动开发服务器
pnpm build        # 构建所有应用和包
pnpm type-check   # 类型检查
pnpm lint         # 代码检查
pnpm test         # 运行测试

# 单应用/单包命令
pnpm dev -- --filter=web
pnpm test -- --filter=web
```

### Supabase 本地开发

```bash
# 启动本地 Supabase 栈
npx supabase start

# 查看状态
npx supabase status

# 生成迁移
npx supabase db diff -f <migration-name>

# 应用迁移
npx supabase db reset
```

## 部署

项目计划部署在 `kiyo.wangyiyang.cc`。

- 前端通过 Vercel 部署
- 数据库和 Storage 使用 Supabase 云服务
- 不同环境（Production / Preview / Development）的环境变量在 Vercel Dashboard 中分别配置

## 贡献

欢迎 Issue 和 PR。在提交代码前，请确保：

1. 代码通过类型检查：`pnpm type-check`
2. 代码通过 lint：`pnpm lint`
3. 所有数据库变更已生成迁移文件

## Git 分支策略

- `main` 为默认稳定分支
- `feature/*`、`fix/*`、`hotfix/*` 等分支统一从 `main` 拉出，并通过 PR 合并回 `main`
- 禁止直接提交到 `main`

## License

[MIT](LICENSE)
