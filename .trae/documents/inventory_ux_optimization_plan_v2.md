# 库存管理单据列表 UX 优化计划

## 1. 目标与范围 (Summary)
将库存页面（`src/pages/Tickets.tsx`）中商品下方的单据列表，从现有的纵向列表形态，改造成与数据看板（Dashboard）一致的“一行4个”的微型网格卡片（高度52px）布局，提升界面的整洁度与空间利用率。
同时，适配网格布局下的交互：保持整体拖拽排序功能，将原来的直接平铺的“编辑/删除”按钮改为点击卡片后弹窗操作。

## 2. 现状分析 (Current State Analysis)
- 目前 `Tickets.tsx` 中的单据列表采用纵向排列的 `SortableTicketItem`。
- 每个条目占据一行，包含拖拽手柄、价格、状态徽章、编辑按钮和删除按钮。
- 采用的是 `@dnd-kit/sortable` 的 `verticalListSortingStrategy`（垂直列表排序策略）。
- 由于 Dashboard 已经实现了美观紧凑的 52px 高度卡片，可以复用该 UI 设计。

## 3. 具体修改方案 (Proposed Changes)

### 3.1 修改 `src/pages/Tickets.tsx` 布局与策略
- **变更排序策略**：将 `verticalListSortingStrategy` 替换为 `rectSortingStrategy`，以支持网格二维拖拽排序。
- **变更容器样式**：将单据列表的外层容器从 `<div className="flex flex-col gap-2">` 改为 `<div className="grid grid-cols-4 gap-2">`。

### 3.2 重写 `SortableTicketItem` 组件
- 移除原有的水平 Flex 布局，采用与 Dashboard 完全一致的卡片设计（52px 高度，圆角、状态角标在右上角，序号在左上角）。
- 取消显式的拖拽手柄，将 `attributes` 和 `listeners` 绑定到整个卡片上，使整个卡片可拖拽。
- 移除卡片内部的“编辑”和“删除”按钮图标。
- 添加 `onClick` 回调，用于触发弹窗。

### 3.3 增加点击操作弹窗 (Action Dialog)
- 引入新的状态 `const [selectedTicketAction, setSelectedTicketAction] = useState<Ticket | null>(null);`。
- 当用户点击网格卡片时，由于 `@dnd-kit` 的 `PointerSensor` 设置了 `activationConstraint: { distance: 5 }`，单纯的点击事件不会触发拖拽，可以正常执行 `onClick` 并弹出“单据操作”弹窗。
- 弹窗内展示单据的成本价，并提供两个明显的操作按钮：
  - **修改成本价**：点击后关闭当前操作弹窗，并打开现有的 `editTicketCost` 弹窗。
  - **删除单据**：点击后关闭当前操作弹窗，并打开现有的 `deleteConfirm` 弹窗。

## 4. 假设与决策 (Assumptions & Decisions)
- **无核销按钮**：根据之前设定的规则，“库存”页面不需要核销功能，因此新卡片中遇到 `sold_pending`（已售待使用）状态时，仅在右下角简单标记文字即可，无需添加核销按钮。
- **拖拽与点击兼容**：`@dnd-kit` 的传感器配置已经考虑了点击与拖拽的冲突（拖动距离大于 5px 才会判定为拖拽），因此将整个卡片设为可拖拽不会影响点击弹出操作栏的体验。

## 5. 验证步骤 (Verification steps)
1. 进入“库存”页面，展开任意包含单据的平台和商品。
2. 验证单据列表是否已变为一行4个的网格布局，样式是否与看板页面一致。
3. 尝试拖拽任意卡片改变其排序，验证网格二维排序是否正常工作并保存。
4. 单击任意卡片，验证是否能正常弹出操作弹窗。
5. 在弹窗中点击“修改成本价”和“删除单据”，验证现有的业务逻辑是否被正确触发。