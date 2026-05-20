# Kiyo Design System

## Brand
- **Name:** Kiyo
- **Tagline:** 让每一个人都能创造属于自己的声音
- **Positioning:** AI 音乐创作平台
- **Mood:** 科技动感、音乐创意、未来感

## Colors
| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#0D0D12` | 画布底色 |
| Foreground | `#FFFFFF` | 主文字 |
| Primary (Purple) | `#8B5CF6` | 品牌主色、强调 |
| Secondary (Cyan) | `#22D3EE` | 品牌辅色、高光 |
| Purple Glow | `rgba(139,92,246,0.22)` | 氛围光晕 |
| Cyan Glow | `rgba(34,211,238,0.18)` | 辅助光晕 |
| Muted | `rgba(255,255,255,0.55)` | 次要文字 |
| Surface | `rgba(255,255,255,0.06)` | 卡片/面板背景 |
| Surface Border | `rgba(139,92,246,0.25)` | 紫色边框 |

## Typography
- **Display/Headlines:** "Space Grotesk", weight 700-900, tracking -0.03em
- **Body/Subtitles:** "Space Grotesk", weight 400-500
- **Labels/Metadata:** "JetBrains Mono", weight 400, uppercase, tracking 0.08em
- **Video sizes:** Headlines 80-140px, subtitles 28-40px, labels 16-20px

## Motion
- **Energy:** High (音乐平台需动感)
- **Primary ease:** `power3.out` / `expo.out` for entrances
- **Transition primary:** Zoom through (0.35-0.4s)
- **Transition accent:** Blur crossfade (0.45s)
- **Ambient:** Subtle pulse/breathe on glows, waveform bars

## Do Not
- 避免纯平色背景（每层需有氛围元素）
- 避免所有元素同方向入场
- 避免 exit animation（最终场景除外）
- 避免使用 `repeat: -1`
