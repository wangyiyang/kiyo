# GitHub Actions CI 流水线设计

## 背景

Vercel 已集成 CI，负责构建和部署预览/生产环境。但 Vercel 只跑 `next build`，不执行类型检查、代码风格检查或测试。

Issue #62 要求建立 GitHub Actions CI 流水线，在 PR 和 merge 到 main 时自动跑质量门禁。

## 目标

- PR 和 push 到 main 时自动运行 type-check、lint、test
- 不重复 Vercel 已做的构建工作
- 公测阶段不纳入 e2e 测试和多 Node 矩阵
- 设置完成后可作为 required status check

## 非目标

- 不替代 Vercel 的构建和部署
- 公测阶段不跑 Playwright e2e 测试
- 不做多 Node 版本矩阵
- 不做自动发布/部署

## 触发条件

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]
```

## Job 编排

### setup

- checkout 代码
- 安装 pnpm（用 `pnpm/action-setup@v4`）
- 用 `actions/setup-node@v4` + `cache: pnpm` 缓存 pnpm store
- `pnpm install --frozen-lockfile`
- 用 `actions/upload-artifact` 打包 `node_modules` 和 `.turbo` 缓存目录

### type-check

`needs: setup`

- 下载 artifact 恢复依赖
- `pnpm type-check`

### lint

`needs: setup`

- 下载 artifact 恢复依赖
- `pnpm lint`

### test

`needs: setup`

- 下载 artifact 恢复依赖
- `pnpm test`

三个下游 job 互相不依赖，任意一个失败不影响其他两个运行，信息最大化。

## 缓存策略

- pnpm store：通过 `actions/setup-node` 的 `cache: pnpm` 自动管理
- node_modules artifact：key 基于 `pnpm-lock.yaml` hash，确保 lockfile 变化时重新 install
- Turbo local cache：`.turbo/cache` 包含在 artifact 中，下游 job 恢复后可直接复用

## 运行环境

- Node 版本：`20`（与 `.nvmrc` 一致）
- Runner：`ubuntu-latest`

## 失败策略

- 任一 job 失败 → workflow 失败
- 不设 retry：测试不稳定时应修测试，而非重试掩盖
- e2e 测试：公测阶段不纳入，后续迭代单独 workflow

## 验证计划

1. 创建 `.github/workflows/ci.yml`
2. 提交到 PR，观察 workflow 是否成功跑完 setup + 3 个 job
3. 确认 type-check、lint、test 结果与本地 `pnpm` 命令一致
4. 后续在仓库设置中将该 workflow 设为 required status check

## 依赖

- pnpm/action-setup@v4
- actions/setup-node@v4
- actions/cache@v4
- actions/upload-artifact@v4
- actions/download-artifact@v4
