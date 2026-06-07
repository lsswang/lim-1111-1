const { v4: uuidv4 } = require('uuid');
const db = require('../db');

class DeliveryService {
  static createDeliveryOrder(data) {
    return new Promise((resolve, reject) => {
      const { deliveryNo, deliveryStaffId, storeId, totalIceBags, batches } = data;
      
      if (!batches || batches.length === 0) {
        return reject(new Error('至少需要一个冰袋批次'));
      }

      const totalFromBatches = batches.reduce((sum, b) => sum + b.quantity, 0);
      if (totalFromBatches !== totalIceBags) {
        return reject(new Error('批次冰袋总数与总数量不一致'));
      }

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const orderId = uuidv4();
        db.run(
          `INSERT INTO delivery_orders (id, delivery_no, delivery_staff_id, store_id, total_ice_bags, status)
           VALUES (?, ?, ?, ?, ?, 'dispatched')`,
          [orderId, deliveryNo, deliveryStaffId, storeId, totalIceBags],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            const batchInsertStmt = db.prepare(
              `INSERT INTO ice_bag_batches (id, batch_no, delivery_order_id, quantity, type)
               VALUES (?, ?, ?, ?, ?)`
            );

            let batchError = null;
            batches.forEach((batch) => {
              if (batchError) return;
              batchInsertStmt.run(
                [uuidv4(), batch.batchNo, orderId, batch.quantity, batch.type],
                (err) => {
                  if (err) batchError = err;
                }
              );
            });

            batchInsertStmt.finalize((err) => {
              if (err || batchError) {
                db.run('ROLLBACK');
                return reject(err || batchError);
              }

              db.run('COMMIT', (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  return reject(err);
                }
                resolve({ id: orderId, deliveryNo, status: 'dispatched' });
              });
            });
          }
        );
      });
    });
  }

  static reportTemperature(deliveryNo) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM delivery_orders WHERE delivery_no = ?`,
        [deliveryNo],
        (err, order) => {
          if (err) return reject(err);
          if (!order) return reject(new Error('配送单不存在'));

          db.run(
            `UPDATE delivery_orders SET temperature_received = 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [order.id],
            (err) => {
              if (err) return reject(err);
              resolve({ deliveryNo, temperatureReceived: true });
            }
          );
        }
      );
    });
  }

  static getDeliveryOrder(deliveryNo) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM delivery_orders WHERE delivery_no = ?`,
        [deliveryNo],
        (err, order) => {
          if (err) return reject(err);
          if (!order) return reject(new Error('配送单不存在'));

          db.all(
            `SELECT * FROM ice_bag_batches WHERE delivery_order_id = ?`,
            [order.id],
            (err, batches) => {
              if (err) return reject(err);
              resolve({ ...order, batches });
            }
          );
        }
      );
    });
  }
}

module.exports = DeliveryService;
