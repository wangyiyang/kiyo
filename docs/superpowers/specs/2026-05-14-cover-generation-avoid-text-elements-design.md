# Cover Generation 避免文字元素 — 设计文档

> GitHub Issue: #171 — Cover generation should avoid text elements due to image generation limitations

## 背景

当前 AI 图像生成模型（Minimax `image-01`）在文字渲染上存在明显短板：生成的文字经常出现错别字、乱码、排版错乱、不可读等问题。专辑/歌曲封面的 prompt 中直接嵌入了专辑名、歌曲名等文本信息（如 `专辑: 夜曲`），导致模型尝试在画面中渲染文字，最终效果不可接受。

## 目标

- 确保生成封面的 Prompt 中**不包含要求生成文字的指令**
- 保留标题/描述的**语义参考价值**，让封面仍能传达主题意境
- 显式添加**负面指令**，引导模型不生成任何文字、字母、符号
- 同步更新前后端及 Worker 中的 prompt 构造逻辑

## 方案选择

采用 **方案2：结构化重构**（保留语义参考 + 负面指令）。

- **不选方案1（简单追加）**：负面提示松散追加效果差，模型容易忽略
- **不选方案3（AI 转译）**：改动大、需要额外映射规则，可能丢失语义精确性

## Prompt 结构设计

重构为四层结构：

```
1. 语义描述：基于 [album/song] 主题 "[title]" 的视觉封面设计
2. 风格/情绪：[description/genre/mood 等]
3. 格式约束：正方形专辑封面，高细节，艺术插画风格
4. 负面指令：画面中不得出现任何文字、字母、数字、符号或语言字符
```

### 示例对比

| 类型 | 当前 prompt | 新 prompt |
|---|---|---|
| Album | `专辑: 夜曲。一张关于夜晚与孤独的专辑` | `基于专辑主题"夜曲"的视觉封面设计。关于夜晚与孤独的意境。正方形专辑封面，高细节，艺术插画风格。画面中不得出现任何文字、字母、数字、符号或语言字符。` |
| Song | `歌曲: 夏日微风，风格：流行，情绪：轻松` | `基于歌曲主题"夏日微风"的视觉封面设计。流行风格，轻松情绪。正方形专辑封面，高细节，艺术插画风格。画面中不得出现任何文字、字母、数字、符号或语言字符。` |

## 架构与数据流

数据流无变化，仅 prompt 构造函数逻辑变更：

```
用户点击「生成封面」
  → API Route (album/song cover route)
    → buildCoverPrompt(title, description/genre/mood)
      → 生成结构化 prompt（含负面指令）
    → 写入 generation_tasks（payload.prompt）
  → Worker (process-generation-task)
    → buildCoverPrompt（Worker 内同名函数，需同步）
    → 调用 Minimax /v1/image_generation
```

## 改动范围

| 文件 | 动作 | 说明 |
|---|---|---|
| `apps/web/src/lib/cover.ts` | 修改 | 重构 `buildCoverPrompt`，四层结构化输出 |
| `supabase-local/functions/process-generation-task/index.ts` | 修改 | 同步同名 `buildCoverPrompt` 函数 |
| `apps/web/src/app/api/albums/[id]/cover/route.test.ts` | 修改 | 更新测试中 prompt 断言 |
| `apps/web/src/app/api/songs/[id]/cover/route.test.ts` | 修改 | 更新测试中 prompt 断言 |

## 不变的部分

- API 路由逻辑（鉴权、限流、任务创建、上传流程）
- Worker 调度与重试机制
- 前端 `CoverSection` 组件
- 图像生成模型参数（`image-01`、尺寸、格式等）
- Supabase Storage 上传路径规则

## 验收标准

- [ ] `buildCoverPrompt('album', {...})` 返回的字符串不包含要求生成文字的指令
- [ ] `buildCoverPrompt('song', {...})` 返回的字符串不包含要求生成文字的指令
- [ ] Prompt 末尾固定包含负面指令段落
- [ ] Worker 中的 `buildCoverPrompt` 与前端库中的实现一致
- [ ] 相关单元测试通过
- [ ] TypeScript 编译通过

## 风险与回退

- **风险**：负面指令可能被模型忽略，仍偶发文字。缓解：若后续效果不佳，可再叠加方案3（AI 语义转译）。
- **回退**：仅需恢复 `buildCoverPrompt` 函数为旧实现即可，无 schema 或数据迁移风险。
