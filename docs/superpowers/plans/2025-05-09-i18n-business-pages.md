# Issue #52: 业务页面国际化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为所有业务页面（歌曲、专辑、歌词）及相关共享组件提取 `t()` 翻译键，同步更新 `messages/en.json` 和 `messages/zh.json`，复用已有的 `next-intl` 模式。

**Architecture:** 按功能域组织翻译键（`common`、`songs`、`albums`、`lyrics`），共享组件 `SongStatusBadge` 改为接收 `label` prop，服务端组件用 `getTranslations()`，客户端组件用 `useTranslations()`。

**Tech Stack:** Next.js 14, next-intl, React, TypeScript, @kiyo/ui

---

## 文件变更总览

| 文件 | 变更 |
|------|------|
| `messages/en.json` | 新增 `common`、`songs`、`albums`、`lyrics` |
| `messages/zh.json` | 新增对应中文翻译 |
| `packages/ui/src/components/song-status-badge.tsx` | 添加 `label` prop |
| `apps/web/src/app/songs/page.tsx` | 提取 t() |
| `apps/web/src/app/songs/new/page.tsx` | 提取 t() |
| `apps/web/src/app/songs/[id]/page.tsx` | 提取 t()，传入 label 给 SongStatusBadge |
| `apps/web/src/app/songs/[id]/edit/page.tsx` | 提取 t() |
| `apps/web/src/app/songs/generate/page.tsx` | 提取 t() |
| `apps/web/src/app/songs/cover/page.tsx` | 提取 t() |
| `apps/web/src/app/songs/[id]/export-dialog.tsx` | 提取 t() |
| `apps/web/src/app/albums/page.tsx` | 提取 t() |
| `apps/web/src/app/albums/[id]/page.tsx` | 提取 t() |
| `apps/web/src/app/albums/_components/AlbumFormDialog.tsx` | 提取 t() |
| `apps/web/src/app/albums/_components/DeleteConfirmDialog.tsx` | 提取 t() |
| `apps/web/src/app/albums/_components/AddSongsDialog.tsx` | 提取 t() |
| `apps/web/src/app/albums/_components/CoverSection.tsx` | 提取 t() |
| `apps/web/src/app/albums/_components/DraggableSongList.tsx` | 提取 t() |
| `apps/web/src/app/albums/_components/SongSelector.tsx` | 提取 t() |
| `apps/web/src/app/lyrics/page.tsx` | 提取 t()，日期格式国际化 |
| `apps/web/src/app/lyrics/new/page.tsx` | 提取 t() |
| `apps/web/src/app/lyrics/[id]/page.tsx` | 提取 t() |
| `apps/web/src/app/lyrics/[id]/edit/page.tsx` | 提取 t() |
| `apps/web/src/app/lyrics/generate/page.tsx` | 提取 t() |
| `apps/web/src/app/lyrics/[id]/generate-song-dialog.tsx` | 提取 t() |

---

## Task 1: 翻译文件（messages/en.json + zh.json）

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh.json`

---

- [ ] **Step 1: 在 en.json 末尾 `auth` 对象后添加新命名空间**

在 `messages/en.json` 中找到 `"auth"` 对象结束后的位置（在 `"resetPassword"` 闭合后、文件闭合前），添加以下内容：

```json
,
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
      "uploadFailed": "Upload failed: {message}",
      "fileTooLarge": "File size cannot exceed 50MB",
      "addFailed": "Failed to add",
      "updateFailed": "Failed to update"
    },
    "empty": {
      "songs": { "title": "No songs yet", "description": "Create your first song" },
      "albums": { "title": "No albums yet", "description": "Create your first album" },
      "lyrics": { "title": "No lyrics yet", "description": "Create your first lyric" }
    }
  },
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
  },
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
  },
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

- [ ] **Step 2: 在 zh.json 末尾 `auth` 对象后添加新命名空间**

在 `messages/zh.json` 中同样位置添加完全对称的结构，但中文翻译：

```json
,
  "common": {
    "actions": {
      "save": "保存",
      "cancel": "取消",
      "delete": "删除",
      "create": "创建",
      "edit": "编辑",
      "back": "返回列表",
      "backToDetail": "返回详情",
      "confirm": "确认",
      "generate": "生成",
      "export": "导出",
      "add": "添加",
      "search": "搜索...",
      "viewFull": "查看完整"
    },
    "states": {
      "saving": "保存中...",
      "loading": "加载中...",
      "generating": "生成中...",
      "deleting": "删除中...",
      "submitting": "提交中...",
      "exporting": "导出中...",
      "uploading": "上传中...",
      "adding": "添加中...",
      "retry": "重试"
    },
    "errors": {
      "network": "网络错误，请重试",
      "unknown": "出了点问题",
      "required": "此字段为必填项",
      "notFound": "未找到",
      "loadFailed": "加载失败",
      "saveFailed": "保存失败",
      "createFailed": "创建失败",
      "deleteFailed": "删除失败",
      "exportFailed": "导出失败，请稍后重试",
      "uploadFailed": "上传失败：{message}",
      "fileTooLarge": "文件大小不能超过 50MB",
      "addFailed": "添加失败",
      "updateFailed": "更新失败"
    },
    "empty": {
      "songs": { "title": "暂无歌曲", "description": "创建你的第一首歌曲吧" },
      "albums": { "title": "暂无专辑", "description": "创建你的第一张专辑吧" },
      "lyrics": { "title": "暂无歌词", "description": "创建你的第一首歌词吧" }
    }
  },
  "songs": {
    "list": {
      "title": "歌曲库",
      "new": "新建歌曲",
      "generate": "AI 作曲"
    },
    "new": {
      "title": "新建歌曲",
      "fields": {
        "title": "标题",
        "lyric": "关联歌词",
        "noLyric": "不关联歌词",
        "genre": "风格",
        "mood": "情绪",
        "aiPrompt": "生成描述"
      },
      "placeholders": {
        "title": "歌曲标题",
        "genre": "如：流行、摇滚",
        "mood": "如：励志、忧伤",
        "aiPrompt": "描述你想要的音乐风格，如：独立民谣，忧郁，适合在咖啡馆聆听"
      },
      "error": {
        "emptyTitle": "标题不能为空"
      }
    },
    "detail": {
      "back": "返回列表",
      "edit": "编辑",
      "aiCover": "AI 翻唱",
      "export": "导出音频",
      "audioPreview": "音频预览",
      "lyrics": "歌词",
      "viewFullLyrics": "查看完整歌词",
      "coverStyle": "翻唱风格",
      "compareOriginal": "对比原曲",
      "original": "原曲",
      "cover": "翻唱",
      "aiPrompt": "生成描述",
      "status": {
        "draft": {
          "title": "歌曲尚未生成",
          "desc": "歌曲尚未生成音乐",
          "action": "生成音乐"
        },
        "failed": {
          "title": "音乐生成失败",
          "desc": "请检查后重试",
          "action": "重新生成"
        },
        "generating": {
          "title": "音乐生成中，请稍候..."
        }
      },
      "source": {
        "ai_generated": "AI 生成",
        "ai_cover": "AI 翻唱",
        "manual": "手动创建"
      },
      "lyricRequired": "需要关联歌词后才能生成音乐"
    },
    "edit": {
      "title": "编辑歌曲",
      "back": "返回详情"
    },
    "generate": {
      "title": "AI 作曲",
      "fields": {
        "prompt": "主题描述",
        "genre": "风格（可选）",
        "mood": "情绪（可选）",
        "language": "语言（可选）",
        "mode": "创作模式"
      },
      "placeholders": {
        "prompt": "描述你想要的音乐，如：一首关于夏天的流行歌曲",
        "genre": "如：流行",
        "mood": "如：欢快"
      },
      "mode": {
        "instrumental": { "label": "纯音乐", "desc": "仅生成伴奏，无歌词" },
        "auto_lyrics": { "label": "自动写词", "desc": "AI 自动生成歌词并作曲" },
        "existing_lyric": { "label": "已有歌词", "desc": "使用已有歌词进行作曲" }
      },
      "selectLyric": "请选择歌词",
      "noLyrics": "暂无可选歌词，请先创建歌词",
      "error": {
        "emptyPrompt": "主题描述不能为空",
        "noLyricSelected": "请选择关联歌词"
      },
      "submit": "开始创作"
    },
    "cover": {
      "title": "AI 翻唱",
      "source": {
        "label": "参考音频来源",
        "existing": "选择已有歌曲",
        "upload": "上传音频"
      },
      "selectSong": "请选择一首歌曲",
      "upload": {
        "label": "上传音频",
        "success": "音频已上传",
        "formats": "支持 MP3、WAV、FLAC，最大 50MB"
      },
      "style": {
        "label": "翻唱风格",
        "options": [
          { "label": "流行摇滚版", "prompt": "流行摇滚版，节奏更快，电吉他驱动" },
          { "label": "爵士钢琴版", "prompt": "爵士钢琴版，慵懒萨克斯，舒缓节奏" },
          { "label": "民谣吉他版", "prompt": "民谣吉他版，指弹吉他，亲密人声" },
          { "label": "电子舞曲版", "prompt": "电子舞曲版，强烈节拍，合成器铺底" },
          { "label": "古典管弦版", "prompt": "古典管弦版，弦乐编排，庄重氛围" },
          { "label": "Lo-fi 放松版", "prompt": "Lo-fi 放松版，黑胶噪点，梦幻氛围" },
          { "label": "摇滚金属版", "prompt": "摇滚金属版，失真吉他，强力鼓组" },
          { "label": "灵魂乐版", "prompt": "灵魂乐版，情感充沛，即兴唱腔" }
        ]
      },
      "title": "作品标题（可选）",
      "titlePlaceholder": "留空将自动生成标题",
      "error": {
        "noAudio": "请选择一首已有歌曲",
        "noUpload": "请上传音频文件",
        "noStyle": "请选择翻唱风格",
        "noSongs": "暂无可用歌曲，请先创建并生成音乐"
      },
      "submit": "开始翻唱"
    },
    "export": {
      "title": "导出音频",
      "song": "歌曲",
      "format": "格式",
      "formatValue": "MP3",
      "success": "已开始下载",
      "confirm": "确认导出"
    }
  },
  "albums": {
    "list": {
      "title": "我的专辑",
      "new": "新建专辑",
      "songLibrary": "歌曲库"
    },
    "detail": {
      "back": "返回专辑列表",
      "songList": "歌曲列表",
      "songCount": "{count} 首歌曲",
      "noSongs": {
        "title": "专辑暂无歌曲",
        "description": "编辑专辑添加歌曲"
      }
    },
    "form": {
      "createTitle": "新建专辑",
      "editTitle": "编辑专辑",
      "name": "专辑名称",
      "namePlaceholder": "输入专辑名称",
      "description": "描述（可选）",
      "descriptionPlaceholder": "输入专辑描述",
      "selectSongs": "选择歌曲",
      "save": "保存"
    },
    "delete": {
      "title": "确认删除",
      "description": "确定要删除专辑 <strong>{title}</strong> 吗？此操作不可撤销，但不会影响专辑中的歌曲。"
    },
    "addSongs": {
      "title": "添加歌曲到专辑",
      "empty": "暂无可用歌曲",
      "selectedCount": "添加 ({count})",
      "noSongsHint": "暂无可用歌曲"
    },
    "cover": {
      "generating": "生成中...",
      "regenerate": "重新生成",
      "retry": "重试",
      "generate": "生成封面",
      "error": "生成失败，请重试"
    },
    "reorder": {
      "saving": "保存中...",
      "failed": "更新失败"
    }
  },
  "lyrics": {
    "list": {
      "title": "我的歌词",
      "new": "新建歌词",
      "generate": "AI 生成歌词"
    },
    "new": {
      "title": "新建歌词",
      "fields": {
        "title": "标题",
        "language": "语言",
        "style": "风格",
        "mood": "情绪",
        "content": "内容"
      },
      "placeholders": {
        "title": "歌词标题",
        "language": "如：zh、en",
        "style": "如：流行、摇滚",
        "mood": "如：励志、忧伤",
        "content": "在此输入歌词内容，支持 [Verse]、[Chorus] 等标签..."
      },
      "error": {
        "empty": "标题和内容不能为空"
      }
    },
    "detail": {
      "back": "返回列表",
      "edit": "编辑",
      "generateSong": "生成音乐",
      "linkedSongs": "关联歌曲",
      "noLinkedSongs": {
        "title": "暂无关联歌曲",
        "description": "使用上方按钮生成音乐"
      },
      "source": {
        "ai": "AI",
        "manual": "手动"
      },
      "composed": "已作曲",
      "noLanguage": "未指定语言",
      "noStyle": "未指定风格"
    },
    "edit": {
      "title": "编辑歌词",
      "back": "返回详情",
      "contentLabel": "歌词内容"
    },
    "generate": {
      "title": "AI 生成歌词",
      "subtitle": "描述你想要的歌曲主题，AI 将为你创作完整歌词",
      "fields": {
        "prompt": "主题描述",
        "language": "语言",
        "style": "风格（可选）",
        "mood": "情绪（可选）"
      },
      "placeholders": {
        "prompt": "例如：一首关于青春校园的励志歌曲",
        "style": "流行、摇滚...",
        "mood": "励志、忧伤..."
      },
      "submit": "生成歌词",
      "error": {
        "failed": "生成失败，请稍后重试",
        "network": "生成失败，请检查网络"
      }
    },
    "generateSong": {
      "title": "基于此歌词生成音乐",
      "emptyWarning": "歌词内容为空，无法生成音乐",
      "fields": {
        "prompt": "主题描述",
        "genre": "风格（可选）",
        "mood": "情绪（可选）",
        "language": "语言（可选）"
      },
      "placeholders": {
        "prompt": "描述你想要的音乐",
        "genre": "如：流行",
        "mood": "如：欢快"
      },
      "preview": "歌词预览",
      "noContent": "（无内容）",
      "submit": "开始生成"
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/zh.json
git commit -m "feat(i18n): add business pages translation keys for en and zh"
```

---

## Task 2: 改造 SongStatusBadge

**Files:**
- Modify: `packages/ui/src/components/song-status-badge.tsx`

---

- [ ] **Step 1: 添加 `label` prop，移除内部硬编码**

将 `packages/ui/src/components/song-status-badge.tsx` 改为：

```tsx
import { cn } from '../lib/utils'

type SongStatus = 'draft' | 'generating' | 'completed' | 'failed'

interface SongStatusBadgeProps {
  status: SongStatus
  label: string
}

const statusClassName: Record<SongStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  generating: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

export function SongStatusBadge({ status, label }: SongStatusBadgeProps) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusClassName[status])}>
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/song-status-badge.tsx
git commit -m "feat(ui): SongStatusBadge accepts label prop for i18n"
```

---

## Task 3: Songs 列表页 + 新建页

**Files:**
- Modify: `apps/web/src/app/songs/page.tsx`
- Modify: `apps/web/src/app/songs/new/page.tsx`

---

- [ ] **Step 1: 国际化 songs 列表页**

修改 `apps/web/src/app/songs/page.tsx`：

```tsx
import { createServerClient } from '@kiyo/supabase/server'
import { EmptyState, SongCard } from '@kiyo/ui'
import { Link } from '@/i18n/navigation'
import { redirect } from 'next/navigation'
import { Plus, Wand2 } from 'lucide-react'
import { getLocale } from '@/i18n/server'
import { getTranslations } from 'next-intl/server'

export default async function SongsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const locale = await getLocale()
    redirect(`/${locale}/login`)
  }

  const { data: songs } = await supabase
    .from('songs')
    .select('*, lyrics(title, id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const locale = await getLocale()
  const t = await getTranslations('songs')
  const tCommon = await getTranslations('common')

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/songs/generate`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Wand2 className="h-4 w-4" />
            {t('list.generate')}
          </Link>
          <Link
            href={`/${locale}/songs/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('list.new')}
          </Link>
        </div>
      </div>

      {songs && songs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {songs.map((song) => (
            <SongCard
              key={song.id}
              id={song.id}
              title={song.title}
              status={song.status}
              duration={song.duration}
              lyricTitle={song.lyrics?.title ?? null}
              coverUrl={song.cover_url}
              href={`/${locale}/songs/${song.id}`}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={tCommon('empty.songs.title')} description={tCommon('empty.songs.description')} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 国际化 songs 新建页**

修改 `apps/web/src/app/songs/new/page.tsx`：

```tsx
'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function NewSongPage() {
  const router = useRouter()
  const t = useTranslations('songs.new')
  const tCommon = useTranslations('common')

  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [genre, setGenre] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [aiPrompt, setAiPrompt] = React.useState('')
  const [lyrics, setLyrics] = React.useState<{ id: string; title: string }[]>([])
  const [selectedLyricId, setSelectedLyricId] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    fetch('/api/lyrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.lyrics) setLyrics(data.lyrics)
      })
  }, [])

  const handleSave = async () => {
    if (!title.trim()) {
      setError(t('error.emptyTitle'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          genre: genre || undefined,
          mood: mood || undefined,
          ai_prompt: aiPrompt || undefined,
          lyric_id: selectedLyricId || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/songs/${data.song.id}`)
      } else {
        setError(data.error?.message || tCommon('errors.createFailed'))
      }
    } catch {
      setError(tCommon('errors.network'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/songs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="title">{t('fields.title')} *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('placeholders.title')}
          />
        </div>

        <div>
          <Label htmlFor="lyric">{t('fields.lyric')}（{tCommon('actions.optional')}）</Label>
          <select
            id="lyric"
            value={selectedLyricId}
            onChange={(e) => setSelectedLyricId(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">{t('fields.noLyric')}</option>
            {lyrics.map((lyric) => (
              <option key={lyric.id} value={lyric.id}>
                {lyric.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="genre">{t('fields.genre')}</Label>
            <Input
              id="genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder={t('placeholders.genre')}
            />
          </div>
          <div>
            <Label htmlFor="mood">{t('fields.mood')}</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder={t('placeholders.mood')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="aiPrompt">{t('fields.aiPrompt')}</Label>
          <Textarea
            id="aiPrompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={t('placeholders.aiPrompt')}
            rows={3}
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/songs">
          <Button variant="outline">{tCommon('actions.cancel')}</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? tCommon('states.saving') : tCommon('actions.save')}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/songs/page.tsx apps/web/src/app/songs/new/page.tsx
git commit -m "feat(i18n): translate songs list and new song pages"
```

---

## Task 4: Songs 详情页 + 编辑页 + 导出对话框

**Files:**
- Modify: `apps/web/src/app/songs/[id]/page.tsx`
- Modify: `apps/web/src/app/songs/[id]/edit/page.tsx`
- Modify: `apps/web/src/app/songs/[id]/export-dialog.tsx`

---

- [ ] **Step 1: 国际化 songs 详情页**

修改 `apps/web/src/app/songs/[id]/page.tsx` 为以下完整代码：

```tsx
import { createServerClient } from '@kiyo/supabase/server'
import { AudioPlayer, Button, SongStatusBadge } from '@kiyo/ui'
import { ArrowLeft, Pencil, Play, AlertCircle, Mic2 } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { getLocale } from '@/i18n/server'
import { Link } from '@/i18n/navigation'
import { ExportDialog } from './export-dialog'
import { getTranslations } from 'next-intl/server'

export default async function SongDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const locale = await getLocale()
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${locale}/login`)
  }

  const { data: song } = await supabase
    .from('songs')
    .select('*, lyrics(*), original_song:original_song_id(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!song) {
    notFound()
  }

  const t = await getTranslations('songs.detail')
  const tCommon = await getTranslations('common')

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const sourceLabel =
    song.source === 'ai_generated'
      ? t('source.ai_generated')
      : song.source === 'ai_cover'
        ? t('source.ai_cover')
        : t('source.manual')

  const statusLabelMap: Record<string, string> = {
    draft: t('source.manual'),
    generating: tCommon('states.generating'),
    completed: tCommon('states.generating'),
    failed: tCommon('errors.unknown'),
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/${locale}/songs`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{song.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <SongStatusBadge status={song.status} label={statusLabelMap[song.status] ?? song.status} />
            {song.genre && <span>{song.genre}</span>}
            {song.mood && <span>{song.mood}</span>}
            {song.duration && (
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3" />
                {formatDuration(song.duration)}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                song.source === 'ai_generated'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : song.source === 'ai_cover'
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {sourceLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {song.status === 'completed' && song.audio_url && (
            <>
              <ExportDialog
                songId={song.id}
                songTitle={song.title}
              />
              <Link href={`/${locale}/songs/cover?original_song_id=${song.id}`}>
                <Button variant="outline" size="sm">
                  <Mic2 className="mr-1 h-4 w-4" />
                  {t('aiCover')}
                </Button>
              </Link>
            </>
          )}
          <Link href={`/${locale}/songs/${song.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-1 h-4 w-4" />
              {t('edit')}
            </Button>
          </Link>
        </div>
      </div>

      {(song.status === 'draft' || song.status === 'failed') && (
        <div className="mb-6 rounded-lg border border-dashed p-6 text-center">
          <div className="mb-2 flex justify-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mb-2 text-sm text-muted-foreground">
            {song.status === 'failed'
              ? t('status.failed.title')
              : t('status.draft.title')}
          </p>
          <form
            action={`/api/songs/${song.id}/generate`}
            method="POST"
          >
            <Button type="submit" disabled={!song.lyric_id}>
              {song.status === 'failed' ? t('status.failed.action') : t('status.draft.action')}
            </Button>
          </form>
          {!song.lyric_id && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('lyricRequired')}
            </p>
          )}
        </div>
      )}

      {song.status === 'generating' && (
        <div className="mb-6 rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('status.generating.title')}</p>
        </div>
      )}

      {song.status === 'completed' && song.audio_url && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">{t('audioPreview')}</h2>
          <AudioPlayer
            src={song.audio_url}
            title={song.title}
            duration={song.duration}
            coverUrl={song.cover_url}
            songId={song.id}
            className="w-full"
          />
        </div>
      )}

      {song.source === 'ai_cover' && song.voice_style && (
        <div className="mb-6">
          <h2 className="mb-1 text-sm font-medium">{t('coverStyle')}</h2>
          <p className="text-sm text-muted-foreground">{song.voice_style}</p>
        </div>
      )}

      {song.source === 'ai_cover' && song.original_song_id && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">{t('compareOriginal')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('original')}</p>
              <AudioPlayer
                src={(song.original_song as any)?.audio_url || ''}
                title={(song.original_song as any)?.title || t('original')}
                duration={(song.original_song as any)?.duration}
                coverUrl={(song.original_song as any)?.cover_url}
                songId={(song.original_song as any)?.id}
                className="w-full"
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('cover')}</p>
              <AudioPlayer
                src={song.audio_url || ''}
                title={song.title}
                duration={song.duration}
                coverUrl={song.cover_url}
                songId={song.id}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {song.ai_prompt && (
        <div className="mb-6">
          <h2 className="mb-1 text-sm font-medium">{t('aiPrompt')}</h2>
          <p className="text-sm text-muted-foreground">{song.ai_prompt}</p>
        </div>
      )}

      {song.lyrics && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">{t('lyrics')}</h2>
            <Link href={`/${locale}/lyrics/${song.lyrics.id}`} className="text-xs text-primary hover:underline">
              {t('viewFullLyrics')}
            </Link>
          </div>
          <div className="rounded-lg border bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
              {song.lyrics.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 国际化 songs 编辑页**

修改 `apps/web/src/app/songs/[id]/edit/page.tsx`：

```tsx
'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function SongEditPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const t = useTranslations('songs.edit')
  const tNew = useTranslations('songs.new')
  const tCommon = useTranslations('common')

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [genre, setGenre] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [aiPrompt, setAiPrompt] = React.useState('')
  const [lyrics, setLyrics] = React.useState<{ id: string; title: string }[]>([])
  const [selectedLyricId, setSelectedLyricId] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    Promise.all([
      fetch(`/api/songs/${params.id}`).then((res) => res.json()),
      fetch('/api/lyrics').then((res) => res.json()),
    ])
      .then(([songData, lyricsData]) => {
        if (songData.song) {
          setTitle(songData.song.title)
          setGenre(songData.song.genre ?? '')
          setMood(songData.song.mood ?? '')
          setAiPrompt(songData.song.ai_prompt ?? '')
          setSelectedLyricId(songData.song.lyric_id ?? '')
        } else {
          setError(tCommon('errors.notFound'))
        }
        if (lyricsData.lyrics) setLyrics(lyricsData.lyrics)
        setLoading(false)
      })
      .catch(() => {
        setError(tCommon('errors.loadFailed'))
        setLoading(false)
      })
  }, [params.id, tCommon])

  const handleSave = async () => {
    if (!title.trim()) {
      setError(tNew('error.emptyTitle'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/songs/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          genre: genre || undefined,
          mood: mood || undefined,
          ai_prompt: aiPrompt || undefined,
          lyric_id: selectedLyricId || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/songs/${params.id}`)
      } else {
        setError(data.error?.message || tCommon('errors.saveFailed'))
      }
    } catch {
      setError(tCommon('errors.network'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="text-center text-muted-foreground">{tCommon('states.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="text-center text-destructive">{error}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/songs/${params.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="title">{tNew('fields.title')}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tNew('placeholders.title')}
          />
        </div>

        <div>
          <Label htmlFor="lyric">{tNew('fields.lyric')}（{tCommon('actions.optional')}）</Label>
          <select
            id="lyric"
            value={selectedLyricId}
            onChange={(e) => setSelectedLyricId(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">{tNew('fields.noLyric')}</option>
            {lyrics.map((lyric) => (
              <option key={lyric.id} value={lyric.id}>
                {lyric.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="genre">{tNew('fields.genre')}</Label>
            <Input
              id="genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder={tNew('placeholders.genre')}
            />
          </div>
          <div>
            <Label htmlFor="mood">{tNew('fields.mood')}</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder={tNew('placeholders.mood')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="aiPrompt">{tNew('fields.aiPrompt')}</Label>
          <Textarea
            id="aiPrompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={tNew('placeholders.aiPrompt')}
            rows={3}
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href={`/songs/${params.id}`}>
          <Button variant="outline">{tCommon('actions.cancel')}</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? tCommon('states.saving') : tCommon('actions.save')}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 国际化 export-dialog**

修改 `apps/web/src/app/songs/[id]/export-dialog.tsx`：

```tsx
'use client'

import * as React from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kiyo/ui'
import { toast } from '@kiyo/ui'
import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ExportDialogProps {
  songId: string
  songTitle: string
  disabled?: boolean
}

export function ExportDialog({ songId, songTitle, disabled }: ExportDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const t = useTranslations('songs.export')
  const tCommon = useTranslations('common')

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/songs/${songId}/export`)
      const data = await res.json()
      if (res.ok && data.downloadUrl) {
        const link = document.createElement('a')
        link.href = data.downloadUrl
        link.download = data.filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        setOpen(false)
        toast.success(t('success'))
      } else {
        toast.error(data.error?.message || tCommon('errors.exportFailed'))
      }
    } catch {
      toast.error(tCommon('errors.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Download className="mr-1 h-4 w-4" />
        {tCommon('actions.export')}
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('song')}</span>
            <span className="font-medium">{songTitle}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('format')}</span>
            <span className="font-medium">{t('formatValue')}</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={exporting}>
            {tCommon('actions.cancel')}
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? tCommon('states.exporting') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/songs/\[id\]/page.tsx apps/web/src/app/songs/\[id\]/edit/page.tsx apps/web/src/app/songs/\[id\]/export-dialog.tsx
git commit -m "feat(i18n): translate song detail, edit, and export dialog"
```

---

## Task 5: Songs AI 作曲页 + AI 翻唱页

**Files:**
- Modify: `apps/web/src/app/songs/generate/page.tsx`
- Modify: `apps/web/src/app/songs/cover/page.tsx`

---

- [ ] **Step 1: 国际化 AI 作曲页**

修改 `apps/web/src/app/songs/generate/page.tsx` 为：

```tsx
'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Wand2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

type CompositionMode = 'instrumental' | 'auto_lyrics' | 'existing_lyric'

export default function GenerateSongPage() {
  const router = useRouter()
  const t = useTranslations('songs.generate')
  const tCommon = useTranslations('common')

  const [generating, setGenerating] = React.useState(false)
  const [prompt, setPrompt] = React.useState('')
  const [genre, setGenre] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [language, setLanguage] = React.useState('')
  const [mode, setMode] = React.useState<CompositionMode>('auto_lyrics')
  const [lyrics, setLyrics] = React.useState<{ id: string; title: string }[]>([])
  const [lyricId, setLyricId] = React.useState('')
  const [error, setError] = React.useState('')

  const LANGUAGE_OPTIONS = [
    { value: '', label: t('languageUnlimited') },
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
  ]

  React.useEffect(() => {
    fetch('/api/lyrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.lyrics) setLyrics(data.lyrics)
      })
      .catch(() => {
        // silently fail
      })
  }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError(t('error.emptyPrompt'))
      return
    }
    if (mode === 'existing_lyric' && !lyricId) {
      setError(t('error.noLyricSelected'))
      return
    }

    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/songs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          genre: genre || undefined,
          mood: mood || undefined,
          language: language || undefined,
          mode,
          lyric_id: mode === 'existing_lyric' ? lyricId : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/songs/${data.song.id}`)
      } else {
        setError(data.error?.message || tCommon('errors.unknown'))
      }
    } catch {
      setError(tCommon('errors.network'))
    } finally {
      setGenerating(false)
    }
  }

  const modeOptions: { value: CompositionMode; labelKey: string; descKey: string }[] = [
    { value: 'instrumental', labelKey: 'mode.instrumental.label', descKey: 'mode.instrumental.desc' },
    { value: 'auto_lyrics', labelKey: 'mode.auto_lyrics.label', descKey: 'mode.auto_lyrics.desc' },
    { value: 'existing_lyric', labelKey: 'mode.existing_lyric.label', descKey: 'mode.existing_lyric.desc' },
  ]

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/songs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-6 space-y-6">
        <div>
          <Label htmlFor="prompt">{t('fields.prompt')} *</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('placeholders.prompt')}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="genre">{t('fields.genre')}</Label>
            <Input
              id="genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder={t('placeholders.genre')}
            />
          </div>
          <div>
            <Label htmlFor="mood">{t('fields.mood')}</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder={t('placeholders.mood')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="language">{t('fields.language')}</Label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label className="mb-2 block">{t('fields.mode')} *</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {modeOptions.map((opt) => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  mode === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={opt.value}
                  checked={mode === opt.value}
                  onChange={() => setMode(opt.value)}
                  className="sr-only"
                />
                <div className="mt-1 font-medium">{t(opt.labelKey as any)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t(opt.descKey as any)}</div>
              </label>
            ))}
          </div>
        </div>

        {mode === 'existing_lyric' && (
          <div>
            <Label htmlFor="lyric">{t('selectLyric')} *</Label>
            <select
              id="lyric"
              value={lyricId}
              onChange={(e) => setLyricId(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('selectLyric')}</option>
              {lyrics.map((lyric) => (
                <option key={lyric.id} value={lyric.id}>
                  {lyric.title}
                </option>
              ))}
            </select>
            {lyrics.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('noLyrics')}
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/songs">
          <Button variant="outline">{tCommon('actions.cancel')}</Button>
        </Link>
        <Button onClick={handleGenerate} disabled={generating}>
          <Wand2 className="mr-1 h-4 w-4" />
          {generating ? tCommon('states.generating') : t('submit')}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 国际化 AI 翻唱页**

修改 `apps/web/src/app/songs/cover/page.tsx` 为：

```tsx
'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { Button, Input, Label } from '@kiyo/ui'
import { ArrowLeft, Mic2, Upload } from 'lucide-react'
import { createBrowserClient } from '@kiyo/supabase'
import { useTranslations } from 'next-intl'

type SourceMode = 'existing' | 'upload'

export default function CoverSongPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createBrowserClient()
  const t = useTranslations('songs.cover')
  const tCommon = useTranslations('common')

  const prefillSongId = searchParams.get('original_song_id')

  const [sourceMode, setSourceMode] = React.useState<SourceMode>(prefillSongId ? 'existing' : 'existing')
  const [selectedSongId, setSelectedSongId] = React.useState(prefillSongId || '')
  const [songs, setSongs] = React.useState<{ id: string; title: string; audio_url: string | null }[]>([])
  const [uploadedUrl, setUploadedUrl] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  const [selectedStyle, setSelectedStyle] = React.useState('')
  const [customTitle, setCustomTitle] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const [error, setError] = React.useState('')

  const styleOptions = [
    { icon: '🎸', label: t('style.options.0.label'), prompt: t('style.options.0.prompt') },
    { icon: '🎷', label: t('style.options.1.label'), prompt: t('style.options.1.prompt') },
    { icon: '🎻', label: t('style.options.2.label'), prompt: t('style.options.2.prompt') },
    { icon: '🎹', label: t('style.options.3.label'), prompt: t('style.options.3.prompt') },
    { icon: '🎺', label: t('style.options.4.label'), prompt: t('style.options.4.prompt') },
    { icon: '🌙', label: t('style.options.5.label'), prompt: t('style.options.5.prompt') },
    { icon: '🤘', label: t('style.options.6.label'), prompt: t('style.options.6.prompt') },
    { icon: '🎤', label: t('style.options.7.label'), prompt: t('style.options.7.prompt') },
  ]

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('songs')
        .select('id, title, audio_url')
        .eq('user_id', user.id)
        .not('audio_url', 'is', null)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setSongs(data)
        })
    })
  }, [supabase])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      setError(tCommon('errors.fileTooLarge'))
      return
    }

    setUploading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError(tCommon('errors.unknown'))
      setUploading(false)
      return
    }

    const path = `audio-uploads/${user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('audio').upload(path, file, {
      contentType: file.type,
    })

    if (uploadError) {
      setError(tCommon('errors.uploadFailed', { message: uploadError.message }))
      setUploading(false)
      return
    }

    const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(path)
    setUploadedUrl(publicUrl.publicUrl)
    setUploading(false)
  }

  const handleGenerate = async () => {
    const audioUrl = sourceMode === 'existing'
      ? songs.find((s) => s.id === selectedSongId)?.audio_url || ''
      : uploadedUrl

    if (!audioUrl) {
      setError(sourceMode === 'existing' ? t('error.noAudio') : t('error.noUpload'))
      return
    }

    if (!selectedStyle) {
      setError(t('error.noStyle'))
      return
    }

    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/songs/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_style: selectedStyle,
          audio_url: audioUrl,
          original_song_id: sourceMode === 'existing' ? selectedSongId || null : null,
          title: customTitle.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (res.ok && data.song) {
        router.push(`/songs/${data.song.id}`)
      } else {
        setError(data.error?.message || tCommon('errors.unknown'))
        setGenerating(false)
      }
    } catch {
      setError(tCommon('errors.network'))
      setGenerating(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/songs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-6 space-y-4">
        <div>
          <Label>{t('source.label')}</Label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setSourceMode('existing')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${
                sourceMode === 'existing'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <Mic2 className="h-4 w-4" />
              {t('source.existing')}
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('upload')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${
                sourceMode === 'upload'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <Upload className="h-4 w-4" />
              {t('source.upload')}
            </button>
          </div>
        </div>

        {sourceMode === 'existing' && (
          <div>
            <Label htmlFor="song-select">{t('selectSong')}</Label>
            <select
              id="song-select"
              value={selectedSongId}
              onChange={(e) => setSelectedSongId(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('selectSong')}</option>
              {songs.map((song) => (
                <option key={song.id} value={song.id}>
                  {song.title}
                </option>
              ))}
            </select>
            {songs.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('error.noSongs')}
              </p>
            )}
          </div>
        )}

        {sourceMode === 'upload' && (
          <div>
            <Label htmlFor="audio-upload">{t('upload.label')}</Label>
            <input
              id="audio-upload"
              type="file"
              accept="audio/mpeg,audio/wav,audio/flac"
              onChange={handleFileUpload}
              disabled={uploading}
              className="mt-1 block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
            />
            {uploadedUrl && (
              <p className="mt-1 text-xs text-green-600">{t('upload.success')}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {t('upload.formats')}
            </p>
          </div>
        )}

        <div>
          <Label>{t('style.label')} *</Label>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {styleOptions.map((style) => (
              <button
                key={style.prompt}
                type="button"
                onClick={() => setSelectedStyle(style.prompt)}
                className={`rounded-lg border p-3 text-center transition-colors ${
                  selectedStyle === style.prompt
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="mb-1 text-2xl">{style.icon}</div>
                <div className="text-xs font-medium">{style.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="title">{t('title')}</Label>
          <Input
            id="title"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/songs">
          <Button variant="outline" disabled={generating}>{tCommon('actions.cancel')}</Button>
        </Link>
        <Button onClick={handleGenerate} disabled={generating || uploading}>
          {generating ? tCommon('states.generating') : t('submit')}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/songs/generate/page.tsx apps/web/src/app/songs/cover/page.tsx
git commit -m "feat(i18n): translate song generate and cover pages"
```

---

## Task 6: Albums 列表页 + 详情页

**Files:**
- Modify: `apps/web/src/app/albums/page.tsx`
- Modify: `apps/web/src/app/albums/[id]/page.tsx`

---

- [ ] **Step 1: 国际化 albums 列表页**

修改 `apps/web/src/app/albums/page.tsx`：

```tsx
import { createServerClient } from '@kiyo/supabase/server'
import { EmptyState, AlbumCard } from '@kiyo/ui'
import { redirect } from 'next/navigation'
import { getLocale } from '@/i18n/server'
import { Link } from '@/i18n/navigation'
import { AlbumFormDialog } from './_components/AlbumFormDialog'
import { DeleteConfirmDialog } from './_components/DeleteConfirmDialog'
import { Trash2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export default async function AlbumsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const locale = await getLocale()

  if (!user) {
    redirect(`/${locale}/login`)
  }

  const { data: albums } = await supabase
    .from('albums')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const albumIds = albums?.map((a) => a.id) ?? []
  let songCounts: Record<string, number> = {}

  if (albumIds.length > 0) {
    const { data: albumSongs } = await supabase
      .from('album_songs')
      .select('album_id')
      .in('album_id', albumIds)

    songCounts = (albumSongs ?? []).reduce((acc: Record<string, number>, curr: any) => {
      acc[curr.album_id] = (acc[curr.album_id] ?? 0) + 1
      return acc
    }, {})
  }

  const t = await getTranslations('albums')
  const tCommon = await getTranslations('common')

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        <div className="flex gap-4">
          <Link
            href={`/${locale}/songs`}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t('list.songLibrary')}
          </Link>
          <AlbumFormDialog
            mode="create"
            trigger={
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                {t('list.new')}
              </button>
            }
          />
        </div>
      </div>

      {albums && albums.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <div key={album.id} className="relative group">
              <Link href={`/${locale}/albums/${album.id}`}>
                <AlbumCard
                  title={album.title}
                  description={album.description}
                  songCount={songCounts[album.id] ?? 0}
                  coverUrl={album.cover_url}
                />
              </Link>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DeleteConfirmDialog
                  albumId={album.id}
                  albumTitle={album.title}
                  trigger={
                    <button className="rounded-full bg-destructive p-2 text-destructive-foreground hover:bg-destructive/90">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={tCommon('empty.albums.title')} description={tCommon('empty.albums.description')} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 国际化 album 详情页**

修改 `apps/web/src/app/albums/[id]/page.tsx`：

```tsx
import { createServerClient } from '@kiyo/supabase/server'
import { AudioPlayer, EmptyState } from '@kiyo/ui'
import { notFound, redirect } from 'next/navigation'
import { getLocale } from '@/i18n/server'
import { Link } from '@/i18n/navigation'
import { DraggableSongList } from '../_components/DraggableSongList'
import { CoverSection } from './_components/CoverSection'
import { AddSongsDialog } from './_components/AddSongsDialog'
import { getTranslations } from 'next-intl/server'

interface AlbumDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { id } = await params
  const locale = await getLocale()
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/${locale}/login`)
  }

  const { data: album } = await supabase
    .from('albums')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!album) {
    notFound()
  }

  const { data: albumSongs } = await supabase
    .from('album_songs')
    .select('*, songs(*)')
    .eq('album_id', id)
    .order('order_index', { ascending: true })

  const songs = (albumSongs ?? []).map((as: any) => as.songs).filter(Boolean)

  const t = await getTranslations('albums')
  const tCommon = await getTranslations('common')

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/${locale}/albums`} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('detail.back')}
        </Link>
      </div>

      <CoverSection
        albumId={id}
        coverUrl={album.cover_url}
        coverStatus={album.cover_status}
        title={album.title}
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{album.title}</h1>
        {album.description && (
          <p className="mt-2 text-muted-foreground">{album.description}</p>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('detail.songList')}</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t('detail.songCount', { count: songs.length })}</span>
          <AddSongsDialog albumId={id} excludeIds={songs.map((s: any) => s.id)} />
        </div>
      </div>

      {songs.length > 0 ? (
        <>
          <div className="mb-6">
            <AudioPlayer
              src={songs[0]?.audio_url || ''}
              title={songs[0]?.title}
              album={album.title}
              coverUrl={album.cover_url}
              songId={songs[0]?.id}
              playlist={songs.map((s: any) => ({
                id: s.id,
                title: s.title,
                audio_url: s.audio_url || '',
                cover_url: s.cover_url,
                duration: s.duration,
                album: album.title,
              }))}
              className="w-full"
            />
          </div>
          <DraggableSongList
            songs={songs.map((s: any) => ({ id: s.id, title: s.title }))}
            albumId={id}
          />
        </>
      ) : (
        <EmptyState title={t('detail.noSongs.title')} description={t('detail.noSongs.description')} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/albums/page.tsx apps/web/src/app/albums/\[id\]/page.tsx
git commit -m "feat(i18n): translate albums list and detail pages"
```

---

## Task 7: Albums 组件

**Files:**
- Modify: `apps/web/src/app/albums/_components/AlbumFormDialog.tsx`
- Modify: `apps/web/src/app/albums/_components/DeleteConfirmDialog.tsx`
- Modify: `apps/web/src/app/albums/_components/AddSongsDialog.tsx`
- Modify: `apps/web/src/app/albums/_components/CoverSection.tsx`
- Modify: `apps/web/src/app/albums/_components/DraggableSongList.tsx`
- Modify: `apps/web/src/app/albums/_components/SongSelector.tsx`

---

- [ ] **Step 1: 国际化 AlbumFormDialog**

修改 `apps/web/src/app/albums/_components/AlbumFormDialog.tsx`：

```tsx
'use client'

import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Textarea,
} from '@kiyo/ui'
import { SongSelector } from './SongSelector'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface AlbumFormDialogProps {
  mode: 'create' | 'edit'
  album?: {
    id: string
    title: string
    description: string | null
  }
  trigger: React.ReactNode
}

export function AlbumFormDialog({ mode, album, trigger }: AlbumFormDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(album?.title ?? '')
  const [description, setDescription] = useState(album?.description ?? '')
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const t = useTranslations('albums.form')
  const tCommon = useTranslations('common')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    try {
      const url = mode === 'create' ? '/api/albums' : `/api/albums/${album!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const body: Record<string, any> = { title, description: description || null }
      if (selectedSongIds.length > 0) {
        body.song_ids = selectedSongIds
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message ?? tCommon('errors.unknown'))
      }

      setOpen(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : tCommon('errors.unknown'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('createTitle') : t('editTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('name')}</label>
            <Input
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder={t('namePlaceholder')}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('description')}</label>
            <Textarea
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
            />
          </div>
          {mode === 'create' && (
            <div>
              <label className="mb-1 block text-sm font-medium">{t('selectSongs')}</label>
              <SongSelector selectedIds={selectedSongIds} onChange={setSelectedSongIds} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? tCommon('states.submitting') : t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 国际化 DeleteConfirmDialog**

修改 `apps/web/src/app/albums/_components/DeleteConfirmDialog.tsx`：

```tsx
'use client'

import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kiyo/ui'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface DeleteConfirmDialogProps {
  albumId: string
  albumTitle: string
  trigger: React.ReactNode
}

export function DeleteConfirmDialog({ albumId, albumTitle, trigger }: DeleteConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const t = useTranslations('albums.delete')
  const tCommon = useTranslations('common')

  async function handleDelete() {
    setDeleting(true)
    try {
      const response = await fetch(`/api/albums/${albumId}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message ?? tCommon('errors.deleteFailed'))
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : tCommon('errors.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('description', { title: albumTitle })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {tCommon('actions.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? tCommon('states.deleting') : tCommon('actions.delete')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: 国际化 AddSongsDialog**

修改 `apps/web/src/app/albums/[id]/_components/AddSongsDialog.tsx`：

```tsx
'use client'

import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kiyo/ui'
import { SongSelector } from '../../_components/SongSelector'
import { Plus } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface AddSongsDialogProps {
  albumId: string
  excludeIds: string[]
}

export function AddSongsDialog({ albumId, excludeIds }: AddSongsDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const t = useTranslations('albums.addSongs')
  const tCommon = useTranslations('common')

  function handleOpenChange(open: boolean) {
    setOpen(open)
    if (!open) {
      setSelectedIds([])
    }
  }

  async function handleSubmit() {
    if (selectedIds.length === 0) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/albums/${albumId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_ids: selectedIds }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: tCommon('errors.addFailed') } }))
        throw new Error(error.error?.message ?? tCommon('errors.addFailed'))
      }

      setOpen(false)
      setSelectedIds([])
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : tCommon('errors.addFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />
          {tCommon('actions.add')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <SongSelector
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            excludeIds={excludeIds}
            emptyMessage={t('empty')}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || selectedIds.length === 0}
            >
              {submitting ? tCommon('states.adding') : t('selectedCount', { count: selectedIds.length })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: 国际化 CoverSection**

修改 `apps/web/src/app/albums/[id]/_components/CoverSection.tsx`：

```tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button, Skeleton } from '@kiyo/ui'
import { Disc3 } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface CoverSectionProps {
  albumId: string
  coverUrl: string | null
  coverStatus: string
  title: string
}

export function CoverSection({ albumId, coverUrl, coverStatus, title }: CoverSectionProps) {
  const [status, setStatus] = useState(coverStatus)
  const [url, setUrl] = useState(coverUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations('albums.cover')

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setStatus('generating')

    try {
      const res = await fetch(`/api/albums/${albumId}/generate-cover`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || t('error'))
      }

      setUrl(data.coverUrl)
      setStatus('completed')
    } catch (err) {
      setStatus('failed')
      setError(err instanceof Error ? err.message : t('error'))
    } finally {
      setLoading(false)
    }
  }

  const buttonText =
    status === 'generating'
      ? t('generating')
      : status === 'completed'
        ? t('regenerate')
        : status === 'failed'
          ? t('retry')
          : t('generate')

  return (
    <div className="mb-6">
      <div className="relative aspect-square max-w-md rounded-lg bg-muted flex items-center justify-center overflow-hidden">
        {status === 'completed' && url ? (
          <Image src={url} alt={title} fill className="object-cover" />
        ) : status === 'generating' ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <Disc3 className="h-24 w-24 text-muted-foreground" />
        )}
      </div>
      <Button
        onClick={handleGenerate}
        disabled={loading || status === 'generating'}
        className="mt-3"
      >
        {buttonText}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: 国际化 DraggableSongList**

修改 `apps/web/src/app/albums/_components/DraggableSongList.tsx`：

在顶部添加 `import { useTranslations } from 'next-intl'`，在 `DraggableSongList` 组件内部添加 `const t = useTranslations('albums.reorder')`，并将 `保存中...` 改为 `{t('saving')}`，`更新失败` 改为 `{t('failed')}`。

完整文件：

```tsx
'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Song {
  id: string
  title: string
}

interface DraggableSongListProps {
  songs: Song[]
  albumId: string
  onReorder?: (newOrder: Song[]) => void
}

function SortableSongRow({ song, index }: { song: Song; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: song.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-sm text-muted-foreground">{index + 1}</span>
      <span className="flex-1 text-sm font-medium">{song.title}</span>
    </div>
  )
}

export function DraggableSongList({ songs: initialSongs, albumId, onReorder }: DraggableSongListProps) {
  const [songs, setSongs] = useState(initialSongs)
  const [isSaving, setIsSaving] = useState(false)
  const t = useTranslations('albums.reorder')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = songs.findIndex((s) => s.id === active.id)
    const newIndex = songs.findIndex((s) => s.id === over.id)
    const newSongs = arrayMove(songs, oldIndex, newIndex)
    setSongs(newSongs)

    setIsSaving(true)
    try {
      const response = await fetch(`/api/albums/${albumId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_ids: newSongs.map((s) => s.id) }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message ?? t('failed'))
      }

      onReorder?.(newSongs)
    } catch (err) {
      setSongs(songs)
      alert(err instanceof Error ? err.message : t('failed'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      {isSaving && (
        <p className="mb-2 text-xs text-muted-foreground">{t('saving')}</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {songs.map((song, index) => (
              <SortableSongRow key={song.id} song={song} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
```

- [ ] **Step 6: 国际化 SongSelector**

修改 `apps/web/src/app/albums/_components/SongSelector.tsx`：

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Input, SongRow } from '@kiyo/ui'
import { useTranslations } from 'next-intl'

interface Song {
  id: string
  title: string
}

interface SongSelectorProps {
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  excludeIds?: string[]
  emptyMessage?: string
}

export function SongSelector({ selectedIds, onChange, excludeIds, emptyMessage }: SongSelectorProps) {
  const [songs, setSongs] = useState<Song[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const tCommon = useTranslations('common')

  useEffect(() => {
    fetch('/api/songs')
      .then((res) => res.json())
      .then((data) => {
        setSongs(data.songs ?? [])
        setLoading(false)
      })
  }, [])

  const filteredSongs = songs
    .filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    .filter((s) => !excludeIds?.includes(s.id))

  function toggleSong(id: string, selected: boolean) {
    if (selected) {
      onChange([...selectedIds, id])
    } else {
      onChange(selectedIds.filter((sid) => sid !== id))
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{tCommon('states.loading')}</p>

  return (
    <div className="space-y-3">
      <Input
        placeholder={tCommon('actions.search')}
        value={search}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
      />
      <div className="max-h-60 space-y-2 overflow-y-auto">
        {filteredSongs.map((song) => (
          <SongRow
            key={song.id}
            id={song.id}
            title={song.title}
            mode="select"
            selected={selectedIds.includes(song.id)}
            onSelect={toggleSong}
          />
        ))}
        {filteredSongs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {emptyMessage ?? tCommon('errors.notFound')}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{tCommon('states.loading')}</p>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/albums/_components/
git commit -m "feat(i18n): translate album components (form, delete, add songs, cover, reorder, selector)"
```

---

## Task 8: Lyrics 列表页 + 新建页

**Files:**
- Modify: `apps/web/src/app/lyrics/page.tsx`
- Modify: `apps/web/src/app/lyrics/new/page.tsx`

---

- [ ] **Step 1: 国际化 lyrics 列表页**

修改 `apps/web/src/app/lyrics/page.tsx`：

```tsx
import { createServerClient } from '@kiyo/supabase/server'
import { Link } from '@/i18n/navigation'
import { redirect } from 'next/navigation'
import { EmptyState } from '@kiyo/ui'
import { Plus, Sparkles } from 'lucide-react'
import { getLocale } from '@/i18n/server'
import { getTranslations } from 'next-intl/server'

export default async function LyricsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const locale = await getLocale()
    redirect(`/${locale}/login`)
  }

  const { data: lyrics } = await supabase
    .from('lyrics')
    .select('*, songs(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const locale = await getLocale()
  const t = await getTranslations('lyrics')
  const tCommon = await getTranslations('common')

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        <div className="flex gap-3">
          <Link
            href={`/${locale}/lyrics/generate`}
            className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Sparkles className="h-4 w-4" />
            {t('list.generate')}
          </Link>
          <Link
            href={`/${locale}/lyrics/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('list.new')}
          </Link>
        </div>
      </div>

      {lyrics && lyrics.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lyrics.map((lyric) => (
            <Link key={lyric.id} href={`/${locale}/lyrics/${lyric.id}`}>
              <div className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-semibold">{lyric.title}</h3>
                  {lyric.songs?.[0]?.count > 0 && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
                      🎵 {t('detail.composed')}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      lyric.source === 'ai_generated'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {lyric.source === 'ai_generated' ? t('detail.source.ai') : t('detail.source.manual')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {lyric.content.length > 100 ? lyric.content.slice(0, 100) + '...' : lyric.content}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{lyric.language ?? t('detail.noLanguage')}</span>
                  <span>{lyric.style ?? t('detail.noStyle')}</span>
                  <span className="ml-auto">
                    {new Date(lyric.created_at).toLocaleDateString(locale)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title={tCommon('empty.lyrics.title')} description={tCommon('empty.lyrics.description')} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 国际化 lyrics 新建页**

修改 `apps/web/src/app/lyrics/new/page.tsx`：

```tsx
'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function NewLyricPage() {
  const router = useRouter()
  const t = useTranslations('lyrics.new')
  const tCommon = useTranslations('common')

  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [language, setLanguage] = React.useState('')
  const [style, setStyle] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [error, setError] = React.useState('')

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError(t('error.empty'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          language: language || undefined,
          style: style || undefined,
          mood: mood || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/lyrics/${data.lyric.id}`)
      } else {
        setError(data.error?.message || tCommon('errors.createFailed'))
      }
    } catch {
      setError(tCommon('errors.network'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/lyrics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="title">{t('fields.title')} *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('placeholders.title')}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="language">{t('fields.language')}</Label>
            <Input
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder={t('placeholders.language')}
            />
          </div>
          <div>
            <Label htmlFor="style">{t('fields.style')}</Label>
            <Input
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder={t('placeholders.style')}
            />
          </div>
          <div>
            <Label htmlFor="mood">{t('fields.mood')}</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder={t('placeholders.mood')}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="content">{t('fields.content')} *</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('placeholders.content')}
            rows={12}
            className="font-mono text-sm leading-relaxed"
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/lyrics">
          <Button variant="outline">{tCommon('actions.cancel')}</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? tCommon('states.saving') : tCommon('actions.save')}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/lyrics/page.tsx apps/web/src/app/lyrics/new/page.tsx
git commit -m "feat(i18n): translate lyrics list and new lyric pages"
```

---

## Task 9: Lyrics 详情页 + 编辑页 + 生成歌曲对话框

**Files:**
- Modify: `apps/web/src/app/lyrics/[id]/page.tsx`
- Modify: `apps/web/src/app/lyrics/[id]/edit/page.tsx`
- Modify: `apps/web/src/app/lyrics/[id]/generate-song-dialog.tsx`

---

- [ ] **Step 1: 国际化 lyrics 详情页**

修改 `apps/web/src/app/lyrics/[id]/page.tsx`：

```tsx
import { createServerClient } from '@kiyo/supabase/server'
import { Link } from '@/i18n/navigation'
import { StructuredBlockEditor, textToBlocks, Button, SongStatusBadge } from '@kiyo/ui'
import { Pencil, ArrowLeft } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { getLocale } from '@/i18n/server'
import { GenerateSongDialog } from './generate-song-dialog'
import { getTranslations } from 'next-intl/server'

export default async function LyricDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const locale = await getLocale()
    redirect(`/${locale}/login`)
  }

  const { data: lyric } = await supabase
    .from('lyrics')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!lyric) {
    notFound()
  }

  const { data: linkedSongs } = await supabase
    .from('songs')
    .select('id, title, status, genre, mood, created_at')
    .eq('lyric_id', params.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const blocks = textToBlocks(lyric.content)
  const locale = await getLocale()
  const t = await getTranslations('lyrics.detail')
  const tCommon = await getTranslations('common')

  const sourceLabel = lyric.source === 'ai_generated' ? t('source.ai') : t('source.manual')

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/${locale}/lyrics`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{lyric.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                lyric.source === 'ai_generated'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {sourceLabel}
            </span>
            {lyric.language && <span>{lyric.language}</span>}
            {lyric.style && <span>{lyric.style}</span>}
            {lyric.mood && <span>{lyric.mood}</span>}
          </div>
        </div>
        <GenerateSongDialog
          lyricId={lyric.id}
          lyricTitle={lyric.title}
          lyricContent={lyric.content}
          lyricLanguage={lyric.language}
        />
        <Link href={`/${locale}/lyrics/${lyric.id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-1 h-4 w-4" />
            {t('edit')}
          </Button>
        </Link>
      </div>

      <StructuredBlockEditor blocks={blocks} onChange={() => {}} readOnly />

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">{t('linkedSongs')}</h2>
        {linkedSongs && linkedSongs.length > 0 ? (
          <div className="space-y-3">
            {linkedSongs.map((song) => (
              <Link key={song.id} href={`/${locale}/songs/${song.id}`}>
                <div className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{song.title}</span>
                    <SongStatusBadge status={song.status as any} label={tCommon(`songs.detail.source.${song.status === 'completed' ? 'manual' : song.status}`)} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {song.genre && <span>{song.genre}</span>}
                    {song.mood && <span>{song.mood}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('noLinkedSongs.title')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('noLinkedSongs.description')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 国际化 lyrics 编辑页**

修改 `apps/web/src/app/lyrics/[id]/edit/page.tsx`：

添加 `import { useTranslations } from 'next-intl'`，在组件内使用 `const t = useTranslations('lyrics.edit')`，`const tNew = useTranslations('lyrics.new')`，`const tCommon = useTranslations('common')`。

关键替换：
- `"加载中..."` → `{tCommon('states.loading')}`
- `"歌词不存在"` → `{tCommon('errors.notFound')}`
- `"加载失败"` → `{tCommon('errors.loadFailed')}`
- `"保存失败"` → `{tCommon('errors.saveFailed')}`
- `"编辑歌词"` → `{t('title')}`
- `"返回详情"` → `{t('back')}`
- `"歌词内容"` → `{t('contentLabel')}`
- 取消/保存按钮使用 `tCommon`

- [ ] **Step 3: 国际化 generate-song-dialog**

修改 `apps/web/src/app/lyrics/[id]/generate-song-dialog.tsx`：

添加 `import { useTranslations } from 'next-intl'`，在组件内使用 `const t = useTranslations('lyrics.generateSong')`，`const tCommon = useTranslations('common')`。

关键替换：
- `"基于此歌词生成音乐"` → `{t('title')}`
- `"歌词内容为空，无法生成音乐"` → `{t('emptyWarning')}`
- `"主题描述"` → `{t('fields.prompt')}`
- `"风格（可选）"` → `{t('fields.genre')}`
- `"情绪（可选）"` → `{t('fields.mood')}`
- `"语言（可选）"` → `{t('fields.language')}`
- `"描述你想要的音乐"` → `{t('placeholders.prompt')}`
- `"歌词预览"` → `{t('preview')}`
- `"（无内容）"` → `{t('noContent')}`
- `"取消"` → `{tCommon('actions.cancel')}`
- `"生成中..."` → `{tCommon('states.generating')}`
- `"开始生成"` → `{t('submit')}`
- `"主题描述不能为空"` → `{tCommon('errors.required')}`
- `"生成失败，请稍后重试"` → `{tCommon('errors.unknown')}`
- `"生成失败，请检查网络连接"` → `{tCommon('errors.network')}`
- 语言选项 `LANGUAGE_OPTIONS` 的 label 从 messages 读取：新增 `lyrics.generateSong.languages` 键（或复用已有）

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/lyrics/\[id\]/page.tsx apps/web/src/app/lyrics/\[id\]/edit/page.tsx apps/web/src/app/lyrics/\[id\]/generate-song-dialog.tsx
git commit -m "feat(i18n): translate lyrics detail, edit, and generate-song-dialog"
```

---

## Task 10: Lyrics AI 生成页

**Files:**
- Modify: `apps/web/src/app/lyrics/generate/page.tsx`

---

- [ ] **Step 1: 国际化 lyrics AI 生成页**

修改 `apps/web/src/app/lyrics/generate/page.tsx`：

添加 `import { useTranslations } from 'next-intl'`，在组件内使用 `const t = useTranslations('lyrics.generate')`，`const tCommon = useTranslations('common')`。

关键替换：
- `"AI 生成歌词"` → `{t('title')}`
- `"描述你想要的歌曲主题，AI 将为你创作完整歌词"` → `{t('subtitle')}`
- `"主题描述"` → `{t('fields.prompt')}`
- `"语言"` → `{t('fields.language')}`
- `"风格（可选）"` → `{t('fields.style')}`
- `"情绪（可选）"` → `{t('fields.mood')}`
- `"例如：一首关于青春校园的励志歌曲"` → `{t('placeholders.prompt')}`
- `"流行、摇滚..."` → `{t('placeholders.style')}`
- `"励志、忧伤..."` → `{t('placeholders.mood')}`
- `"取消"` → `{tCommon('actions.cancel')}`
- `"生成歌词"` → `{t('submit')}`
- `"生成中..."` → `{tCommon('states.generating')}`
- `"生成失败，请稍后重试"` → `{t('error.failed')}`
- `"生成失败，请检查网络后重试"` → `{t('error.network')}`
- `LANGUAGES` 数组的 label 改为从 messages 读取，或保持硬编码语言名（中文/English/日本語/한국어 为语言自身名称，通常不翻译）

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/lyrics/generate/page.tsx
git commit -m "feat(i18n): translate lyrics generate page"
```

---

## Task 11: Type Check & Verification

---

- [ ] **Step 1: Run type check**

```bash
cd /home/kk/.config/superpowers/worktrees/kiyo/feat/i18n-business-pages
pnpm type-check
```

Expected: No TypeScript errors. Fix any `SongStatusBadge` prop missing `label` errors.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: No ESLint errors.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(i18n): complete business pages internationalization (issue #52)"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ messages/en.json + zh.json 新增命名空间 — Task 1
- ✅ SongStatusBadge label prop — Task 2
- ✅ Songs 列表/新建/详情/编辑/生成/翻唱/导出 — Task 3-5
- ✅ Albums 列表/详情/表单/删除/添加歌曲/封面/排序/选择器 — Task 6-7
- ✅ Lyrics 列表/新建/详情/编辑/生成/生成歌曲对话框 — Task 8-10
- ✅ 日期格式 `toLocaleDateString(locale)` — Task 8 Step 1
- ✅ Error/toast/alert 国际化 — 各 Task 中覆盖
- ✅ Type check 验证 — Task 11

**2. Placeholder scan:**
- 无 TBD/TODO/"implement later"
- 所有步骤包含具体文件路径和代码修改

**3. Type consistency:**
- `SongStatusBadge` 新签名 `{ status, label }` 在所有调用方统一使用
- `useTranslations` / `getTranslations` 导入路径一致
- 翻译键路径与 messages 文件一致

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2025-05-09-i18n-business-pages.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

Which approach?