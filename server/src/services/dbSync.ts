import { Pool } from 'pg';
import primaryPool, { getMirrorPools } from '../config/db';

const upsertProductSnapshot = async (pool: Pool, productId: string) => {
  const productResult = await primaryPool.query('SELECT * FROM products WHERE id = $1', [productId]);
  if (productResult.rows.length === 0) {
    await pool.query('DELETE FROM product_batches WHERE product_id = $1', [productId]);
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    return;
  }

  const product = productResult.rows[0];
  await pool.query(
    `INSERT INTO products (
       id, name, sku, category, brand, description, price, cost_price, image, reorder_point, status,
       supplier_name, supplier_phone, stock_main_warehouse, stock_back_room, stock_show_room, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16, COALESCE($17, NOW())
     )
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       sku = EXCLUDED.sku,
       category = EXCLUDED.category,
       brand = EXCLUDED.brand,
       description = EXCLUDED.description,
       price = EXCLUDED.price,
       cost_price = EXCLUDED.cost_price,
       image = EXCLUDED.image,
       reorder_point = EXCLUDED.reorder_point,
       status = EXCLUDED.status,
       supplier_name = EXCLUDED.supplier_name,
       supplier_phone = EXCLUDED.supplier_phone,
       stock_main_warehouse = EXCLUDED.stock_main_warehouse,
       stock_back_room = EXCLUDED.stock_back_room,
       stock_show_room = EXCLUDED.stock_show_room,
       updated_at = EXCLUDED.updated_at`,
    [
      product.id,
      product.name,
      product.sku,
      product.category,
      product.brand,
      product.description,
      product.price,
      product.cost_price,
      product.image,
      product.reorder_point,
      product.status,
      product.supplier_name,
      product.supplier_phone,
      product.stock_main_warehouse,
      product.stock_back_room,
      product.stock_show_room,
      product.updated_at || null,
    ]
  );

  const batchResult = await primaryPool.query('SELECT * FROM product_batches WHERE product_id = $1', [productId]);
  await pool.query('DELETE FROM product_batches WHERE product_id = $1', [productId]);
  for (const row of batchResult.rows) {
    await pool.query(
      `INSERT INTO product_batches (
         id, product_id, batch_number, manufacture_date, expiry_date, stock_location, quantity_available, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW()),COALESCE($9, NOW()))
       ON CONFLICT (id) DO UPDATE SET
         product_id = EXCLUDED.product_id,
         batch_number = EXCLUDED.batch_number,
         manufacture_date = EXCLUDED.manufacture_date,
         expiry_date = EXCLUDED.expiry_date,
         stock_location = EXCLUDED.stock_location,
         quantity_available = EXCLUDED.quantity_available,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at`,
      [
        row.id,
        row.product_id,
        row.batch_number,
        row.manufacture_date,
        row.expiry_date,
        row.stock_location,
        row.quantity_available,
        row.created_at || null,
        row.updated_at || null,
      ]
    );
  }
};

export const syncProductAcrossDatabases = async (productId: string) => {
  for (const mirrorPool of getMirrorPools()) {
    await upsertProductSnapshot(mirrorPool, productId);
  }
};

export const syncOrderAcrossDatabases = async (orderId: string) => {
  const orderResult = await primaryPool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  const itemResult = await primaryPool.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id ASC', [orderId]);
  const allocationResult = await primaryPool.query(
    'SELECT * FROM order_batch_allocations WHERE order_id = $1 ORDER BY id ASC',
    [orderId]
  );
  const productIds = Array.from(
    new Set([
      ...itemResult.rows.map((row) => row.product_id),
      ...allocationResult.rows.map((row) => row.product_id),
    ])
  ).filter(Boolean);

  for (const mirrorPool of getMirrorPools()) {
    if (orderResult.rows.length === 0) {
      await mirrorPool.query('DELETE FROM order_batch_allocations WHERE order_id = $1', [orderId]);
      await mirrorPool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      await mirrorPool.query('DELETE FROM orders WHERE id = $1', [orderId]);
    } else {
      const order = orderResult.rows[0];
      await mirrorPool.query(
        `INSERT INTO orders (
           id, buyer_id, date, status, subtotal, tax, total, amount_paid, payment_status,
           stock_deducted, created_by, history, payment_terms, created_at, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14, NOW()),COALESCE($15, NOW())
         )
         ON CONFLICT (id) DO UPDATE SET
           buyer_id = EXCLUDED.buyer_id,
           date = EXCLUDED.date,
           status = EXCLUDED.status,
           subtotal = EXCLUDED.subtotal,
           tax = EXCLUDED.tax,
           total = EXCLUDED.total,
           amount_paid = EXCLUDED.amount_paid,
           payment_status = EXCLUDED.payment_status,
           stock_deducted = EXCLUDED.stock_deducted,
           created_by = EXCLUDED.created_by,
           history = EXCLUDED.history,
           payment_terms = EXCLUDED.payment_terms,
           updated_at = EXCLUDED.updated_at`,
        [
          order.id,
          order.buyer_id,
          order.date,
          order.status,
          order.subtotal,
          order.tax,
          order.total,
          order.amount_paid,
          order.payment_status,
          order.stock_deducted,
          order.created_by,
          order.history,
          order.payment_terms,
          order.created_at || null,
          order.updated_at || null,
        ]
      );

      await mirrorPool.query('DELETE FROM order_batch_allocations WHERE order_id = $1', [orderId]);
      await mirrorPool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

      for (const row of itemResult.rows) {
        await mirrorPool.query(
          `INSERT INTO order_items (id, order_id, product_id, quantity, price_at_order, picked)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (id) DO UPDATE SET
             order_id = EXCLUDED.order_id,
             product_id = EXCLUDED.product_id,
             quantity = EXCLUDED.quantity,
             price_at_order = EXCLUDED.price_at_order,
             picked = EXCLUDED.picked`,
          [row.id, row.order_id, row.product_id, row.quantity, row.price_at_order, row.picked]
        );
      }

      for (const row of allocationResult.rows) {
        await mirrorPool.query(
          `INSERT INTO order_batch_allocations (id, order_id, product_id, batch_id, quantity, created_at)
           VALUES ($1,$2,$3,$4,$5,COALESCE($6, NOW()))
           ON CONFLICT (id) DO UPDATE SET
             order_id = EXCLUDED.order_id,
             product_id = EXCLUDED.product_id,
             batch_id = EXCLUDED.batch_id,
             quantity = EXCLUDED.quantity,
             created_at = EXCLUDED.created_at`,
          [row.id, row.order_id, row.product_id, row.batch_id, row.quantity, row.created_at || null]
        );
      }
    }

    for (const productId of productIds) {
      await upsertProductSnapshot(mirrorPool, productId);
    }
  }
};
