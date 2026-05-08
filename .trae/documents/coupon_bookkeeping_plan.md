# 优惠券记账应用实施计划 - 三级库存结构改造

## 1. 摘要 (Summary)
根据需求，将原先扁平的票据库存逻辑重构为“平台 -> 商品类型 -> 优惠券”的三级结构。
用户可以在单页面内使用折叠面板（手风琴）进行层级操作：先创建平台，在平台下创建商品类型，在商品类型下添加不同价格和数量的优惠券。每个商品类型将统计其下所有优惠券的总数量。

## 2. 现状分析 (Current State Analysis)
- 当前数据库和代码基于单层 `tickets` 结构（包含 platform, name, cost_price, quantity）。
- 用户已同意**直接重建全新的表结构**，且在 UI 上采用**手风琴/折叠树形列表 (单页面展开)**。

## 3. 数据模型设计 (Data Schema - Supabase)

我们将提供新的 SQL 脚本，包含以下表结构（会先 DROP 掉旧表）：

**表 1：`platforms` (平台表)**
- `id`: UUID (主键)
- `name`: String (平台名称，如：淘宝)

**表 2：`product_types` (商品类型表)**
- `id`: UUID (主键)
- `platform_id`: UUID (外键，关联 platforms.id)
- `name`: String (商品名称，如：100元代金券)

**表 3：`tickets` (优惠券具体票据表)**
- `id`: UUID (主键)
- `product_type_id`: UUID (外键，关联 product_types.id)
- `cost_price`: Decimal (成本价)
- `quantity`: Integer (剩余数量)

**表 4：`sales` (销售记录表)**
- `id`: UUID (主键)
- `ticket_id`: UUID (外键，关联 tickets.id)
- `sell_price`: Decimal (单张卖出价)
- `quantity`: Integer (售出数量)
- `profit`: Decimal (总利润)
- `sold_at`: Date (售出日期)

## 4. 拟议变更与实施步骤 (Proposed Changes & Steps)

**步骤 1：更新数据库 SQL 脚本**
- 修改 `supabase-schema.sql`，添加 `DROP TABLE IF EXISTS sales, tickets, product_types, platforms CASCADE;`，并加入新的 4 张表的建表语句。

**步骤 2：更新前端类型定义**
- 修改 `src/types/index.ts`，新增 `Platform`, `ProductType`，并更新 `Ticket` 和 `Sale` 类型。

**步骤 3：安装并配置 Accordion 组件**
- 使用 shadcn CLI 安装 accordion 组件：`npx shadcn@latest add accordion -y`。

**步骤 4：重构库存页面 (`/tickets`)**
- 获取数据：一次性获取所有平台及其嵌套的商品类型和优惠券数据。
- 渲染 UI：
  - 最外层展示平台列表（Accordion）。
  - 平台内部展示商品类型列表（Accordion 或普通列表）。
  - 商品类型头部显示**总数量统计**（汇总该类型下所有 tickets 的 quantity）。
  - 商品类型内部展示不同成本价的优惠券列表。
- 表单操作：
  - “新增平台”弹窗。
  - “新增商品类型”弹窗（在特定平台下）。
  - “新增优惠券”弹窗（在特定商品类型下，输入成本价和数量）。
  - 优惠券级别的“售出”操作不变，但关联 ID 更新。

**步骤 5：更新销售明细页面 (`/sales`)**
- 修改 Supabase 查询语句，使用嵌套关联查询：`sales(*, tickets(*, product_types(*, platforms(*))))`。
- 修改 UI 展示，将原来的“平台/票据名称”替换为新的嵌套数据展示（如：`淘宝 - 100元代金券`）。

**步骤 6：确认数据看板页面 (`/`)**
- 检查 `Dashboard.tsx`，虽然 `tickets` 结构变化，但获取总库存价值和总数依然可以通过查询 `tickets` 表的 `quantity` 和 `cost_price` 实现，无需大改。

## 5. 假设与决策 (Assumptions & Decisions)
- **假设**：用户尚未录入大量真实数据，可以直接执行新的 SQL 脚本清空并重建表。
- **决策**：为了减少数据库请求次数，库存页面加载时将通过一次关联查询拉取所有嵌套数据结构：`platforms(*, product_types(*, tickets(*)))`。

## 6. 验证步骤 (Verification Steps)
1. 确认新的 SQL 脚本结构正确无误。
2. 运行应用，测试在“库存”页面创建平台 -> 创建商品类型 -> 创建具体优惠券的全流程。
3. 检查商品类型的“总数量”统计是否准确。
4. 测试售出功能，检查库存扣减和销售明细展示（平台和商品名称是否正常显示）。
5. 检查 Dashboard 看板的各项指标是否正常计算。