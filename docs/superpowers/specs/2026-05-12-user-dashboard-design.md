# Dashboard Design

**Date**: 2026-05-12  
**Status**: Approved

## Overview

Create a unified Dashboard page (`/dashboard`) that provides users with a comprehensive overview of their creative works and quick access to common actions.

## Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  Stats Cards (2 rows × 3 columns = 6 cards)            │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐            │
│  │  Songs    │ │  Lyrics   │ │  Albums   │            │
│  │  total    │ │  total    │ │  total    │            │
│  │  completed│ │  composed │ │  songs    │            │
│  └───────────┘ └───────────┘ └───────────┘            │
│  ┌───────────┐                                         │
│  │ Generating│                                         │
│  │  count    │                                         │
│  └───────────┘                                         │
├─────────────────────────────────────────────────────────┤
│  Quick Actions                                          │
│  [+ New Song] [AI Compose] [AI Cover] [+ New Lyric]   │
│  [+ New Album]                                          │
├─────────────────────────────────────────────────────────┤
│  Recent Projects (Last 7 Days)                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│  │ Song    │ │ Lyric   │ │ Album   │                   │
│  └─────────┘ └─────────┘ └─────────┘                   │
└─────────────────────────────────────────────────────────┘
```

## Stats Cards Design

| Card | Icon | Primary Metric | Secondary Metric | Link |
|------|------|----------------|-------------------|------|
| Songs | 🎵 | Total count | Completed count | `/songs?status=completed` |
| Lyrics | 📝 | Total count | Composed count (linked to songs) | `/lyrics?composed=true` |
| Albums | 💿 | Total count | Total songs across all albums | `/albums` |
| Generating | ⏳ | Currently generating count | - | `/songs?status=generating` |

### Card Visual Design

- Rounded corners (rounded-xl)
- Subtle border (border-border)
- Background: bg-card
- Icon in colored circle on the left
- Primary number large (text-3xl font-bold)
- Secondary info below (text-sm text-muted-foreground)
- Hover: slight shadow lift, cursor pointer
- Click navigates to filtered list

## Quick Actions

Buttons layout: horizontal flex with gap

| Button | Icon | Color | Link |
|--------|------|-------|------|
| New Song | Plus | primary | `/songs/new` |
| AI Compose | Wand2 | purple-600 | `/songs/generate` |
| AI Cover | Mic2 | purple-600 | `/songs/cover` |
| New Lyric | Plus | primary | `/lyrics/new` |
| New Album | Plus | primary | `/albums/new` |

## Recent Projects Section

- Show items from last 7 days
- Mix of songs, lyrics, albums
- Use existing card components:
  - `SongCard` for songs
  - `LyricCard` (if exists, or create simple card) for lyrics
  - `AlbumCard` (if exists) for albums
- Maximum 6 items displayed
- "View All" link at bottom of each section

## Data Requirements

### API: GET /api/stats

Response:
```json
{
  "songs": {
    "total": 12,
    "completed": 8,
    "generating": 2,
    "failed": 1,
    "draft": 1
  },
  "lyrics": {
    "total": 8,
    "composed": 5,
    "uncomposed": 3
  },
  "albums": {
    "total": 3,
    "totalSongs": 15
  }
}
```

### API: GET /api/recent

Query params: `?days=7&limit=6`

Response:
```json
{
  "items": [
    { "type": "song", "id": "...", "title": "...", "createdAt": "...", "status": "completed" },
    { "type": "lyric", "id": "...", "title": "...", "createdAt": "..." },
    { "type": "album", "id": "...", "title": "...", "createdAt": "...", "songCount": 5 }
  ]
}
```

## Navigation Integration

### User Menu Dropdown (Desktop)

Add "Dashboard" link below "My Songs" in `user-menu.tsx`:

```
[User Avatar Dropdown]
├── user@email.com
├── ─────────────────
├── 🎨 Dashboard          ← NEW
├── 🎵 My Songs
├── 💿 My Albums
├── 📝 My Lyrics
├── ─────────────────
├── 💬 Feedback
├── ⚙️ Settings
└── 🚪 Logout
```

### Mobile Navigation (Mobile)

Add "Dashboard" link at top of navigation in `mobile-nav-sheet.tsx`:

```
[Mobile Nav Sheet]
├── 🎨 Dashboard          ← NEW
├── ─────────────────
├── 🧭 Explore
├── 🎵 Songs
├── 💿 Albums
├── 📝 Lyrics
├── ─────────────────
├── 🌐 Language [EN/中文]
└── 🌓 Theme
```

### Translation Keys

Add to `auth.userMenu`:
```json
{
  "dashboard": "Dashboard"
}
```

Add to `nav`:
```json
{
  "dashboard": "Dashboard"
}
```


## Implementation Plan

1. Create `/api/stats/route.ts` - fetch aggregated counts
2. Create `/api/recent/route.ts` - fetch recent items
3. Create `DashboardPage` component in `apps/web/src/app/[locale]/dashboard/page.tsx`
4. Add translations for dashboard section in en.json/zh.json
5. Update `user-menu.tsx` - add Dashboard link
6. Update `mobile-nav-sheet.tsx` - add Dashboard link

## Component Structure

```
DashboardPage (Server Component)
├── StatsGrid
│   ├── StatCard (Songs)
│   ├── StatCard (Lyrics)
│   ├── StatCard (Albums)
│   └── StatCard (Generating)
├── QuickActions
└── RecentSection
    └── RecentItemsList
```

## Translations

Add to `messages/en.json` and `messages/zh.json`:

```json
{
  "dashboard": {
    "title": "Dashboard",
    "stats": {
      "songs": { "label": "Songs", "completed": "{count} completed" },
      "lyrics": { "label": "Lyrics", "composed": "{count} composed" },
      "albums": { "label": "Albums", "totalSongs": "{count} songs" },
      "generating": { "label": "Generating", "description": "songs in progress" }
    },
    "quickActions": "Quick Actions",
    "recent": {
      "title": "Recent Projects",
      "viewAll": "View All",
      "empty": "No recent activity"
    }
  }
}
```

## Considerations

- Dashboard should be a separate page (not replacing existing list pages)
- Keep existing songs/lyrics/albums pages intact
- Consider adding dashboard link in header nav for logged-in users only
- Stats API should be efficient (single query with counts)
- Consider caching stats results for 30 seconds
