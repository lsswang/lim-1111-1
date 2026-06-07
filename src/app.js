const express = require('express');
require('./db');

const deliveryRoutes = require('./routes/delivery');
const recyclingRoutes = require('./routes/recycling');
const inventoryRoutes = require('./routes/inventory');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'cold-chain-ice-bag-api',
      status: 'running',
      timestamp: new Date().toISOString()
    }
  });
});

app.use('/api/delivery', deliveryRoutes);
app.use('/api/recycling', recyclingRoutes);
app.use('/api/inventory', inventoryRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`冷链冰袋回收核销 API 服务已启动，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
});

module.exports = app;
