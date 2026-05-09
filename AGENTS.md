# Repository Guidelines

## Project Structure & Module Organization

Kiyo is a pnpm + Turborepo monorepo for an AI music creation platform. The main app is `apps/web`, a Next.js 14 app using React, TypeScript, Tailwind CSS, `next-intl`, and Supabase. Shared packages live in `packages/`: `@kiyo/ui` for reusable UI and player state, `@kiyo/ai` for AI service wrappers, and `@kiyo/supabase` for Supabase clients and generated database types. Database migrations belong in `supabase/migrations`; architecture and planning notes live in `docs/`.

## Build, Test, and Development Commands

Install dependencies with `pnpm install`. Use `pnpm dev` to start Turbo development tasks; for the web app only, run `pnpm --filter web dev`. Use `pnpm build` for production builds, `pnpm type-check` for TypeScript validation, `pnpm lint` for ESLint, and `pnpm test` for workspace tests. Supabase local workflows use `npx supabase start`, `npx supabase status`, `npx supabase db diff -f <name>`, and `npx supabase db reset`.

## Coding Style & Naming Conventions

Use TypeScript strict mode. Keep modules focused; split files, classes, or functions that approach 500 lines or mix unrelated responsibilities. Follow DRY, KISS, SOLID, and YAGNI. Feature components use PascalCase file names; shared shadcn-style primitives under `packages/ui/src/components/ui` use kebab-case. Use `@/` imports inside `apps/web/src` and workspace imports such as `@kiyo/ui` across packages. The project relies on ESLint, not a root Prettier config.

## Testing Guidelines

Vitest is used for unit and API route tests. Web tests match `apps/web/src/**/*.{test,spec}.{ts,tsx}` with jsdom and `src/test-setup.ts`; AI tests live in `packages/ai/src/__tests__`. Playwright end-to-end tests live in `apps/web/tests/e2e` and target `http://localhost:3000`. Name tests `*.test.ts(x)` or `*.spec.ts(x)`, place them near the code under test when practical, and run `pnpm test` or `pnpm --filter web test`.

## Commit & Pull Request Guidelines

Use Conventional Commit style seen in history, for example `feat(auth): add magic link login`, `fix(i18n): unify locale navigation`, or `chore(deploy): configure Vercel`. This repository follows GitHub Flow: branch from `main`, open a PR, and never commit directly to `main`. PRs should include purpose, change summary, risks, verification results, linked issues, and screenshots for UI changes.

## Security & Agent-Specific Instructions

Do not commit secrets. Copy `.env.local.example` for local setup and configure production or preview variables in the hosting provider. All schema changes must be migration files under `supabase/migrations`. Agent-facing communication, analysis, issue text, and PR descriptions should be written in Simplified Chinese unless an external template explicitly requires another language.
