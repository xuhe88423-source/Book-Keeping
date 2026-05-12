# 库存与看板交互优化计划

## 1. 目标与背景

根据用户需求，需要对数据看板中的平台分布单据界面以及库存管理界面进行整体的 UI 尺寸和网格调整，同时引入“商品隐藏”功能以及“次日自动核销”的自动化状态流转机制。

## 2. 数据库变更 (需要用户手动执行)

需要在 Supabase 中为 `global_products` 表增加一个 `is_hidden` 字段。
**执行脚本 (`supabase-migration-v3.sql`)**:

```sql
ALTER TABLE global_products ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;
```

## 3. 具体修改步骤

### 3.1 次日自动核销机制

* **新建工具函数** **`src/lib/autoWriteOff.ts`**:
  编写一个自动化脚本，查找所有状态为 `sold_pending` (售出待使用) 的单据，并关联 `sales` 表查询其 `sold_at`。
  如果 `sold_at` 小于今天 (即“次日”或更早)，则自动将该单据的 status 更新为 `used` (核销)。

* **触发时机**:
  在 `Dashboard.tsx` 和 `Tickets.tsx` 组件挂载并获取数据 (`fetchDashboardData` / `fetchData`) 的前夕触发此函数，保证用户看到的数据永远是已自动核销过的最新状态。

### 3.2 商品隐藏功能

* **类型定义更新**: 在 `src/types/index.ts` 中为 `GlobalProduct` 增加 `is_hidden: boolean` 属性。

* **看板交互 (`Dashboard.tsx`)**:

  * 在商品概览卡片上，增加一个“隐藏/显示” (EyeOff / Eye) 切换按钮。

  * 当商品被设置为隐藏时，卡片整体增加灰色遮罩 (`grayscale opacity-60` 或 `bg-gray-100`)。

  * 点击按钮时，调用 Supabase API 更新 `global_products` 表的 `is_hidden` 状态。

* **库存过滤 (`Tickets.tsx`)**:

  * 在渲染商品 AccordionContent 时，过滤掉 `is_hidden === true` 的商品，使其无法在库存页展示，从而禁止为其新增价格单据。

### 3.3 单据卡片 UI 极简压缩

* **网格列数调整**:

  * `Dashboard.tsx` 的售出弹窗网格由 `grid-cols-4` 改为 `grid-cols-5`。

  * `Tickets.tsx` 的单据网格由 `grid-cols-4` 改为 `grid-cols-5`。

* **尺寸和字体压缩**:

  * 卡片高度由 `h-[52px]` 减半为 `h-[28px]`。

  * 价格文字字体调整为 `text-[10px]` 或 `text-[11px]`。

  * 左上角的序号字体缩小。

  * 右上角的待售/预约角标整体按比例缩小以适应狭窄的高度。

* **移除手动核销**:

  * `Dashboard.tsx` 中售出待使用单据不再渲染“核销”按钮。

  * 单据仅保持纯灰色状态 (`sold_pending` 样式)，等待次日自动核销。

## 4. 验收标准

1. 在 Supabase 成功增加 `is_hidden` 字段后，可以隐藏/显示看板中的商品。隐藏的商品不会在库存列表中出现。
2. 两个界面的单据卡片均显示为一行5个，且高度和字体明显变小。
3. 售出的单据没有核销按钮，且在第二天刷新页面时自动从“售出待使用”变为不可见的“已核销”状态。

