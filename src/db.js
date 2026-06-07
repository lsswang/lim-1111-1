const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'ice_bag.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS delivery_orders (
      id TEXT PRIMARY KEY,
      delivery_no TEXT UNIQUE NOT NULL,
      delivery_staff_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      total_ice_bags INTEGER NOT NULL,
      temperature_received BOOLEAN DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ice_bag_batches (
      id TEXT PRIMARY KEY,
      batch_no TEXT UNIQUE NOT NULL,
      delivery_order_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS recycling_records (
      id TEXT PRIMARY KEY,
      delivery_order_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      total_received INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quality_inspections (
      id TEXT PRIMARY KEY,
      recycling_record_id TEXT NOT NULL,
      reusable_count INTEGER NOT NULL DEFAULT 0,
      damaged_count INTEGER NOT NULL DEFAULT 0,
      inspector_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recycling_record_id) REFERENCES recycling_records(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      status TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      UNIQUE(store_id, status)
    )
  `);

  const checkIndex = `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_delivery_orders_status'`;
  db.get(checkIndex, (err, row) => {
    if (!row) {
      db.run(`CREATE INDEX idx_delivery_orders_status ON delivery_orders(status)`);
    }
  });
});

module.exports = db;
