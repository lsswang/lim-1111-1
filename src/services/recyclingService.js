const { v4: uuidv4 } = require('uuid');
const db = require('../db');

class RecyclingService {
  static verifyAndRecycle(data) {
    return new Promise((resolve, reject) => {
      const { deliveryNo, storeId, totalReceived } = data;

      db.get(
        `SELECT * FROM delivery_orders WHERE delivery_no = ?`,
        [deliveryNo],
        (err, order) => {
          if (err) return reject(err);
          if (!order) return reject(new Error('配送单不存在'));

          if (order.store_id !== storeId) {
            return reject(new Error('该配送单不属于当前门店'));
          }

          if (!order.temperature_received) {
            return reject(new Error('未完成温度回传，不能核销'));
          }

          if (order.status !== 'dispatched') {
            return reject(new Error('配送单状态不正确，当前状态: ' + order.status));
          }

          if (totalReceived > order.total_ice_bags) {
            return reject(new Error('回收数量大于发出数量，拒绝核销'));
          }

          db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            const recordId = uuidv4();
            db.run(
              `INSERT INTO recycling_records (id, delivery_order_id, store_id, total_received, status)
               VALUES (?, ?, ?, ?, 'inspection_pending')`,
              [recordId, order.id, storeId, totalReceived],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                db.run(
                  `UPDATE delivery_orders SET status = 'recycled', updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`,
                  [order.id],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(err);
                    }

                    db.run('COMMIT', (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                      }
                      resolve({
                        id: recordId,
                        deliveryNo,
                        totalReceived,
                        status: 'inspection_pending'
                      });
                    });
                  }
                );
              }
            );
          });
        }
      );
    });
  }

  static qualityInspect(data) {
    return new Promise((resolve, reject) => {
      const { recyclingRecordId, inspectorId, reusableCount, damagedCount } = data;

      db.get(
        `SELECT * FROM recycling_records WHERE id = ?`,
        [recyclingRecordId],
        (err, record) => {
          if (err) return reject(err);
          if (!record) return reject(new Error('回收记录不存在'));

          if (record.status !== 'inspection_pending') {
            return reject(new Error('回收记录状态不正确'));
          }

          if (reusableCount + damagedCount !== record.total_received) {
            return reject(new Error('可复用数量与破损数量之和必须等于回收总数'));
          }

          if (damagedCount < 0 || reusableCount < 0) {
            return reject(new Error('数量不能为负数'));
          }

          db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            const inspectionId = uuidv4();
            db.run(
              `INSERT INTO quality_inspections (id, recycling_record_id, reusable_count, damaged_count, inspector_id)
               VALUES (?, ?, ?, ?, ?)`,
              [inspectionId, recyclingRecordId, reusableCount, damagedCount, inspectorId],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }

                db.run(
                  `UPDATE recycling_records SET status = 'inspected', updated_at = CURRENT_TIMESTAMP
                   WHERE id = ?`,
                  [recyclingRecordId],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      return reject(err);
                    }

                    RecyclingService._updateInventory(record.store_id, reusableCount, 'reusable', (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        return reject(err);
                      }

                      db.run('COMMIT', (err) => {
                        if (err) {
                          db.run('ROLLBACK');
                          return reject(err);
                        }
                        resolve({
                          id: inspectionId,
                          recyclingRecordId,
                          reusableCount,
                          damagedCount,
                          status: 'completed'
                        });
                      });
                    });
                  }
                );
              }
            );
          });
        }
      );
    });
  }

  static _updateInventory(storeId, quantity, status, callback) {
    db.get(
      `SELECT * FROM inventory WHERE store_id = ? AND status = ?`,
      [storeId, status],
      (err, inv) => {
        if (err) return callback(err);

        if (inv) {
          db.run(
            `UPDATE inventory SET quantity = quantity + ? WHERE id = ?`,
            [quantity, inv.id],
            callback
          );
        } else {
          db.run(
            `INSERT INTO inventory (id, store_id, status, quantity)
             VALUES (?, ?, ?, ?)`,
            [uuidv4(), storeId, status, quantity],
            callback
          );
        }
      }
    );
  }

  static getInventory(storeId) {
    return new Promise((resolve, reject) => {
      const query = storeId
        ? `SELECT * FROM inventory WHERE store_id = ?`
        : `SELECT * FROM inventory`;
      const params = storeId ? [storeId] : [];

      db.all(query, params, (err, inventory) => {
        if (err) return reject(err);
        resolve(inventory);
      });
    });
  }

  static getRecyclingRecord(recordId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT rr.*, do.delivery_no, do.total_ice_bags as total_dispatched
         FROM recycling_records rr
         JOIN delivery_orders do ON rr.delivery_order_id = do.id
         WHERE rr.id = ?`,
        [recordId],
        (err, record) => {
          if (err) return reject(err);
          if (!record) return reject(new Error('回收记录不存在'));

          db.get(
            `SELECT * FROM quality_inspections WHERE recycling_record_id = ?`,
            [recordId],
            (err, inspection) => {
              if (err) return reject(err);
              resolve({ ...record, inspection: inspection || null });
            }
          );
        }
      );
    });
  }
}

module.exports = RecyclingService;
