# Issue 138：新建专辑弹窗状态混乱与 Dialog 可访问性修复

## 背景

未登录状态进入 `/albums` 后点击「新建专辑」，弹窗歌曲选择区域同时出现「未找到」和「加载中...」，且控制台报出 `Missing Description or aria-describedby` 的 Dialog 警告。

根因：
1. `SongSelector.tsx` 底部硬编码了 `<p>{tCommon('states.loading')}</p>`，与搜索空结果文案同时渲染。
2. `fetch('/api/songs')` 没有错误处理，未登录返回 401 后被当成空数据处理。
3. `AlbumFormDialog.tsx` 的 `DialogHeader` 只有 `DialogTitle`，缺少 `DialogDescription`。

## 目标

- 让歌曲选择区域的 `loading`、`error`、`empty`、`success` 四个状态互斥展示。
- 未登录导致的歌曲列表请求失败给出明确的「请先登录」引导。
- `DialogContent` 补齐描述，消除可访问性警告。

## 方案选择

选择**方案 2：提取共享 Hook**。

理由：
- 将歌曲列表的数据获取逻辑从 UI 组件中抽离，使 `SongSelector` 只负责渲染和交互。
- 与项目中已有的 `use-notifications.ts` Hook 风格一致。
- 即使当前只有一处消费，也为未来其他组件复用歌曲列表数据预留了接口。
- 相较方案 1（最小化修改）增加了合理抽象，相较方案 3（服务端增强）避免了不该由服务端承担的判断职责。

## 改动范围

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web/src/hooks/use-songs.ts` | 新建 | 提取歌曲列表获取逻辑 |
| `apps/web/src/app/[locale]/albums/_components/SongSelector.tsx` | 修改 | 消费 Hook，实现互斥状态渲染 |
| `apps/web/src/app/[locale]/albums/_components/AlbumFormDialog.tsx` | 修改 | 添加 `DialogDescription` |
| `apps/web/messages/zh.json` | 修改 | 新增 `albums.form.dialogDescription`、`common.actions.login`、`common.errors.loginRequired` |
| `apps/web/messages/en.json` | 修改 | 英文翻译同上 |

## 详细设计

### 1. `use-songs.ts`

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'

interface Song {
  id: string
  title: string
}

interface UseSongsResult {
  songs: Song[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useSongs(): UseSongsResult {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSongs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/songs')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setSongs(data.songs ?? [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSongs()
  }, [fetchSongs])

  return { songs, loading, error, refetch: fetchSongs }
}
```

设计要点：
- 不接收 `userId` 参数，API 从 session 自行获取用户身份。
- `error` 透传原始 `Error`，消费方根据 `message` 判断错误类型。
- `refetch` 暴露给未来需要手动刷新的场景。

### 2. `SongSelector.tsx`

```tsx
'use client'

import { useState } from 'react'
import { Input, SongRow } from '@kiyo/ui'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useSongs } from '@/hooks/use-songs'

interface SongSelectorProps {
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  excludeIds?: string[]
}

export function SongSelector({ selectedIds, onChange, excludeIds }: SongSelectorProps) {
  const [search, setSearch] = useState('')
  const { songs, loading, error } = useSongs()
  const tCommon = useTranslations('common')

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

  if (loading) {
    return <p className="text-sm text-muted-foreground">{tCommon('states.loading')}</p>
  }

  if (error) {
    const isUnauthorized =
      error.message.includes('401') || error.message.includes('Authentication required')
    if (isUnauthorized) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{tCommon('errors.loginRequired')}</p>
          <Link href="/login" className="text-sm text-primary hover:underline">
            {tCommon('actions.login')}
          </Link>
        </div>
      )
    }
    return <p className="text-sm text-muted-foreground">{tCommon('errors.loadFailed')}</p>
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder={tCommon('actions.search')}
        value={search}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
      />
      <div className="max-h-60 space-y-2 overflow-y-auto">
        {filteredSongs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tCommon('errors.notFound')}</p>
        ) : (
          filteredSongs.map((song) => (
            <SongRow
              key={song.id}
              id={song.id}
              title={song.title}
              mode="select"
              selected={selectedIds.includes(song.id)}
              onSelect={toggleSong}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

关键改动：
- 删除 `emptyMessage` prop（不再需要）。
- 删除硬编码的底部 `<p>{tCommon('states.loading')}</p>`。
- 四个状态（`loading`、`error(unauthorized)`、`error(other)`、`success/empty`）完全互斥。
- 未登录错误通过 `error.message` 内容判断，不引入新的 HTTP 状态码依赖。

### 3. `AlbumFormDialog.tsx`

在 `DialogHeader` 中 `DialogTitle` 下方添加 `DialogDescription`：

```tsx
<DialogHeader>
  <DialogTitle>{mode === 'create' ? t('createTitle') : t('editTitle')}</DialogTitle>
  <DialogDescription>{t('dialogDescription')}</DialogDescription>
</DialogHeader>
```

同时确保导入 `DialogDescription`：
```tsx
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Textarea,
} from '@kiyo/ui'
```

### 4. 翻译文件新增键

**zh.json：**
```json
"albums": {
  "form": {
    "createTitle": "新建专辑",
    "editTitle": "编辑专辑",
    "name": "专辑名称",
    "namePlaceholder": "输入专辑名称",
    "description": "描述（可选）",
    "descriptionPlaceholder": "输入专辑描述",
    "selectSongs": "选择歌曲",
    "save": "保存",
    "dialogDescription": "填写专辑信息后保存"
  }
}
```

```json
"common": {
  "actions": {
    "login": "登录"
  },
  "errors": {
    "loginRequired": "请先登录以查看您的歌曲"
  }
}
```

**en.json（对应翻译）：**
```json
"dialogDescription": "Fill in the album information and save"
```
```json
"login": "Log in"
```
```json
"loginRequired": "Please log in to view your songs"
```

## 验收标准

- [ ] 弹窗打开时歌曲选择区域只展示一个明确状态（加载中 / 未登录提示 / 加载失败 / 歌曲列表）。
- [ ] 未登录时显示「请先登录以查看您的歌曲」文案，并提供登录链接。
- [ ] 空歌曲库时显示「未找到」文案。
- [ ] 请求失败时显示通用加载失败文案。
- [ ] 控制台不再出现 `Missing Description or aria-describedby` 警告。
- [ ] `zh.json` 和 `en.json` 的翻译键保持一致。

## 风险

- `error.message` 的字符串匹配（`includes('401')`、`includes('Authentication required')`）依赖 API 返回的具体文案。若服务端调整错误 message，匹配会失效。当前 API 返回格式稳定（`{ error: { code, message } }`），风险可控。
- `emptyMessage` prop 被删除，如果外部有其他组件传入此 prop，需要一并清理。经检查，当前只有 `AlbumFormDialog` 和 `AddSongsDialog` 使用 `SongSelector`，`AddSongsDialog` 未使用 `emptyMessage`。
