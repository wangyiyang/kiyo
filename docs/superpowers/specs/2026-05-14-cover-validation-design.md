# Design: AI 翻唱页面按钮禁用校验（Issue #161）

## 背景

AI 翻唱页面在未选择已有歌曲、也未上传音频时，「开始翻唱」按钮仍可点击；点击后页面无任何校验提示、toast 或状态变化。用户会误以为按钮失效或系统卡住。

## 目标

未选择音频源时，「开始翻唱」按钮应为 disabled 状态，阻止用户提交无效表单。

## 方案

采用方案 A：根据表单有效性实时禁用按钮。

### 变更文件

- `apps/web/src/app/[locale]/songs/cover/page.tsx`

### 核心逻辑

新增派生状态 `canSubmit`：

```ts
const hasAudioSource =
  sourceMode === 'existing'
    ? songs.some((s) => s.id === selectedSongId && (s.file_path || s.audio_url))
    : !!uploadedUrl

const canSubmit = hasAudioSource && !!selectedStyle && !uploading
```

按钮 `disabled` 更新为：

```ts
disabled={generating || !canSubmit}
```

### 边界情况

- **切换 sourceMode**：切到 upload tab 时 uploadedUrl 为空，`canSubmit` 为 false。
- **歌曲列表加载中**：未选择任何歌曲时按钮 disabled。
- **已过滤的歌曲列表**：当前 songs 已过滤掉无音频项，但 `canSubmit` 仍显式检查对应 song 是否有音频，作为防御性校验。
- **兜底保护**：`handleGenerate` 中原有的校验逻辑保留，防止按钮被绕过（如键盘触发）时仍有二次保护。

### 不涉及的变更

- 不修改 API 路由或数据库。
- 不修改国际化文案（已有 `noAudio`、`noUpload`、`noStyle` 等提示文案）。
- 不引入新依赖。

## 验收标准

- [ ] 未选择已有歌曲时，「开始翻唱」按钮为 disabled。
- [ ] 切换到上传音频 tab 但未上传文件时，按钮为 disabled。
- [ ] 已选择歌曲或已上传音频，但未选风格时，按钮为 disabled。
- [ ] 选择音频源并选择风格后，按钮变为 enabled。
- [ ] `handleGenerate` 中原有校验逻辑保留作为兜底。
