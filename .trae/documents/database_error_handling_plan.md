# 全局数据库断开连接错误处理计划

## 1. 现状分析
当前应用对于 Supabase 数据库请求失败（例如由于免费层数据库进入 Paused 休眠状态）的处理方式比较零散：
- 在修改数据（增加、删除、售出）时，通常会通过 `toast.error` 弹出一条小提示。
- 在页面初始加载数据（如 `Dashboard.tsx` 的 `fetchDashboardData`）时，如果发生网络错误或数据库休眠，错误仅仅打印在 `console.error` 中，页面会静默失败，处于“无数据”或“一直加载”的白屏状态。
- **痛点**：对于非技术用户，静默失败或一闪而过的 toast 提示不足以解释“数据库已休眠”的复杂情况。用户会误以为是应用本身的 Bug 或网络不通。

## 2. 需求目标
- 开发一个**全局错误处理机制**，能够拦截数据库访问失败的情况。
- 当检测到数据库连接失败或请求超时，弹出一个**全局居中的对话框 (Dialog)**。
- 弹窗内容需要明确告知用户：**当前网页访问正常，但数据库无法连接（可能已休眠）**，并引导用户前往 Supabase 后台唤醒数据库。

## 3. 实施方案

### 3.1 创建全局 ErrorContext 和 Provider
新建一个全局的 React Context，用于管理错误状态并提供触发错误弹窗的 API。
- **文件**: `src/contexts/ErrorContext.tsx`
- **状态**: `isOpen` (控制弹窗显示), `errorMessage` (错误信息), `errorTitle` (错误标题)。
- **方法**: `showDbError()` (专门用于触发数据库休眠/连接失败的提示)。
- **UI 组件**: 在 Provider 内部复用现有的 `Dialog` 组件，渲染一个高优先级的警告弹窗。弹窗内包含清晰的说明文本和操作指引（甚至可以带上前往 Supabase 的链接）。

### 3.2 挂载全局 Provider
- **文件**: `src/App.tsx`
- **操作**: 将 `ErrorProvider` 包裹在 `BrowserRouter` 外层，使其覆盖整个应用，确保任何页面都能触发弹窗。

### 3.3 重构数据请求层的错误捕获
修改三个主要页面中的核心 `fetch` 函数，将原来的静默失败或简单的 `toast` 替换/补充为调用全局的 `showDbError`。
- **文件**: `src/pages/Dashboard.tsx` (`fetchDashboardData`)
- **文件**: `src/pages/Tickets.tsx` (`fetchData`)
- **文件**: `src/pages/Sales.tsx` (`fetchSales`)
- **逻辑**: 在 `try-catch` 的 `catch` 块中，判断如果错误来源于 Supabase（或者 fetch 失败），则调用 `showDbError()`。

## 4. 验证步骤
1. 临时修改 `src/lib/supabase.ts` 中的 `VITE_SUPABASE_URL` 为一个错误的地址，模拟数据库连接失败。
2. 刷新页面，观察是否能在加载时立刻弹出一个明确说明“数据库连接失败”的模态框。
3. 关闭弹窗后，测试其他页面的加载行为是否也会触发该提示。
4. 恢复正确的 URL，确认应用恢复正常工作且弹窗不再出现。
