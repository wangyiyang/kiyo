# Issue #52: 业务页面国际化设计文档

## 背景

Landing page（首页）和 Auth 页面（登录/注册/重置密码）已完成中英文国际化（`next-intl` + `messages/en.json` + `messages/zh.json`）。

但所有**业务页面**（歌曲库、专辑、歌词的列表/详情/编辑/生成页）仍然是**100% 硬编码中文**，英文用户无法正常使用核心功能。这与落地页的双语承诺严重脱节。

由于项目目前主打英文用户，所有可见文本均需国际化，包括 UI 标签、错误提示、Toast、Alert、日期格式等。

## 目标

为所有业务页面及相关共享组件提取 `t()` 翻译键，同步更新 `messages/en.json` 和 `messages/zh.json`，复用已有的 `useTranslations` / `getTranslations` 模式。

## 翻译键组织方案

采用**混合模式（功能域 + common 复用）**：

- **`common`**：高频通用操作词（save/cancel/delete/create）、状态词（saving/loading/generating）、错误提示、空状态文案
- **`songs`**：歌曲域专属文本，按页面子键组织（list/new/detail/edit/generate/cover）
- **`albums`**：专辑域专属文本（list/detail/form/delete/addSongs/cover）
- **`lyrics`**：歌词域专属文本（list/new/detail/edit/generate/generateSong）

## 详细翻译结构

### common

```json
"common": {
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "create": "Create",
    "edit": "Edit",
    "back": "Back to list",
    "backToDetail": "Back to detail",
    "confirm": "Confirm",
    "generate": "Generate",
    "export": "Export",
    "add": "Add",
    "search": "Search...",
    "viewFull": "View full"
  },
  "states": {
    "saving": "Saving...",
    "loading": "Loading...",
    "generating": "Generating...",
    "deleting": "Deleting...",
    "submitting": "Submitting...",
    "exporting": "Exporting...",
    "uploading": "Uploading...",
    "adding": "Adding...",
    "retry": "Retry"
  },
  "errors": {
    "network": "Network error, please try again",
    "unknown": "Something went wrong",
    "required": "This field is required",
    "notFound": "Not found",
    "loadFailed": "Failed to load",
    "saveFailed": "Failed to save",
    "createFailed": "Failed to create",
    "deleteFailed": "Failed to delete",
    "exportFailed": "Export failed, please try again later",
    "uploadFailed": "Upload failed",
    "fileTooLarge": "File size cannot exceed 50MB"
  },
  "empty": {
    "songs": { "title": "No songs yet", "description": "Create your first song" },
    "albums": { "title": "No albums yet", "description": "Create your first album" },
    "lyrics": { "title": "No lyrics yet", "description": "Create your first lyric" }
  }
}
```

### songs

```json
"songs": {
  "list": {
    "title": "Songs",
    "new": "New Song",
    "generate": "AI Compose"
  },
  "new": {
    "title": "New Song",
    "fields": {
      "title": "Title",
      "lyric": "Linked Lyric",
      "noLyric": "No lyric",
      "genre": "Genre",
      "mood": "Mood",
      "aiPrompt": "Generation Prompt"
    },
    "placeholders": {
      "title": "Song title",
      "genre": "e.g. Pop, Rock",
      "mood": "e.g. Inspiring, Sad",
      "aiPrompt": "Describe the music style you want, e.g. Indie folk, melancholy, perfect for a café"
    },
    "error": {
      "emptyTitle": "Title cannot be empty"
    }
  },
  "detail": {
    "back": "Back to list",
    "edit": "Edit",
    "aiCover": "AI Cover",
    "export": "Export Audio",
    "audioPreview": "Audio Preview",
    "lyrics": "Lyrics",
    "viewFullLyrics": "View full lyrics",
    "coverStyle": "Cover Style",
    "compareOriginal": "Compare Original",
    "original": "Original",
    "cover": "Cover",
    "aiPrompt": "Generation Prompt",
    "status": {
      "draft": {
        "title": "Song not yet generated",
        "desc": "Music has not been generated for this song",
        "action": "Generate Music"
      },
      "failed": {
        "title": "Music generation failed",
        "desc": "Please check and retry",
        "action": "Retry"
      },
      "generating": {
        "title": "Generating music, please wait..."
      }
    },
    "source": {
      "ai_generated": "AI Generated",
      "ai_cover": "AI Cover",
      "manual": "Manual"
    },
    "lyricRequired": "Need to link a lyric before generating music"
  },
  "edit": {
    "title": "Edit Song",
    "back": "Back to detail"
  },
  "generate": {
    "title": "AI Compose",
    "fields": {
      "prompt": "Theme Description",
      "genre": "Genre (optional)",
      "mood": "Mood (optional)",
      "language": "Language (optional)",
      "mode": "Composition Mode"
    },
    "placeholders": {
      "prompt": "Describe the music you want, e.g. A pop song about summer",
      "genre": "e.g. Pop",
      "mood": "e.g. Cheerful"
    },
    "mode": {
      "instrumental": { "label": "Instrumental", "desc": "Generate instrumental only, no lyrics" },
      "auto_lyrics": { "label": "Auto Lyrics", "desc": "AI auto-generates lyrics and composes" },
      "existing_lyric": { "label": "Existing Lyric", "desc": "Compose using existing lyrics" }
    },
    "selectLyric": "Select a lyric",
    "noLyrics": "No lyrics available, please create one first",
    "error": {
      "emptyPrompt": "Theme description cannot be empty",
      "noLyricSelected": "Please select a linked lyric"
    },
    "submit": "Start Composing"
  },
  "cover": {
    "title": "AI Cover",
    "source": {
      "label": "Audio Source",
      "existing": "Select Existing",
      "upload": "Upload Audio"
    },
    "selectSong": "Select a song",
    "upload": {
      "label": "Upload Audio",
      "success": "Audio uploaded",
      "formats": "Supports MP3, WAV, FLAC, max 50MB"
    },
    "style": {
      "label": "Cover Style",
      "options": [
        { "label": "Pop Rock", "prompt": "Pop rock version, faster tempo, electric guitar driven" },
        { "label": "Jazz Piano", "prompt": "Jazz piano version, lazy saxophone, relaxed tempo" },
        { "label": "Folk Guitar", "prompt": "Folk guitar version, fingerstyle guitar, intimate vocals" },
        { "label": "EDM", "prompt": "Electronic dance version, strong beats, synth pads" },
        { "label": "Classical Orchestral", "prompt": "Classical orchestral version, string arrangement, solemn atmosphere" },
        { "label": "Lo-fi Relax", "prompt": "Lo-fi relax version, vinyl noise, dreamy atmosphere" },
        { "label": "Rock Metal", "prompt": "Rock metal version, distorted guitar, powerful drums" },
        { "label": "Soul", "prompt": "Soul version, emotionally rich, improvised vocals" }
      ]
    },
    "title": "Title (optional)",
    "titlePlaceholder": "Leave empty to auto-generate",
    "error": {
      "noAudio": "Please select an existing song",
      "noUpload": "Please upload an audio file",
      "noStyle": "Please select a cover style",
      "noSongs": "No available songs, please create and generate music first"
    },
    "submit": "Start Cover"
  },
  "export": {
    "title": "Export Audio",
    "song": "Song",
    "format": "Format",
    "formatValue": "MP3",
    "success": "Download started",
    "confirm": "Confirm Export"
  }
}
```

### albums

```json
"albums": {
  "list": {
    "title": "My Albums",
    "new": "New Album",
    "songLibrary": "Songs"
  },
  "detail": {
    "back": "Back to albums",
    "songList": "Song List",
    "songCount": "{count} songs",
    "noSongs": {
      "title": "No songs in album",
      "description": "Edit album to add songs"
    }
  },
  "form": {
    "createTitle": "New Album",
    "editTitle": "Edit Album",
    "name": "Album Name",
    "namePlaceholder": "Enter album name",
    "description": "Description (optional)",
    "descriptionPlaceholder": "Enter album description",
    "selectSongs": "Select Songs",
    "save": "Save"
  },
  "delete": {
    "title": "Confirm Delete",
    "description": "Are you sure you want to delete album <strong>{title}</strong>? This action cannot be undone, but songs will not be affected."
  },
  "addSongs": {
    "title": "Add Songs to Album",
    "empty": "No available songs",
    "selectedCount": "Add ({count})",
    "noSongsHint": "No songs available"
  },
  "cover": {
    "generating": "Generating...",
    "regenerate": "Regenerate",
    "retry": "Retry",
    "generate": "Generate Cover",
    "error": "Generation failed, please retry"
  },
  "reorder": {
    "saving": "Saving order...",
    "failed": "Failed to update order"
  }
}
```

### lyrics

```json
"lyrics": {
  "list": {
    "title": "My Lyrics",
    "new": "New Lyric",
    "generate": "AI Generate Lyrics"
  },
  "new": {
    "title": "New Lyric",
    "fields": {
      "title": "Title",
      "language": "Language",
      "style": "Style",
      "mood": "Mood",
      "content": "Content"
    },
    "placeholders": {
      "title": "Lyric title",
      "language": "e.g. zh, en",
      "style": "e.g. Pop, Rock",
      "mood": "e.g. Inspiring, Sad",
      "content": "Enter lyrics here, supports [Verse], [Chorus] tags..."
    },
    "error": {
      "empty": "Title and content cannot be empty"
    }
  },
  "detail": {
    "back": "Back to list",
    "edit": "Edit",
    "generateSong": "Generate Music",
    "linkedSongs": "Linked Songs",
    "noLinkedSongs": {
      "title": "No linked songs",
      "description": "Use the button above to generate music"
    },
    "source": {
      "ai": "AI",
      "manual": "Manual"
    },
    "composed": "Composed",
    "noLanguage": "Not specified",
    "noStyle": "Not specified"
  },
  "edit": {
    "title": "Edit Lyric",
    "back": "Back to detail",
    "contentLabel": "Lyric Content"
  },
  "generate": {
    "title": "AI Generate Lyrics",
    "subtitle": "Describe your song theme and AI will write complete lyrics",
    "fields": {
      "prompt": "Theme Description",
      "language": "Language",
      "style": "Style (optional)",
      "mood": "Mood (optional)"
    },
    "placeholders": {
      "prompt": "e.g. An inspiring song about youth campus",
      "style": "Pop, Rock...",
      "mood": "Inspiring, Sad..."
    },
    "submit": "Generate Lyrics",
    "error": {
      "failed": "Generation failed, please try again later",
      "network": "Generation failed, please check your network"
    }
  },
  "generateSong": {
    "title": "Generate Music from Lyric",
    "emptyWarning": "Lyric content is empty, cannot generate music",
    "fields": {
      "prompt": "Theme Description",
      "genre": "Genre (optional)",
      "mood": "Mood (optional)",
      "language": "Language (optional)"
    },
    "placeholders": {
      "prompt": "Describe the music you want",
      "genre": "e.g. Pop",
      "mood": "e.g. Cheerful"
    },
    "preview": "Lyric Preview",
    "noContent": "(No content)",
    "submit": "Start Generate"
  }
}
```

## 共享组件改造

### SongStatusBadge

位于 `packages/ui/src/components/song-status-badge.tsx`，当前硬编码了中文状态标签。

**改造方案**：添加 `label` prop，由调用方传入翻译后的文本。

```tsx
interface SongStatusBadgeProps {
  status: SongStatus
  label: string  // 新增
}
```

保持 UI 包无国际化依赖，由调用方控制显示文本。

### EmptyState / SongRow

这两个组件文本通过 props 传入，只需确保调用方传入翻译后的文本即可，无需修改组件本身。

## 日期格式国际化

将所有 `toLocaleDateString('zh-CN')` 改为 `toLocaleDateString(locale)`，locale 从 `getLocale()` 获取。

涉及文件：`apps/web/src/app/lyrics/page.tsx`

## 文件变更清单

| 文件 | 变更类型 |
|------|---------|
| `messages/en.json` | 新增 `common`、`songs`、`albums`、`lyrics` 命名空间 |
| `messages/zh.json` | 新增对应中文翻译 |
| `packages/ui/src/components/song-status-badge.tsx` | 添加 `label` prop，移除内部硬编码 |
| `apps/web/src/app/songs/page.tsx` | 提取 `t()` |
| `apps/web/src/app/songs/new/page.tsx` | 提取 `t()` |
| `apps/web/src/app/songs/[id]/page.tsx` | 提取 `t()`，传入 label 给 SongStatusBadge |
| `apps/web/src/app/songs/[id]/edit/page.tsx` | 提取 `t()` |
| `apps/web/src/app/songs/generate/page.tsx` | 提取 `t()`，国际化语言选项和模式选项 |
| `apps/web/src/app/songs/cover/page.tsx` | 提取 `t()`，国际化风格选项 |
| `apps/web/src/app/songs/[id]/export-dialog.tsx` | 提取 `t()`，国际化 toast |
| `apps/web/src/app/albums/page.tsx` | 提取 `t()` |
| `apps/web/src/app/albums/[id]/page.tsx` | 提取 `t()` |
| `apps/web/src/app/albums/_components/AlbumFormDialog.tsx` | 提取 `t()` |
| `apps/web/src/app/albums/_components/DeleteConfirmDialog.tsx` | 提取 `t()` |
| `apps/web/src/app/albums/_components/AddSongsDialog.tsx` | 提取 `t()` |
| `apps/web/src/app/albums/_components/CoverSection.tsx` | 提取 `t()` |
| `apps/web/src/app/albums/_components/DraggableSongList.tsx` | 提取 `t()` |
| `apps/web/src/app/albums/_components/SongSelector.tsx` | 提取 `t()` |
| `apps/web/src/app/lyrics/page.tsx` | 提取 `t()`，日期格式国际化 |
| `apps/web/src/app/lyrics/new/page.tsx` | 提取 `t()` |
| `apps/web/src/app/lyrics/[id]/page.tsx` | 提取 `t()` |
| `apps/web/src/app/lyrics/[id]/edit/page.tsx` | 提取 `t()` |
| `apps/web/src/app/lyrics/generate/page.tsx` | 提取 `t()`，国际化语言选项 |
| `apps/web/src/app/lyrics/[id]/generate-song-dialog.tsx` | 提取 `t()` |

## 实现注意事项

1. **Server vs Client**：
   - 服务端组件（Server Component）使用 `getTranslations()` 获取 `t`
   - 客户端组件（Client Component）使用 `useTranslations()` hook
   - `messages/en.json` 和 `zh.json` 结构必须完全一致

2. **SongStatusBadge 调用方**：
   - `songs/detail` 页面需要传入翻译后的 label：`t('songs.detail.source.ai_generated')` 等映射到 status
   - `lyrics/detail` 页面中的 `SongStatusBadge` 同理

3. **动态值插值**：
   - 如 `albums.detail.songCount` 使用 `t('albums.detail.songCount', { count: songs.length })`
   - 如 `albums.delete.description` 使用 `t('albums.delete.description', { title: albumTitle })`，注意 HTML 标签处理

4. **选择/下拉选项**：
   - `songs/generate` 的 LANGUAGE_OPTIONS、MODE_OPTIONS
   - `songs/cover` 的 STYLE_OPTIONS
   - `lyrics/generate` 和 `generate-song-dialog` 的 LANGUAGES
   这些需要改为从 messages 读取或保持代码内联但 label 从 t() 获取

5. **Error 消息**：
   - 客户端 error state 统一从 `common.errors` 中取值
   - alert() 弹窗的文本也需要翻译

6. **类型检查**：
   - 修改后需运行 `pnpm type-check` 确保没有 TypeScript 错误
   - `SongStatusBadge` 新增 `label` prop 后，需检查所有调用方是否已更新
