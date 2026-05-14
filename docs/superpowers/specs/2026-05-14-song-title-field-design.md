# 设计：AI 作曲创建页增加独立「歌曲名称」字段

## 背景与问题

创建歌曲时，UI 只有一个「主题描述」（prompt）输入框，但生成 API 将 prompt 截断后作为 `title` 存入数据库。这导致：

- 用户认为自己在输入"主题/描述"，但系统把它当作"歌曲名称"展示
- 标题可能是长句子，不适合作为歌曲名称
- 翻译文件中已有 `title` 相关文案，但创建页未使用

## 目标

在创建歌曲时，让用户分别输入**歌曲名称**（必填）和**主题描述**（必填），两者语义独立。

## 方案（方案 A）

在创建表单增加独立的「歌曲名称」字段，API 接收并校验该字段。

### 改动范围

#### 前端：创建页

- `apps/web/src/app/[locale]/songs/new/page.tsx`
  - 新增 `title` state（必填）
  - 表单增加「歌曲名称」输入框（放在 prompt 上方）
  - 提交时校验 `title` 不能为空
  - POST body 中增加 `title` 字段
  - 使用已有的翻译 key：`songs.new.fields.title`、`songs.new.placeholders.title`、`songs.new.error.emptyTitle`

#### 后端：生成 API

- `apps/web/src/app/api/songs/generate/route.ts`
  - 从 body 中读取 `title` 参数
  - 增加 `title` 必填校验（非空字符串）
  - `insert({ title: title.trim().slice(0, 100), ... })` 替换现有的 `prompt.trim().slice(0, 100)`

#### 翻译文件

- `apps/web/messages/zh.json`、`apps/web/messages/en.json`
  - `songs.new.fields.prompt` 保持为「主题描述」（当前已是这个值，无需改动）
  - 已有 `fields.title`、`placeholders.title`、`error.emptyTitle`，无需新增 key

#### 测试

- `apps/web/src/app/api/songs/generate/route.test.ts`：更新测试用例，POST body 中补充 `title`
- `apps/web/src/app/api/songs/[id]/route.test.ts`：保持现状（编辑页测试不受影响）

### 数据流

```
用户输入：
  ├─ 歌曲名称 (title) ──→ POST /api/songs/generate ──→ songs.title
  └─ 主题描述 (prompt) ──→ POST /api/songs/generate ──→ generation_tasks.payload.prompt
                                        └─→ songs.ai_prompt
```

### 边界与错误处理

- `title` 为空或仅空白字符 → 前端拦截，显示 `songs.new.error.emptyTitle`
- `title` 超过 100 字符 → 后端截断保存（`.slice(0, 100)`）
- 向后兼容：这个改动只影响新创建的歌曲，现有歌曲不受影响

### 不改动范围

- 编辑页（`songs/[id]/edit`）：已有 title 字段，无需改动
- 列表页、详情页：展示逻辑不变
- 数据库 schema：`songs.title` 已存在

## 决策记录

- **歌曲名称必填**：创建时要求用户明确输入，避免系统自动生成模糊标题。
- **字段顺序**：歌曲名称在主题描述上方，符合"先命名再描述"的认知顺序。
- **复用已有翻译**：翻译文件中已有 `songs.new.fields.title` 等 key，无需新增。
