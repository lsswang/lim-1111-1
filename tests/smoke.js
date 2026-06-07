const http = require('http');

const BASE_URL = 'http://localhost:3000/api';
const DELIVERY_NO = 'DELIVERY-' + Date.now();
const STORE_ID = 'STORE-001';
const DELIVERY_STAFF_ID = 'STAFF-001';
const INSPECTOR_ID = 'INSPECTOR-001';

function request(path, method, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
  } else {
    console.log(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('========================================');
  console.log('冷链冰袋回收核销 API - 冒烟测试');
  console.log('========================================\n');

  console.log('1. 健康检查');
  const health = await request('/health', 'GET');
  assert(health.status === 200, '健康检查接口正常');
  assert(health.data.success === true, '健康检查返回成功');

  console.log('\n2. 配送员登记冰袋');
  const dispatchData = {
    deliveryNo: DELIVERY_NO,
    deliveryStaffId: DELIVERY_STAFF_ID,
    storeId: STORE_ID,
    totalIceBags: 10,
    batches: [
      { batchNo: 'BATCH-001', quantity: 6, type: 'standard' },
      { batchNo: 'BATCH-002', quantity: 4, type: 'large' }
    ]
  };
  const dispatch = await request('/delivery/dispatch', 'POST', dispatchData);
  assert(dispatch.status === 201, '配送单创建成功');
  assert(dispatch.data.success === true, '配送单创建返回成功');
  assert(dispatch.data.data.status === 'dispatched', '配送单状态为已发货');

  console.log('\n3. 未完成温度回传时核销（应该失败）');
  const recycleNoTemp = await request('/recycling/verify', 'POST', {
    deliveryNo: DELIVERY_NO,
    storeId: STORE_ID,
    totalReceived: 8
  });
  assert(recycleNoTemp.status === 400, '未传温度时核销被拒绝');
  assert(recycleNoTemp.data.error.includes('温度回传'), '错误信息包含温度回传提示');

  console.log('\n4. 上报温度数据');
  const tempReport = await request(`/delivery/temperature/${DELIVERY_NO}`, 'POST');
  assert(tempReport.status === 200, '温度回传成功');
  assert(tempReport.data.data.temperatureReceived === true, '温度已标记为已接收');

  console.log('\n5. 超量回收（回收数量 > 发出数量，应该失败）');
  const overRecycle = await request('/recycling/verify', 'POST', {
    deliveryNo: DELIVERY_NO,
    storeId: STORE_ID,
    totalReceived: 15
  });
  assert(overRecycle.status === 400, '超量回收被拒绝');
  assert(overRecycle.data.error.includes('大于发出数量'), '错误信息包含超量提示');
  assert(overRecycle.data.error.includes('拒绝核销'), '错误信息包含拒绝核销提示');

  console.log('\n6. 正常核销回收');
  const recycle = await request('/recycling/verify', 'POST', {
    deliveryNo: DELIVERY_NO,
    storeId: STORE_ID,
    totalReceived: 8
  });
  assert(recycle.status === 201, '核销成功');
  assert(recycle.data.data.status === 'inspection_pending', '状态为待质检');
  const recordId = recycle.data.data.id;

  console.log('\n7. 质检员标记（破损冰袋不进入可复用库存）');
  const inspect = await request('/recycling/inspect', 'POST', {
    recyclingRecordId: recordId,
    inspectorId: INSPECTOR_ID,
    reusableCount: 6,
    damagedCount: 2
  });
  assert(inspect.status === 201, '质检完成');
  assert(inspect.data.data.reusableCount === 6, '可复用数量正确');
  assert(inspect.data.data.damagedCount === 2, '破损数量正确');

  console.log('\n8. 查询库存（验证破损不入库）');
  const inventory = await request('/inventory?storeId=' + STORE_ID, 'GET');
  assert(inventory.status === 200, '库存查询成功');
  const reusableInv = inventory.data.data.find(i => i.status === 'reusable');
  assert(reusableInv && reusableInv.quantity === 6, '可复用库存为6，破损的2个未入库');

  console.log('\n========================================');
  console.log('冒烟测试完成');
  if (process.exitCode !== 1) {
    console.log('🎉 所有测试通过!');
  } else {
    console.log('⚠️  部分测试失败，请检查');
  }
  console.log('========================================');
}

runTests().catch((err) => {
  console.error('测试运行失败:', err.message);
  console.log('请确保 API 服务已启动: docker-compose up -d');
  process.exit(1);
});
