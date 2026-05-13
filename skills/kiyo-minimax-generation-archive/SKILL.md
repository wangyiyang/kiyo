---
name: kiyo-minimax-generation-archive
description: Use when working in the Kiyo repo to generate MiniMax demo lyrics, songs, and covers; burn remaining MiniMax quota; save outputs locally; organize deliverables into final and discarded folders; and document the run for handoff.
---

# Kiyo MiniMax Generation Archive

Use this skill when the user wants to generate or batch-generate Kiyo demo music assets with MiniMax, especially when the goal is to consume remaining quota quickly while keeping outputs organized and local-only.

## What this skill covers

- Generate lyrics
- Generate songs
- Generate covers
- Save everything under a date-based local folder
- Separate preserved deliverables from discarded drafts
- Update run documentation for handoff

## Default assumptions

- Work inside the Kiyo repo root.
- Do not upload generated assets unless the user explicitly asks.
- Prefer English prompts and English lyrics when the user asks for export-ready or later-stage demo material.
- Keep only the best or most representative sets in `final/`; move experiments, duplicates, weak drafts, and earlier iterations to `discarded/`.

## Output convention

Create a dated run folder:

```text
generated/minimax/YYYY-MM-DD/
```

Use this structure:

```text
generated/minimax/YYYY-MM-DD/
  README.md
  final/
    README.md
    batch-001/
      lyrics.txt
      song.mp3
      cover.png
      song.json            # optional
      audio_url.txt        # optional
  discarded/
    batch-000/
    api-experiments/
    earlier-drafts/
```

Rules:

- `final/` stores the preserved handoff sets.
- `discarded/` stores all non-primary material.
- Keep naming stable with `batch-<n>` or another simple sequential scheme.
- If a batch only contains partial output, keep it in `discarded/` unless the user says otherwise.

## Preferred generation paths

### 1. Song generation

Use the existing `mmx` flow first if it is available in the environment.

Typical intent:

- create a song from lyrics
- create an instrumental draft
- burn `music-2.6` quota quickly

The repo wrapper for MiniMax music lives at:

- `packages/ai/src/music.ts`

Important implementation detail:

- The project wrapper sends requests to `/v1/music_generation` with model `music-2.6`.
- It supports prompt, lyrics, genre, mood, instrumental mode, and lyrics optimizer.

### 2. Lyrics generation

For quota that specifically belongs to `lyrics_generation`, prefer the repo API wrapper instead of generic chat usage.

Use:

- `packages/ai/src/lyrics.ts`

Important implementation detail:

- This wrapper calls `/v1/lyrics_generation`.
- During the real quota-burn run, direct usage of this API path decremented `lyrics_generation` quota.
- A generic `mmx text chat --model lyrics_generation` style path did not reliably consume the dedicated lyrics quota and should not be the default choice when the goal is quota burn.

### 3. Cover generation

Use MiniMax image generation while quota remains.

Wrapper:

- `packages/ai/src/image.ts`

Important implementation detail:

- The default image model is `image-01`.
- If image quota is already exhausted, skip cover generation gracefully and continue burning music or lyrics quota.
- Image prompts must explicitly forbid any text, typography, logos, labels, subtitles, signatures, or watermarks in the rendered image.

## Practical workflow

### A. Check remaining quota

If `mmx` can show quota, inspect it first so you know which lane to burn:

- `music-2.6`
- `lyrics_generation`
- `image-01`

Prioritize the categories that still have meaningful headroom.

### B. Create a run folder

Example:

```text
generated/minimax/2026-05-12/
```

Create `final/` and `discarded/` immediately so later sorting is cheap.

### C. Generate in batches

A strong default loop is:

1. generate lyrics
2. generate song from those lyrics
3. generate cover for the same concept
4. save all assets into one batch folder
5. repeat quickly with varied prompts

When time is short, optimize for throughput:

- keep prompts compact and specific
- reuse a small number of strong style frames
- avoid manual over-curation during generation
- sort into `final/` and `discarded/` after a burst

## Prompting guidance for Kiyo

Follow the product’s likely use case: modern AI music demo content that feels presentable, emotionally clear, and easy to preview.

Good defaults:

- contemporary pop
- alt R&B
- indie electronic
- cinematic synth pop
- acoustic singer-songwriter

Useful prompt ingredients:

- strong hook
- clear chorus
- one emotional center
- vivid but not overwritten imagery
- performance-friendly phrasing
- for covers and generated images, describe the scene visually and keep all text out of the image itself

For English-only batches:

- keep all lyrics in English
- keep song prompts in English
- keep cover prompts in English
- avoid mixing Chinese placeholders into deliverable folders
- never ask the image model to render titles, captions, album names, or any other visible text

## Quality bar for `final/`

Move a batch into `final/` only when it is at least mostly complete and presentation-worthy:

- `lyrics.txt` reads coherently
- `song.mp3` matches the intended style reasonably well
- `cover.png` is usable as a local demo cover, if image quota was available

Send weaker items to `discarded/` if they have any of these issues:

- repetitive or flat lyrics
- music mismatch
- broken download or incomplete asset set
- duplicate concept
- older draft replaced by a stronger later version

## Documentation rules

Update the run-level README:

- `generated/minimax/YYYY-MM-DD/README.md`

Document:

- what the folder contains
- current `final/` batches
- what was moved to `discarded/`
- whether assets are local-only
- any quota or model notes that matter later

Also update:

- `generated/minimax/YYYY-MM-DD/final/README.md`

Document:

- preserved batch list
- expected files in each preserved set
- any optional metadata files

## Example repo-backed lyrics call

If you need to consume the dedicated lyrics API through the repo package, use a short script with the project runtime rather than inventing a parallel integration.

Minimal pattern:

```ts
import { generateLyrics } from '@kiyo/ai'

const result = await generateLyrics({
  prompt: 'Write a full English synth-pop song about ...',
})

console.log(result.text)
```

Run it with the repo toolchain, for example through `pnpm exec tsx`, so you stay inside project conventions.

## Example repo-backed song call

```ts
import { generateMusic } from '@kiyo/ai'

const result = await generateMusic({
  lyrics,
  prompt: 'English cinematic synth-pop with a wide chorus',
  genre: 'synth-pop',
  mood: 'uplifting',
})

console.log(result.audioUrl)
```

## Example repo-backed image call

```ts
import { generateImage } from '@kiyo/ai'

const result = await generateImage({
  prompt: 'Album cover, neon dusk skyline, reflective water, English synth-pop mood, no text, no logo, no watermark',
  width: 1024,
  height: 1024,
})

console.log(result.imageUrl)
```

## Sorting and cleanup checklist

After generation:

1. group outputs by batch
2. preserve the strongest sets in `final/`
3. move all non-primary material into `discarded/`
4. remove obvious junk only when safe; otherwise archive it in `discarded/`
5. update both README files

## Verification checklist

Before finishing, confirm:

- outputs are saved under the correct date folder
- `final/` only contains intended preserved sets
- `discarded/` contains drafts and non-primary artifacts
- README files reflect the current folder contents
- nothing was uploaded unless explicitly requested

## Real run notes from this repo

The workflow has already been used successfully in this repository with:

- preserved outputs under `generated/minimax/2026-05-12/final/`
- run notes in `generated/minimax/2026-05-12/README.md`
- final selection notes in `generated/minimax/2026-05-12/final/README.md`

Reuse those folders as the canonical reference for expected structure and quality level.
