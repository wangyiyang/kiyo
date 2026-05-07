# Monorepo Workspace 初始化设计

## 背景

项目目前仅有文档文件（`README.md`、`CLAUDE.md`、`docs/`），缺乏 Monorepo 基础配置。本设计用于指导 GitHub Issue #1 的实现。

## 方案

采用**最小可用初始化**（方案 A）：

- 仅创建必需的 4 个配置文件
- Remote cache 暂不配置，后续补充
- 优先快速落地，不阻塞后续开发

## 配置清单

### 1. package.json（根目录）

- 声明 `"packageManager": "pnpm@9.15.0"`
- 定义 root scripts：`dev`、`build`、`lint`、`type-check`、`test`
- root 的 `private: true`，不发布到 registry

### 2. pnpm-workspace.yaml

```yaml
packages:
  - apps/*
  - packages/*
```

### 3. turbo.json

Pipeline 配置：

| 任务 | 说明 |
|------|------|
| `build` | 依赖 `^build`，输出 `.next`、`dist` |
| `dev` | `persistent: true`，缓存关闭 |
| `lint` | 独立运行，可缓存 |
| `type-check` | 独立运行，可缓存 |
| `test` | 独立运行，可缓存 |

### 4. .gitignore

覆盖以下场景：

- Node 依赖：`node_modules`、lock 文件（根目录除外策略暂不加）
- Next.js：`.next`、`out`
- Turborepo：`.turbo`
- 环境变量：`.env.local`、`.env.*.local`
- IDE：`.vscode`、`.idea`
- OS：`.DS_Store`

## 验收标准

- [ ] 根目录执行 `pnpm install` 成功
- [ ] `pnpm dev` / `pnpm build` 可在根目录运行（无 workspace 子包时 Turbo 应正常退出或提示）
- [ ] 配置文件提交到 git
