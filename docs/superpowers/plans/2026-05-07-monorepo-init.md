# Monorepo Workspace 初始化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建 Monorepo 基础配置文件，使 `pnpm install`、`pnpm dev`、`pnpm build` 可在根目录运行。

**Architecture:** 根目录配置 package.json + pnpm-workspace.yaml + turbo.json + .gitignore，无 workspace 子包时 Turbo 正常退出。

**Tech Stack:** pnpm 10.x, Turborepo 2.x, Node.js 18+

---

### 环境注记

本地检测到 pnpm `10.12.1`、Node.js `v24.13.0`。spec 原写 `pnpm@9.15.0`，建议直接使用本地已安装的 `10.12.1`，避免 corepack 重复下载旧版本。如业务方坚持 9.x，可回退。

---

### Task 1: 创建根目录 package.json

**Files:**
- Create: `/home/kk/Github/kiyo/package.json`

- [ ] **Step 1: 写入 package.json**

```json
{
  "name": "kiyo",
  "version": "0.0.0",
  "private": true,
  "description": "Kiyo — AI音乐创作平台",
  "packageManager": "pnpm@10.12.1",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.5.2"
  }
}
```

- [ ] **Step 2: 验证文件内容**

Run:
```bash
cat /home/kk/Github/kiyo/package.json | jq '.name, .packageManager, .scripts.dev'
```
Expected output:
```
"kiyo"
"pnpm@10.12.1"
"turbo run dev"
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add root package.json with turbo scripts

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: 创建 pnpm-workspace.yaml

**Files:**
- Create: `/home/kk/Github/kiyo/pnpm-workspace.yaml`

- [ ] **Step 1: 写入 pnpm-workspace.yaml**

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Step 2: 验证文件存在与内容**

Run:
```bash
cat /home/kk/Github/kiyo/pnpm-workspace.yaml
```
Expected:
```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Step 3: Commit**

```bash
git add pnpm-workspace.yaml
git commit -m "chore: add pnpm-workspace.yaml

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: 创建 turbo.json

**Files:**
- Create: `/home/kk/Github/kiyo/turbo.json`

- [ ] **Step 1: 写入 turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDotEnv": [".env"],
  "globalEnv": ["NODE_ENV"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "cache": true
    },
    "type-check": {
      "cache": true
    },
    "test": {
      "cache": true
    }
  }
}
```

- [ ] **Step 2: 验证 JSON 合法性与关键字段**

Run:
```bash
cat /home/kk/Github/kiyo/turbo.json | jq '.tasks.dev.persistent, .tasks.build.dependsOn[0]'
```
Expected:
```
true
"^build"
```

- [ ] **Step 3: Commit**

```bash
git add turbo.json
git commit -m "chore: add turbo.json with build dev lint type-check test pipelines

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: 创建 .gitignore

**Files:**
- Create: `/home/kk/Github/kiyo/.gitignore`

- [ ] **Step 1: 写入 .gitignore**

```gitignore
# Dependencies
node_modules
.pnp
.pnp.js

# Build outputs
.next
out
dist
.turbo

# Environment variables
.env
.env.local
.env.*.local

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Misc
*.pem
.cache
```

- [ ] **Step 2: 验证文件存在**

Run:
```bash
ls -la /home/kk/Github/kiyo/.gitignore && head -5 /home/kk/Github/kiyo/.gitignore
```
Expected 前5行:
```
# Dependencies
node_modules
.pnp
.pnp.js
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: add .gitignore for node next.js turbo ide os

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: 安装依赖并验证命令

**Files:**
- Modify: `/home/kk/Github/kiyo/package.json`（生成 pnpm-lock.yaml，不修改内容）

- [ ] **Step 1: 安装依赖**

Run:
```bash
cd /home/kk/Github/kiyo && pnpm install
```
Expected: 成功安装 `turbo`，生成 `pnpm-lock.yaml`，无报错。

- [ ] **Step 2: 验证 pnpm dev 可运行**

Run:
```bash
cd /home/kk/Github/kiyo && pnpm dev
```
Expected: Turbo 执行，因无 workspace 子包而快速退出或提示 `0 packages`。

- [ ] **Step 3: 验证 pnpm build 可运行**

Run:
```bash
cd /home/kk/Github/kiyo && pnpm build
```
Expected: 同上，无报错退出。

- [ ] **Step 4: Commit lock 文件**

```bash
git add pnpm-lock.yaml
git commit -m "chore: add pnpm-lock.yaml after initial install

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: 最终验证

- [ ] **Step 1: 列出所有新增/修改文件**

Run:
```bash
cd /home/kk/Github/kiyo && git diff --name-only HEAD~6..HEAD
```
Expected 包含:
```
package.json
pnpm-workspace.yaml
turbo.json
.gitignore
pnpm-lock.yaml
```

- [ ] **Step 2: 确认验收标准**

| 验收项 | 状态 |
|--------|------|
| 根目录 `pnpm install` 成功 | ✅ |
| `pnpm dev` 可在根目录运行 | ✅ |
| `pnpm build` 可在根目录运行 | ✅ |
| 配置文件已提交 git | ✅ |

---

## Self-Review Checklist

1. **Spec coverage:**
   - `package.json` 声明 packageManager ✅ Task 1
   - `pnpm-workspace.yaml` 定义 apps/* packages/* ✅ Task 2
   - `turbo.json` 配置 build/dev/lint/type-check/test ✅ Task 3
   - `.gitignore` ✅ Task 4
   - 验收标准（pnpm install / pnpm dev / pnpm build / git 提交）✅ Task 5-6

2. **Placeholder scan:** 无 TBD/TODO/"implement later"/"similar to Task N"。每步含完整代码或命令。

3. **Type consistency:** 无跨任务类型冲突。turbo.json 使用 Turborepo 2.x 的 `tasks` 键而非旧版 `pipeline`，与 `turbo@^2.5.2` 一致。
