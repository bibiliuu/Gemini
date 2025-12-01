# 租号订单管理系统 - 实施计划

## 项目概述

这是一个基于 React + TypeScript + SQLite 的租号订单管理系统，用于管理租号订单、用户信息和收益分配。

## 当前系统架构

### 技术栈
- **前端**: React 18 + TypeScript + Vite
- **后端**: Node.js + Express
- **数据库**: SQLite
- **UI组件**: Ant Design
- **状态管理**: React Hooks (useState, useEffect)

### 核心功能模块

#### 1. 订单管理 (Order Management)
- 订单列表展示（支持分页）
- 订单状态筛选（全部/待审核/已通过/已拒绝）
- 订单详情查看（包含图片预览）
- 订单审核（通过/拒绝）
- 订单创建和编辑
- 订单删除

#### 2. 用户管理 (User Management)
- 用户列表展示
- 用户角色管理（接单员/管控/上级）
- 用户信息的增删改查
- 用户与订单的关联

#### 3. 收益分配系统 (Revenue Distribution)
- 资金池分配 (20%)
- 接单员分成 (80%)
- 平台抽成 (17% of 接单员分成)
- 上级分成 (可选)
- 管控分成 (3% of 接单员分成)

#### 4. 数据统计
- 订单总数统计
- 各状态订单数量统计
- 收益汇总

## 数据库设计

### orders 表
```sql
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    imageUrl TEXT,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    amount REAL NOT NULL,
    taker TEXT NOT NULL,
    controller TEXT NOT NULL,
    superior TEXT,
    orderDate TEXT NOT NULL,
    content TEXT,
    distribution TEXT,
    notes TEXT
);
```

### users 表
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    role TEXT CHECK(role IN ('taker', 'controller', 'superior')) NOT NULL
);
```

## 已知问题和修复记录

### 1. 用户创建失败问题 ✅ 已修复
**问题描述**: 添加新用户时出现 "Save failed, please retry" 错误

**根本原因**: 
- `GET /api/users` 端点使用了无效的 `ORDER BY created_at` 子句
- `users` 表中不存在 `created_at` 列

**解决方案**:
- 移除了 `server/index.js` 中的无效 `ORDER BY` 子句
- 更新前端使用新的后端 API 端点
- 重构 `UserManagementModal` 组件以接受独立的 CRUD 回调函数

### 2. 订单图片显示问题
**当前状态**: 订单支持 base64 图片存储和显示
**注意事项**: 大图片可能导致数据库体积增大

## 文件结构

```
project/
├── src/
│   ├── App.tsx                 # 主应用组件
│   ├── components/
│   │   ├── OrderCard.tsx       # 订单卡片组件
│   │   ├── OrderModal.tsx      # 订单详情/编辑模态框
│   │   └── UserManagementModal.tsx  # 用户管理模态框
│   ├── types.ts                # TypeScript 类型定义
│   └── main.tsx                # 应用入口
├── server/
│   ├── index.js                # Express 服务器
│   └── database.db             # SQLite 数据库
├── package.json
└── vite.config.ts
```

## API 端点

### 订单相关
- `GET /api/orders` - 获取所有订单
- `POST /api/orders` - 创建新订单
- `PUT /api/orders/:id` - 更新订单
- `DELETE /api/orders/:id` - 删除订单
- `PUT /api/orders/:id/status` - 更新订单状态

### 用户相关
- `GET /api/users` - 获取所有用户
- `POST /api/users` - 创建新用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

## 收益分配逻辑

```typescript
const distribution = {
  pool: amount * 0.2,                    // 资金池 20%
  taker: amount * 0.8,                   // 接单员 80%
  platform: amount * 0.8 * 0.17,         // 平台 17% of 接单员
  superior: superiorAmount,               // 上级分成（可选）
  controller: amount * 0.8 * 0.03        // 管控 3% of 接单员
};
```

## 部署和运行

### 开发环境
```bash
# 安装依赖
npm install

# 启动后端服务器
npm run server

# 启动前端开发服务器
npm run dev
```

### 生产环境
```bash
# 构建前端
npm run build

# 启动生产服务器
npm run server
```

## 待优化项

### 短期优化
1. ✅ 修复用户创建功能
2. 添加订单搜索功能
3. 改进错误处理和用户反馈
4. 添加数据验证

### 中期优化
1. 实现用户认证和授权
2. 添加订单导出功能（Excel/CSV）
3. 实现数据备份机制
4. 添加操作日志记录

### 长期优化
1. 迁移到更强大的数据库（PostgreSQL/MySQL）
2. 实现实时通知系统
3. 添加数据分析和报表功能
4. 移动端适配

## 测试清单

### 功能测试
- [ ] 订单创建
- [ ] 订单编辑
- [ ] 订单删除
- [ ] 订单状态更新
- [ ] 用户创建 ✅
- [ ] 用户编辑
- [ ] 用户删除
- [ ] 收益分配计算
- [ ] 图片上传和显示

### 边界测试
- [ ] 空数据处理
- [ ] 大量数据加载
- [ ] 并发操作
- [ ] 网络错误处理

## 维护指南

### 数据库维护
- 定期备份数据库文件
- 监控数据库大小
- 清理过期数据

### 代码维护
- 遵循 TypeScript 类型安全
- 保持组件单一职责
- 及时更新依赖包
- 编写单元测试

## 联系和支持

如有问题或建议，请通过以下方式联系：
- 项目仓库: [GitHub链接]
- 邮箱: [联系邮箱]

---

**最后更新**: 2025-01-30
**版本**: 1.0.0
