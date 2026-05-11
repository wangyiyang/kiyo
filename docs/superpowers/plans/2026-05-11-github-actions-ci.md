# GitHub Actions CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `.github/workflows/ci.yml` with setup + 3 parallel jobs (type-check, lint, test), triggered on PR and push to main.

**Architecture:** A single workflow file with a `setup` job that installs dependencies and uploads an artifact, then three downstream jobs that download the artifact and run their respective Turbo tasks in parallel.

**Tech Stack:** GitHub Actions, pnpm, Turborepo

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/ci.yml` | Create | Main CI workflow: setup + type-check + lint + test |

---

### Task 1: Create `.github/workflows/ci.yml`

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/ci.yml` with the following content:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  setup:
    name: Setup
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Upload dependencies artifact
        uses: actions/upload-artifact@v4
        with:
          name: node-modules
          path: |
            node_modules
            */*/node_modules
            .turbo
          include-hidden-files: true
          retention-days: 1

  type-check:
    name: Type Check
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Download dependencies
        uses: actions/download-artifact@v4
        with:
          name: node-modules

      - name: Type check
        run: pnpm type-check

  lint:
    name: Lint
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Download dependencies
        uses: actions/download-artifact@v4
        with:
          name: node-modules

      - name: Lint
        run: pnpm lint

  test:
    name: Test
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Download dependencies
        uses: actions/download-artifact@v4
        with:
          name: node-modules

      - name: Test
        run: pnpm test
```

- [ ] **Step 2: Verify YAML syntax**

Run:
```bash
npx actionlint .github/workflows/ci.yml
```

If `actionlint` is not available, skip this step.

- [ ] **Step 3: Commit the workflow file**

```bash
git add .github/workflows/ci.yml
git commit -m "feat(ci): add GitHub Actions CI workflow for #62

- Setup job installs dependencies and uploads artifact
- Parallel jobs for type-check, lint, and test
- Triggered on PR and push to main
- Concurrency group to cancel stale runs"
```

---

### Task 2: Verify in GitHub

**Files:**
- None (GitHub web UI)

- [ ] **Step 1: Push and open PR**

If not already on a feature branch, create one:
```bash
git checkout -b feat/github-actions-ci
```

Push:
```bash
git push -u origin feat/github-actions-ci
```

Open a PR to `main` via GitHub web or `gh`:
```bash
gh pr create --title "feat(ci): add GitHub Actions CI workflow" --body "Closes #62"
```

- [ ] **Step 2: Check workflow execution**

In the PR on GitHub, verify:
1. The "CI" workflow appears in the checks section
2. `Setup` job completes successfully
3. `Type Check`, `Lint`, and `Test` jobs all run in parallel after setup
4. All jobs pass (green)

If any job fails, check the logs and fix issues (e.g., missing environment variables, flaky tests).

- [ ] **Step 3: Merge the PR**

After all checks pass:
```bash
gh pr merge --squash
```

Or merge via GitHub UI.

---

## Spec Coverage Check

| Spec Requirement | Plan Task |
|------------------|-----------|
| 触发条件：PR + push 到 main | Task 1, Step 1 (`on:` 块) |
| setup job 安装依赖并上传 artifact | Task 1, Step 1 (`setup` job) |
| 3 个并行 job：type-check / lint / test | Task 1, Step 1 (3 downstream jobs) |
| 使用 Node 20 | Task 1, Step 1 (`node-version: 20`) |
| pnpm store 缓存 | Task 1, Step 1 (`cache: pnpm`) |
| 不跑 build（Vercel 负责） | Task 1, Step 1（无 build step） |
| 不跑 e2e（公测阶段） | Task 1, Step 1（无 e2e step） |
| 单 Node 版本（不做矩阵） | Task 1, Step 1（无 strategy matrix） |
| concurrency 取消 stale run | Task 1, Step 1 (`concurrency` 块) |

## Placeholder Scan

- No "TBD", "TODO", or "implement later"
- All steps contain exact code or exact commands
- No vague descriptions like "add appropriate error handling"
- No "similar to Task N" references

## Type Consistency

- Job names consistent: `setup`, `type-check`, `lint`, `test`
- Artifact name `node-modules` consistent across upload/download
- Node version `20` consistent across all jobs
- pnpm version `9` consistent across all jobs
