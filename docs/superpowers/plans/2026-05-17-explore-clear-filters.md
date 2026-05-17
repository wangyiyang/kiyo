# 探索页清除筛选功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在探索页为 genre/mood 筛选添加单选移除标签和全部清除链接

**Architecture:** 纯 UI 改动，通过 URL 参数控制筛选状态。新增 × 按钮使用 Link + Button 阻止冒泡实现单选清除；条件渲染「全部清除」链接。

**Tech Stack:** Next.js Link, Tailwind CSS, @kiyo/ui Button 组件

---

## 改动文件

| 文件 | 改动 |
|------|------|
| `apps/web/src/app/[locale]/(site)/explore/page.tsx` | 新增单选移除标签 + 全部清除链接 |

---

## 实现步骤

- [ ] **Step 1: 修改 explore/page.tsx - 添加可移除标签和全部清除链接**

修改 `apps/web/src/app/[locale]/(site)/explore/page.tsx`：

1. 在 `buildUrl` 函数后添加新函数，用于生成「仅清除 genre」的 URL（保留 mood 和 query）和「仅清除 mood」的 URL（保留 genre 和 query）

2. 修改 Genre 筛选的选中项显示，将：
   ```tsx
   <Link
     key={g}
     href={buildUrl(g, mood)}
     className={cn(...)}
   >
     {g}
   </Link>
   ```
   改为：
   ```tsx
   <Link
     key={g}
     href={buildUrl(g, mood)}
     className={cn(
       "inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors",
       genre === g
         ? "bg-primary text-primary-foreground"
         : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
     )}
   >
     {g}
     {genre === g && (
       <button
         onClick={(e) => {
           e.preventDefault()
           e.stopPropagation()
           window.location.href = buildUrl(undefined, mood)
         }}
         className="ml-0.5 rounded-full p-0.5 hover:bg-primary-foreground/20"
         aria-label={`Remove ${g} filter`}
       >
         <X className="h-3 w-3" />
       </button>
     )}
   </Link>
   ```

3. 同样修改 Mood 筛选的选中项显示

4. 在 Mood 筛选下方添加「全部清除」链接（条件渲染 - 当有 genre 或 mood 选中时显示）：
   ```tsx
   {(genre || mood) && (
     <div className="mt-4 flex justify-end">
       <Link
         href="/explore"
         className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
       >
         {t("filters.clearAll")}
       </Link>
     </div>
   )}
   ```

5. 确保 `X` 从 lucide-react 已导入（如未导入则添加）

6. 确保 `t` 函数已可用，添加翻译 key `filters.clearAll`

- [ ] **Step 2: 添加翻译 key**

在 `apps/web/src/messages/zh.json` 和 `apps/web/src/messages/en.json` 的 `explore.filters` 下添加：

```json
"clearAll": "Clear all filters"
```

- [ ] **Step 3: 本地验证**

启动开发服务器 `pnpm --filter web dev`，访问 `/explore`，验证：
- 选中 genre/mood 后，右侧显示 × 按钮
- 点击 × 移除该筛选
- 点击「全部清除」回到无筛选状态
- 搜索词保留时清除筛选仍生效

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/app/\[locale\]/\(site\)/explore/page.tsx apps/web/src/messages/
git commit -m "feat(explore): add clear filter buttons for genre and mood"
```

---

## 验收清单

- [ ] 探索页有清除筛选入口
- [ ] 用户能快速回到全部内容
- [ ] 已选标签右侧有可点击的 × 关闭按钮
- [ ] 点击 × 移除单个筛选，保留其他筛选和搜索词
- [ ] 「全部清除」链接在有筛选时显示
- [ ] 点击「全部清除」回到无筛选状态