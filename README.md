# 冷链冰袋回收核销 API

冷链冰袋全生命周期管理系统，支持配送员登记、门店核销回收、质检员分级、库存管理等完整流程。

## 功能特性

- ✅ 配送员登记随箱冰袋批次
- ✅ 温度回传确认机制
- ✅ 门店收货核销回收数量
- ✅ 质检员标记破损和可复用
- ✅ 业务规则强校验
- ✅ 库存自动更新（破损不入可复用库存）

## 业务规则

1. **未完成温度回传不能核销**：门店核销前必须确认温度数据已回传
2. **回收数量大于发出数量要拒绝**：防止超量回收
3. **破损冰袋不能进入可复用库存**：质检后仅可复用冰袋入库

## 快速启动

### 方式一：Docker Compose（推荐）

```bash
# 构建并启动服务
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

服务启动后访问：`http://localhost:3000/api/health`

### 方式二：本地 Node.js

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

## 冒烟测试

确保服务启动后，运行冒烟测试验证核心流程：

```bash
npm test
```

测试内容包括：
- 健康检查
- 配送员登记冰袋
- 未传温度核销（验证失败）
- 温度回传
- 超量回收（验证失败，核心校验点）
- 正常核销回收
- 质检员分级
- 库存验证（破损不入库）

## API 接口文档

### 1. 配送员登记冰袋

```
POST /api/delivery/dispatch
```

请求体：
```json
{
  "deliveryNo": "DELIVERY-001",
  "deliveryStaffId": "STAFF-001",
  "storeId": "STORE-001",
  "totalIceBags": 10,
  "batches": [
    { "batchNo": "BATCH-001", "quantity": 6, "type": "standard" },
    { "batchNo": "BATCH-002", "quantity": 4, "type": "large" }
  ]
}
```

### 2. 温度回传

```
POST /api/delivery/temperature/:deliveryNo
```

### 3. 查询配送单

```
GET /api/delivery/:deliveryNo
```

### 4. 门店核销回收

```
POST /api/recycling/verify
```

请求体：
```json
{
  "deliveryNo": "DELIVERY-001",
  "storeId": "STORE-001",
  "totalReceived": 8
}
```

**校验规则**：
- 必须已完成温度回传
- 回收数量不能大于发出数量
- 门店必须与配送单一致

### 5. 质检员标记

```
POST /api/recycling/inspect
```

请求体：
```json
{
  "recyclingRecordId": "uuid",
  "inspectorId": "INSPECTOR-001",
  "reusableCount": 6,
  "damagedCount": 2
}
```

**规则**：破损冰袋不计入可复用库存

### 6. 查询回收记录

```
GET /api/recycling/:recordId
```

### 7. 查询库存

```
GET /api/inventory?storeId=STORE-001
```

## 数据模型

- **delivery_orders**：配送单主表
- **ice_bag_batches**：冰袋批次明细
- **recycling_records**：回收记录
- **quality_inspections**：质检记录
- **inventory**：库存表

## 目录结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── db.js                  # 数据库初始化
│   ├── routes/                # API 路由
│   │   ├── delivery.js
│   │   ├── recycling.js
│   │   └── inventory.js
│   └── services/              # 业务逻辑
│       ├── deliveryService.js
│       └── recyclingService.js
├── tests/
│   └── smoke.js               # 冒烟测试
├── Dockerfile
├── docker-compose.yml
└── package.json
```
