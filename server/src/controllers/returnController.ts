// src/controllers/returnController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { logActivity } from '../utils/activityLog';
import { createNotificationRecord } from '../services/notificationService';
import { emitInventoryChanged } from '../services/realtime';

const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const parseInteger = (value: any): number => {
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const computeStatus = (totalStock: number, reorderPoint: number) => {
  if (totalStock === 0) return 'Empty';
  if (totalStock < reorderPoint) return 'Low';
  return 'In Stock';
};

// System logs disabled; user-initiated logs use logActivity

const adjustProductStock = async (
  productId: string,
  location: 'mainWarehouse' | 'backRoom' | 'showRoom',
  quantity: number,
  direction: 'add' | 'deduct'
) => {
  const productResult = await pool.query(
    `SELECT stock_main_warehouse, stock_back_room, stock_show_room, reorder_point, status
     FROM products WHERE id = $1`,
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Product not found');
  }

  const current = productResult.rows[0];
  const main = parseInteger(current.stock_main_warehouse);
  const back = parseInteger(current.stock_back_room);
  const show = parseInteger(current.stock_show_room);

  const delta = direction === 'add' ? quantity : -quantity;
  const nextMain = location === 'mainWarehouse' ? main + delta : main;
  const nextBack = location === 'backRoom' ? back + delta : back;
  const nextShow = location === 'showRoom' ? show + delta : show;

  if (nextMain < 0 || nextBack < 0 || nextShow < 0) {
    throw new Error('Insufficient stock for adjustment');
  }

  const totalStock = nextMain + nextBack + nextShow;
  const oldStatus = current.status;
  const newStatus = computeStatus(totalStock, parseInteger(current.reorder_point));

  await pool.query(
    `UPDATE products SET
      stock_main_warehouse = $1,
      stock_back_room = $2,
      stock_show_room = $3,
      status = $4,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $5`,
    [nextMain, nextBack, nextShow, newStatus, productId]
  );

  if (newStatus !== oldStatus && (newStatus === 'Low' || newStatus === 'Empty')) {
    await createNotificationRecord(
      'Stock',
      'Inventory Alert',
      `${newStatus} stock warning for product ${productId}.`,
      'high',
      'seller',
      productId
    );
    // System logs disabled; only user-initiated logs are recorded
  }

  emitInventoryChanged({
    productId,
    status: newStatus,
    stock: {
      mainWarehouse: nextMain,
      backRoom: nextBack,
      showRoom: nextShow,
      total: totalStock
    }
  });
};

export const getAllReturns = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        product_id AS "productId",
        order_id AS "orderId",
        buyer_id AS "buyerId",
        product_name AS "productName",
        brand,
        type,
        quantity,
        reason,
        action,
        date,
        note,
        loss_value AS "lossValue",
        supplier_name AS "supplierName",
        stock_location AS "stockLocation"
       FROM return_logs
       ORDER BY date DESC, created_at DESC`
    );

    const logs = result.rows.map((row: any) => ({
      ...row,
      quantity: parseInteger(row.quantity),
      lossValue: parseNumber(row.lossValue)
    }));

    res.json(logs);
  } catch (err) {
    console.error('Get returns error:', err);
    res.status(500).json({ error: 'Failed to fetch returns' });
  }
};

export const getReturnById = async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const result = await pool.query(
      `SELECT 
        id,
        product_id AS "productId",
        order_id AS "orderId",
        buyer_id AS "buyerId",
        product_name AS "productName",
        brand,
        type,
        quantity,
        reason,
        action,
        date,
        note,
        loss_value AS "lossValue",
        supplier_name AS "supplierName",
        stock_location AS "stockLocation"
       FROM return_logs
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Return log not found' });
    }

    const row = result.rows[0];
    res.json({
      ...row,
      quantity: parseInteger(row.quantity),
      lossValue: parseNumber(row.lossValue)
    });
  } catch (err) {
    console.error('Get return log error:', err);
    res.status(500).json({ error: 'Failed to fetch return log' });
  }
};

export const createReturnLog = async (req: Request, res: Response) => {
  const {
    productId,
    orderId,
    buyerId,
    type,
    quantity,
    reason,
    action,
    date,
    note,
    stockLocation
  } = req.body || {};

  if (!productId || !type || !quantity || !reason || !action || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['Return', 'Damage'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const validReturnReasons = new Set([
    'Customer Return',
    'Wrong Item',
    'Damaged in Transit'
  ]);
  const validDamageReasons = new Set([
    'Damaged in Transit',
    'Faulty Packaging',
    'Expired'
  ]);

  if (type === 'Return' && (!orderId || !buyerId)) {
    return res.status(400).json({ error: 'orderId and buyerId are required for returns' });
  }

  if (type === 'Damage' && (orderId || buyerId)) {
    return res.status(400).json({ error: 'orderId and buyerId must be empty for damages' });
  }

  if (type === 'Return' && !validReturnReasons.has(reason)) {
    return res.status(400).json({ error: 'Invalid reason for Return' });
  }
  if (type === 'Damage' && !validDamageReasons.has(reason)) {
    return res.status(400).json({ error: 'Invalid reason for Damage' });
  }

  const needsStockLocation = type === 'Damage' || (type === 'Return' && action === 'Restocked');
  if (needsStockLocation && !['mainWarehouse', 'backRoom', 'showRoom'].includes(stockLocation)) {
    return res.status(400).json({ error: 'Valid stockLocation is required for this action' });
  }

  try {
    await pool.query('BEGIN');

    const productResult = await pool.query(
      `SELECT id, name, brand, supplier_name, cost_price, price
       FROM products WHERE id = $1`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];
    const unitCost = product.cost_price ?? product.price;
    const lossValue = action === 'Disposed'
      ? parseNumber(unitCost) * parseInteger(quantity)
      : 0;

    if (type === 'Return') {
      const orderResult = await pool.query(
        'SELECT id, buyer_id FROM orders WHERE id = $1',
        [orderId]
      );
      if (orderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Order not found' });
      }
      const order = orderResult.rows[0];
      if (order.buyer_id !== buyerId) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'buyerId does not match order buyer' });
      }
    }

    const insertResult = await pool.query(
      `INSERT INTO return_logs (
        product_id, order_id, buyer_id, type, quantity, reason, action, date, note,
        loss_value, brand, product_name, supplier_name, stock_location
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING 
        id,
        product_id AS "productId",
        order_id AS "orderId",
        buyer_id AS "buyerId",
        product_name AS "productName",
        brand,
        type,
        quantity,
        reason,
        action,
        date,
        note,
        loss_value AS "lossValue",
        supplier_name AS "supplierName",
        stock_location AS "stockLocation"`,
      [
        productId,
        orderId || null,
        buyerId || null,
        type,
        quantity,
        reason,
        action,
        date,
        note || '',
        lossValue,
        product.brand,
        product.name,
        product.supplier_name,
        stockLocation || null
      ]
    );

    if (type === 'Damage' && stockLocation) {
      await adjustProductStock(productId, stockLocation, parseInteger(quantity), 'deduct');
    }
    if (type === 'Return' && action === 'Restocked' && stockLocation) {
      await adjustProductStock(productId, stockLocation, parseInteger(quantity), 'add');
    }

    await pool.query('COMMIT');

    const row = insertResult.rows[0];
    res.status(201).json({
      ...row,
      quantity: parseInteger(row.quantity),
      lossValue: parseNumber(row.lossValue)
    });

    await logActivity(
      req,
      'Create Return Log',
      'Returns',
      `Created ${type} log for product ${productId}, qty ${quantity}.`
    );
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Create return log error:', err);
    res.status(500).json({ error: 'Failed to create return log' });
  }
};

export const updateReturnLog = async (req: Request, res: Response) => {
  const id = req.params.id;
  const {
    productId,
    orderId,
    buyerId,
    type,
    quantity,
    reason,
    action,
    date,
    note,
    stockLocation
  } = req.body || {};

  if (!productId || !type || !quantity || !reason || !action || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!['Return', 'Damage'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }

  const validReturnReasons = new Set([
    'Customer Return',
    'Wrong Item',
    'Damaged in Transit'
  ]);
  const validDamageReasons = new Set([
    'Damaged in Transit',
    'Faulty Packaging',
    'Expired'
  ]);

  if (type === 'Return' && (!orderId || !buyerId)) {
    return res.status(400).json({ error: 'orderId and buyerId are required for returns' });
  }
  if (type === 'Damage' && (orderId || buyerId)) {
    return res.status(400).json({ error: 'orderId and buyerId must be empty for damages' });
  }
  if (type === 'Return' && !validReturnReasons.has(reason)) {
    return res.status(400).json({ error: 'Invalid reason for Return' });
  }
  if (type === 'Damage' && !validDamageReasons.has(reason)) {
    return res.status(400).json({ error: 'Invalid reason for Damage' });
  }

  const needsStockLocation = type === 'Damage' || (type === 'Return' && action === 'Restocked');
  if (needsStockLocation && !['mainWarehouse', 'backRoom', 'showRoom'].includes(stockLocation)) {
    return res.status(400).json({ error: 'Valid stockLocation is required for this action' });
  }

  try {
    await pool.query('BEGIN');

    const existingResult = await pool.query(
      `SELECT 
        product_id,
        order_id,
        buyer_id,
        type,
        action,
        quantity,
        stock_location
       FROM return_logs
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Return log not found' });
    }

    const existing = existingResult.rows[0];

    if (type === 'Return') {
      const orderResult = await pool.query(
        'SELECT id, buyer_id FROM orders WHERE id = $1',
        [orderId]
      );
      if (orderResult.rows.length === 0) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found' });
      }
      const order = orderResult.rows[0];
      if (order.buyer_id !== buyerId) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'buyerId does not match order buyer' });
      }
    }

    // Reverse previous stock adjustment if any
    const oldAdjustsStock =
      existing.type === 'Damage' || (existing.type === 'Return' && existing.action === 'Restocked');
    if (oldAdjustsStock) {
      if (!['mainWarehouse', 'backRoom', 'showRoom'].includes(existing.stock_location)) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'Existing stock location is invalid for adjustment' });
      }
      const reverseDirection = existing.type === 'Damage' ? 'add' : 'deduct';
      await adjustProductStock(
        existing.product_id,
        existing.stock_location,
        parseInteger(existing.quantity),
        reverseDirection as 'add' | 'deduct'
      );
    }

    const productResult = await pool.query(
      `SELECT id, name, brand, supplier_name, cost_price, price
       FROM products WHERE id = $1`,
      [productId]
    );
    if (productResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = productResult.rows[0];
    const unitCost = product.cost_price ?? product.price;
    const lossValue = action === 'Disposed'
      ? parseNumber(unitCost) * parseInteger(quantity)
      : 0;

    const updateResult = await pool.query(
      `UPDATE return_logs SET
        product_id = $1,
        order_id = $2,
        buyer_id = $3,
        type = $4,
        quantity = $5,
        reason = $6,
        action = $7,
        date = $8,
        note = $9,
        loss_value = $10,
        brand = $11,
        product_name = $12,
        supplier_name = $13,
        stock_location = $14
       WHERE id = $15
       RETURNING 
        id,
        product_id AS "productId",
        order_id AS "orderId",
        buyer_id AS "buyerId",
        product_name AS "productName",
        brand,
        type,
        quantity,
        reason,
        action,
        date,
        note,
        loss_value AS "lossValue",
        supplier_name AS "supplierName",
        stock_location AS "stockLocation"`,
      [
        productId,
        orderId || null,
        buyerId || null,
        type,
        quantity,
        reason,
        action,
        date,
        note || '',
        lossValue,
        product.brand,
        product.name,
        product.supplier_name,
        stockLocation || null,
        id
      ]
    );

    // Apply new stock adjustment if needed
    if (needsStockLocation && stockLocation) {
      const direction = type === 'Damage' ? 'deduct' : 'add';
      await adjustProductStock(
        productId,
        stockLocation,
        parseInteger(quantity),
        direction as 'add' | 'deduct'
      );
    }

    await pool.query('COMMIT');

    const row = updateResult.rows[0];
    res.json({
      ...row,
      quantity: parseInteger(row.quantity),
      lossValue: parseNumber(row.lossValue)
    });

    await logActivity(
      req,
      'Update Return Log',
      'Returns',
      `Updated ${type} log ${id} for product ${productId}, qty ${quantity}.`
    );
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Update return log error:', err);
    res.status(500).json({ error: 'Failed to update return log' });
  }
};

export const deleteReturnLog = async (req: Request, res: Response) => {
  const id = req.params.id;

  try {
    await pool.query('BEGIN');

    const existingResult = await pool.query(
      `SELECT 
        product_id,
        type,
        action,
        quantity,
        stock_location
       FROM return_logs
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Return log not found' });
    }

    const existing = existingResult.rows[0];

    const adjustsStock =
      existing.type === 'Damage' || (existing.type === 'Return' && existing.action === 'Restocked');
    if (adjustsStock) {
      if (!['mainWarehouse', 'backRoom', 'showRoom'].includes(existing.stock_location)) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'Existing stock location is invalid for adjustment' });
      }
      const reverseDirection = existing.type === 'Damage' ? 'add' : 'deduct';
      await adjustProductStock(
        existing.product_id,
        existing.stock_location,
        parseInteger(existing.quantity),
        reverseDirection as 'add' | 'deduct'
      );
    }

    await pool.query('DELETE FROM return_logs WHERE id = $1', [id]);

    await pool.query('COMMIT');
    res.json({ message: 'Return log deleted' });

    await logActivity(
      req,
      'Delete Return Log',
      'Returns',
      `Deleted return log ${id}.`
    );
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Delete return log error:', err);
    res.status(500).json({ error: 'Failed to delete return log' });
  }
};
