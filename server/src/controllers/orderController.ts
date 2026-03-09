// src/controllers/orderController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { logActivity } from '../utils/activityLog';

// Helper function to safely parse numbers
const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// Helper function to update product status based on stock
const updateProductStatus = async (productId: string) => {
  const productResult = await pool.query(
    `SELECT status, reorder_point, stock_main_warehouse, stock_back_room, stock_show_room 
     FROM products WHERE id = $1`,
    [productId]
  );

  if (productResult.rows.length > 0) {
    const product = productResult.rows[0];

    const main = parseInteger(product.stock_main_warehouse);
    const back = parseInteger(product.stock_back_room);
    const show = parseInteger(product.stock_show_room);
    const reorderPoint = parseInteger(product.reorder_point);
    const oldStatus = product.status;

    const totalStock = main + back + show;

    let newStatus = 'In Stock';

    if (totalStock === 0) {
      newStatus = 'Empty';
    } else if (totalStock < reorderPoint) {
      newStatus = 'Low';
    }

    if (newStatus !== oldStatus) {
      await pool.query(
        `UPDATE products 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [newStatus, productId]
      );

      if (newStatus === 'Low' || newStatus === 'Empty') {
        await createNotification(
          'Stock',
          'Inventory Alert',
          `${newStatus} stock warning for product ${productId}.`,
          'high',
          'seller',
          productId
        );
        // System logs disabled; only user-initiated logs are recorded
      }
    }
  }
};


// Helper function to safely parse integers
const parseInteger = (value: any): number => {
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'string') {
    const num = parseInt(value, 10);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const getParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
};

const VALID_STATUSES = [
  'Draft',
  'Pending',
  'Processing',
  'Shipped',
  'Delivered',
  'Undelivered',
  'Cancelled',
  'Deleted'
];

const STATUS_MAP: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  UNDELIVERED: 'Undelivered',
  CANCELLED: 'Cancelled',
  CANCELED: 'Cancelled',
  DELETED: 'Deleted'
};

const normalizeStatus = (value: any): string => {
  if (!value) return '';
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return STATUS_MAP[trimmed.toUpperCase()] || trimmed;
};

const shouldDeductStock = (status: string) =>
  ['Pending', 'Processing', 'Shipped', 'Delivered'].includes(status);

const shouldRestoreStock = (status: string) =>
  ['Cancelled', 'Undelivered', 'Deleted'].includes(status);

const getOrderItems = async (orderId: string) => {
  const itemsResult = await pool.query(
    `SELECT 
       id,
       product_id AS "productId", 
       quantity, 
       price_at_order AS "priceAtOrder", 
       picked 
     FROM order_items 
     WHERE order_id = $1`,
    [orderId]
  );

  return itemsResult.rows.map((item: any) => ({
    ...item,
    quantity: parseInteger(item.quantity),
    priceAtOrder: parseNumber(item.priceAtOrder),
    picked: Boolean(item.picked)
  }));
};

const getTaxRate = async (): Promise<number> => {
  try {
    const result = await pool.query(
      'SELECT value FROM settings WHERE key = $1',
      ['tax_rate']
    );
    if (result.rows.length > 0) {
      const val = parseNumber(result.rows[0].value);
      return val;
    }
  } catch (err) {
    console.error('Get tax rate error:', err);
  }
  return 0;
};

// System logs disabled; user-initiated logs use logActivity

async function createNotification(
  type: string,
  title: string,
  message: string,
  severity: string,
  recipientId: string,
  relatedId?: string
) {
  await pool.query(
    `INSERT INTO notifications (type, title, message, time, is_read, severity, recipient_id, related_id)
     VALUES ($1, $2, $3, $4, false, $5, $6, $7)`,
    [type, title, message, new Date().toISOString(), severity, recipientId, relatedId || null]
  );
}

const adjustInventoryForItem = async (
  productId: string,
  quantity: number,
  direction: 'deduct' | 'restore'
) => {
  const productResult = await pool.query(
    'SELECT stock_main_warehouse, stock_back_room, stock_show_room FROM products WHERE id = $1',
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new Error(`Product ${productId} not found`);
  }

  const currentStock = productResult.rows[0];
  const main = parseInteger(currentStock.stock_main_warehouse);
  const back = parseInteger(currentStock.stock_back_room);
  const show = parseInteger(currentStock.stock_show_room);

  if (direction === 'deduct') {
    const totalStock = main + back + show;
    if (totalStock < quantity) {
      throw new Error(`Insufficient stock for product ${productId}`);
    }

    let remainingQty = quantity;
    let newMainWarehouse = Math.max(0, main - remainingQty);
    if (main >= remainingQty) {
      remainingQty = 0;
    } else {
      remainingQty -= main;
    }

    let newBackRoom = back;
    if (remainingQty > 0) {
      newBackRoom = Math.max(0, back - remainingQty);
      if (back >= remainingQty) {
        remainingQty = 0;
      } else {
        remainingQty -= back;
      }
    }

    let newShowRoom = show;
    if (remainingQty > 0) {
      newShowRoom = Math.max(0, show - remainingQty);
    }

    await pool.query(
      `UPDATE products SET 
        stock_main_warehouse = $1,
        stock_back_room = $2, 
        stock_show_room = $3,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [newMainWarehouse, newBackRoom, newShowRoom, productId]
    );
  } else {
    await pool.query(
      `UPDATE products SET 
        stock_main_warehouse = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [main + quantity, productId]
    );
  }

  await updateProductStatus(productId);
};

const adjustInventoryForOrderItems = async (
  items: { productId: string; quantity: number }[],
  direction: 'deduct' | 'restore'
) => {
  for (const item of items) {
    await adjustInventoryForItem(item.productId, item.quantity, direction);
  }
};

const appendOrderHistory = async (orderId: string, entry: { status: string; date: string; note: string }) => {
  await pool.query(
    `UPDATE orders
     SET history = COALESCE(history, '[]'::jsonb) || $1::jsonb,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [JSON.stringify([entry]), orderId]
  );
};

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const pageParam = parseInt(String(req.query.page || ''), 10);
    const limitParam = parseInt(String(req.query.limit || ''), 10);
    const usePagination = Number.isFinite(pageParam) && Number.isFinite(limitParam) && pageParam > 0 && limitParam > 0;

    const offset = usePagination ? (pageParam - 1) * limitParam : 0;

    const result = await pool.query(
      `
      SELECT 
        o.id, o.buyer_id AS "buyerId", o.date, o.status,
        o.subtotal, o.tax, o.total, o.amount_paid AS "amountPaid",
        o.payment_status AS "paymentStatus", o.created_by AS "createdBy",
        o.payment_terms AS "paymentTerms",
        o.stock_deducted AS "stockDeducted", o.history,
        u.company_name AS "buyerCompanyName",
        u.name AS "buyerName",
        u.phone AS "buyerPhone",
        u.email AS "buyerEmail",
        u.address AS "buyerAddress"
      FROM orders o
      LEFT JOIN users u ON u.id = o.buyer_id
      ORDER BY o.date DESC
      ${usePagination ? 'LIMIT $1 OFFSET $2' : ''}
      `,
      usePagination ? [limitParam, offset] : []
    );

    // Fetch order items and convert numeric fields
    const orders = await Promise.all(result.rows.map(async (order: any) => {
      const items = await getOrderItems(order.id);

      // Convert order numeric fields
      const processedOrder = {
        ...order,
        subtotal: parseNumber(order.subtotal),
        tax: parseNumber(order.tax),
        total: parseNumber(order.total),
        amountPaid: parseNumber(order.amountPaid),
        stockDeducted: Boolean(order.stockDeducted),
        items
      };

      return processedOrder;
    }));

    if (usePagination) {
      const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM orders');
      const total = countResult.rows[0]?.count || 0;
      res.json({ data: orders, page: pageParam, limit: limitParam, total });
    } else {
      res.json(orders);
    }
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};
// POST /api/orders
export const createOrder = async (req: Request, res: Response) => {
  
  const orderData = req.body;
  
  try {
    const orderId = String(orderData.id || '');
    const normalizedStatus = normalizeStatus(orderData.status);
    if (!VALID_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Start transaction
    await pool.query('BEGIN');

    const isDraft = normalizedStatus === 'Draft';
    const taxRate = await getTaxRate();
    const taxValue = Math.max(0, parseNumber(orderData.subtotal) * taxRate);
    if (!isDraft) {
      await adjustInventoryForOrderItems(orderData.items, 'deduct');
    }

    // Create the order
    const orderResult = await pool.query(
      `INSERT INTO orders (
        id, buyer_id, date, status, payment_terms, created_by,
        subtotal, tax, total, amount_paid, payment_status, history, stock_deducted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        orderId,
        orderData.buyerId,
        orderData.date,
        normalizedStatus,
        orderData.paymentTerms,
        orderData.createdBy,
        orderData.subtotal,
        taxValue,
        orderData.total,
        orderData.amountPaid,
        orderData.paymentStatus,
        JSON.stringify(orderData.history || []),
        !isDraft
      ]
    );

    // Insert order items
    for (const item of orderData.items) {
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_order, picked)
         VALUES ($1, $2, $3, $4, false)`,
        [orderId, item.productId, item.quantity, item.priceAtOrder]
      );
    }

    await appendOrderHistory(orderId, {
      status: normalizedStatus,
      date: new Date().toLocaleString(),
      note: isDraft ? 'Draft created' : 'Order created'
    });

    if (!isDraft && orderData.createdBy === 'buyer') {
      await createNotification(
        'Order',
        'New Order Received',
        `Order #${orderId.split('-').pop()} received from buyer.`,
        'medium',
        'seller',
        orderId
      );
    }

    await logActivity(
      req,
      'Create Order',
      'Orders',
      `Order #${orderId.split('-').pop()} created. Status: ${normalizedStatus}.`
    );

    await pool.query('COMMIT');
    res.status(201).json(orderResult.rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Create order error:', err);
    let errorMessage = 'Failed to create order';
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    res.status(500).json({ error: errorMessage });
  }
};

// PUT /api/orders/:id
export const updateOrder = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const orderData = req.body;

  try {
    const normalizedStatus = normalizeStatus(orderData.status);
    if (!VALID_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const taxRate = await getTaxRate();
    const taxValue = Math.max(0, parseNumber(orderData.subtotal) * taxRate);

    await pool.query('BEGIN');

    const currentOrderResult = await pool.query(
      'SELECT status, stock_deducted, history FROM orders WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (currentOrderResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentOrder = currentOrderResult.rows[0];
    const currentItems = await getOrderItems(id);

    const oldStatus = normalizeStatus(currentOrder.status);
    const newStatus = normalizedStatus;

    // Draft or non-deducting statuses should never keep stock deducted
    if (!shouldDeductStock(newStatus)) {
      if (currentOrder.stock_deducted) {
        await adjustInventoryForOrderItems(currentItems, 'restore');
        currentOrder.stock_deducted = false;
      }
    } else {
      // Deducting statuses
      if (!currentOrder.stock_deducted) {
        // Transition from non-deducting -> deducting
        await adjustInventoryForOrderItems(orderData.items, 'deduct');
        currentOrder.stock_deducted = true;
      } else {
        // Already deducted, apply per-item deltas
        const oldMap: Record<string, number> = {};
        const newMap: Record<string, number> = {};

        currentItems.forEach(i => { oldMap[i.productId] = (oldMap[i.productId] || 0) + i.quantity; });
        orderData.items.forEach((i: any) => { newMap[i.productId] = (newMap[i.productId] || 0) + i.quantity; });

        const productIds = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
        for (const productId of productIds) {
          const delta = (newMap[productId] || 0) - (oldMap[productId] || 0);
          if (delta > 0) {
            await adjustInventoryForItem(productId, delta, 'deduct');
          } else if (delta < 0) {
            await adjustInventoryForItem(productId, Math.abs(delta), 'restore');
          }
        }
      }
    }

    // Update order
    await pool.query(
      `UPDATE orders SET 
        buyer_id = $1, date = $2, status = $3, payment_terms = $4,
        subtotal = $5, tax = $6, total = $7, amount_paid = $8,
        payment_status = $9, history = $10, stock_deducted = $11, updated_at = CURRENT_TIMESTAMP
       WHERE id = $12`,
      [
        orderData.buyerId,
        orderData.date,
        normalizedStatus,
        orderData.paymentTerms,
        orderData.subtotal,
        taxValue,
        orderData.total,
        orderData.amountPaid,
        orderData.paymentStatus,
        JSON.stringify(currentOrder.history || []),
        currentOrder.stock_deducted,
        id
      ]
    );

    // Delete existing order items and insert new ones
    await pool.query('DELETE FROM order_items WHERE order_id = $1', [id]);
    
    for (const item of orderData.items) {
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_order, picked)
         VALUES ($1, $2, $3, $4, false)`,
        [id, item.productId, item.quantity, item.priceAtOrder]
      );
    }

    await appendOrderHistory(id, {
      status: normalizedStatus,
      date: new Date().toLocaleString(),
      note: `Order updated (from ${oldStatus} to ${newStatus})`
    });

    await logActivity(
      req,
      'Update Order',
      'Orders',
      `Order #${id.split('-').pop()} updated. Status: ${normalizedStatus}.`
    );

    const result = await pool.query(
      `SELECT
         o.*,
         u.company_name AS "buyerCompanyName",
         u.name AS "buyerName",
         u.phone AS "buyerPhone",
         u.email AS "buyerEmail",
         u.address AS "buyerAddress"
       FROM orders o
       LEFT JOIN users u ON u.id = o.buyer_id
       WHERE o.id = $1`,
      [id]
    );
    
    // Process the returned order to ensure numeric types
    const processedOrder = {
      id: result.rows[0].id,
      buyerId: result.rows[0].buyer_id,
      date: result.rows[0].date,
      status: normalizeStatus(result.rows[0].status),
      subtotal: parseNumber(result.rows[0].subtotal),
      tax: parseNumber(result.rows[0].tax),
      total: parseNumber(result.rows[0].total),
      amountPaid: parseNumber(result.rows[0].amount_paid),
      paymentStatus: result.rows[0].payment_status,
      paymentTerms: result.rows[0].payment_terms,
      createdBy: result.rows[0].created_by,
      buyerCompanyName: result.rows[0].buyerCompanyName || null,
      buyerName: result.rows[0].buyerName || null,
      buyerPhone: result.rows[0].buyerPhone || null,
      buyerEmail: result.rows[0].buyerEmail || null,
      buyerAddress: result.rows[0].buyerAddress || null,
      stockDeducted: Boolean(result.rows[0].stock_deducted),
      history: result.rows[0].history || [],
      items: [] // Items will be fetched separately in getOrderById
    };

    await pool.query('COMMIT');
    res.json(processedOrder);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Update order error:', err);
    res.status(500).json({ error: 'Failed to update order' });
  }
};

// PATCH /api/orders/:id/status
export const updateOrderStatus = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  const { status, note } = req.body;
  const normalizedStatus = normalizeStatus(status);

  // Validate status
  if (!VALID_STATUSES.includes(normalizedStatus)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    // Get current order to update history
    const currentOrder = await pool.query(
      'SELECT history, status, stock_deducted FROM orders WHERE id = $1',
      [id]
    );

    if (currentOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentHistory = currentOrder.rows[0].history || [];
    const currentStatus = currentOrder.rows[0].status;
    const stockDeducted = Boolean(currentOrder.rows[0].stock_deducted);
    const newHistoryEntry = {
      status: normalizedStatus,
      date: new Date().toLocaleString(),
      note: note || ''
    };

    const updatedHistory = [...currentHistory, newHistoryEntry];

    const items = await getOrderItems(id);

    if (shouldDeductStock(normalizedStatus) && !stockDeducted) {
      await adjustInventoryForOrderItems(items, 'deduct');
    } else if (shouldRestoreStock(normalizedStatus) && stockDeducted) {
      await adjustInventoryForOrderItems(items, 'restore');
    }

    const newStockDeducted = shouldDeductStock(normalizedStatus)
      ? true
      : shouldRestoreStock(normalizedStatus)
        ? false
        : stockDeducted;

    // Update order status and history
    await pool.query(
      `UPDATE orders SET 
        status = $1, 
        history = $2,
        stock_deducted = $3,
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING *`,
      [normalizedStatus, JSON.stringify(updatedHistory), newStockDeducted, id]
    );

    const result = await pool.query(
      `SELECT
         o.*,
         u.company_name AS "buyerCompanyName",
         u.name AS "buyerName",
         u.phone AS "buyerPhone",
         u.email AS "buyerEmail",
         u.address AS "buyerAddress"
       FROM orders o
       LEFT JOIN users u ON u.id = o.buyer_id
       WHERE o.id = $1`,
      [id]
    );

    await logActivity(
      req,
      'Update Order Status',
      'Orders',
      `Order #${id.split('-').pop()} changed from ${currentStatus} to ${normalizedStatus}.`
    );

    // Process the returned order to ensure numeric types
    const processedOrder = {
      id: result.rows[0].id,
      buyerId: result.rows[0].buyer_id,
      date: result.rows[0].date,
      status: normalizeStatus(result.rows[0].status),
      subtotal: parseNumber(result.rows[0].subtotal),
      tax: parseNumber(result.rows[0].tax),
      total: parseNumber(result.rows[0].total),
      amountPaid: parseNumber(result.rows[0].amount_paid),
      paymentStatus: result.rows[0].payment_status,
      paymentTerms: result.rows[0].payment_terms,
      createdBy: result.rows[0].created_by,
      buyerCompanyName: result.rows[0].buyerCompanyName || null,
      buyerName: result.rows[0].buyerName || null,
      buyerPhone: result.rows[0].buyerPhone || null,
      buyerEmail: result.rows[0].buyerEmail || null,
      buyerAddress: result.rows[0].buyerAddress || null,
      stockDeducted: Boolean(result.rows[0].stock_deducted),
      history: result.rows[0].history || []
    };

    res.json(processedOrder);
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  const id = getParam(req.params.id);
  
  try {
    // Get order details
    const orderResult = await pool.query(
      `SELECT
         o.*,
         u.company_name AS "buyerCompanyName",
         u.name AS "buyerName",
         u.phone AS "buyerPhone",
         u.email AS "buyerEmail",
         u.address AS "buyerAddress"
       FROM orders o
       LEFT JOIN users u ON u.id = o.buyer_id
       WHERE o.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (!order.buyer_id) {
      return res.status(400).json({ error: 'Order has invalid buyer reference' });
    }

    // Get order items
    const items = await getOrderItems(id);

    // Process order with proper numeric types
    const processedOrder = {
      id: order.id,
      buyerId: order.buyer_id,
      date: order.date,
      status: normalizeStatus(order.status),
      subtotal: parseNumber(order.subtotal),
      tax: parseNumber(order.tax),
      total: parseNumber(order.total),
      amountPaid: parseNumber(order.amount_paid),
      paymentStatus: order.payment_status,
      paymentTerms: order.payment_terms,
      createdBy: order.created_by,
      buyerCompanyName: order.buyerCompanyName || null,
      buyerName: order.buyerName || null,
      buyerPhone: order.buyerPhone || null,
      buyerEmail: order.buyerEmail || null,
      buyerAddress: order.buyerAddress || null,
      stockDeducted: Boolean(order.stock_deducted),
      history: order.history || [],
      items
    };

    res.json(processedOrder);
  } catch (err) {
    console.error('Get order by ID error:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

// GET /api/orders/draft
export const getMyDraftOrder = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (user.role !== 'R-BUYER') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    const draftResult = await pool.query(
      `SELECT
         o.*,
         u.company_name AS "buyerCompanyName",
         u.name AS "buyerName",
         u.phone AS "buyerPhone",
         u.email AS "buyerEmail",
         u.address AS "buyerAddress"
       FROM orders o
       LEFT JOIN users u ON u.id = o.buyer_id
       WHERE o.buyer_id = $1 AND o.status = 'Draft'
       ORDER BY o.date DESC, o.updated_at DESC
       LIMIT 1`,
      [user.userId]
    );

    if (draftResult.rows.length === 0) {
      return res.json(null);
    }

    const order = draftResult.rows[0];
    const items = await getOrderItems(order.id);

    const processedOrder = {
      id: order.id,
      buyerId: order.buyer_id,
      date: order.date,
      status: normalizeStatus(order.status),
      subtotal: parseNumber(order.subtotal),
      tax: parseNumber(order.tax),
      total: parseNumber(order.total),
      amountPaid: parseNumber(order.amount_paid),
      paymentStatus: order.payment_status,
      paymentTerms: order.payment_terms,
      createdBy: order.created_by,
      buyerCompanyName: order.buyerCompanyName || null,
      buyerName: order.buyerName || null,
      buyerPhone: order.buyerPhone || null,
      buyerEmail: order.buyerEmail || null,
      buyerAddress: order.buyerAddress || null,
      stockDeducted: Boolean(order.stock_deducted),
      history: order.history || [],
      items
    };

    res.json(processedOrder);
  } catch (err) {
    console.error('Get draft order error:', err);
    res.status(500).json({ error: 'Failed to fetch draft order' });
  }
};

// PUT /api/orders/draft
export const upsertDraftOrder = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (user.role !== 'R-BUYER') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  type DraftItem = { productId: string; quantity: number };
  const itemsInput: any[] = Array.isArray(req.body?.items) ? req.body.items : [];
  const items: DraftItem[] = itemsInput
    .map((i: any): DraftItem => ({
      productId: String(i.productId || ''),
      quantity: parseInteger(i.quantity)
    }))
    .filter((item: DraftItem) => item.productId && item.quantity > 0);

  try {
    await pool.query('BEGIN');

    const draftResult = await pool.query(
      `SELECT id FROM orders
       WHERE buyer_id = $1 AND status = 'Draft'
       ORDER BY date DESC, updated_at DESC
       LIMIT 1
       FOR UPDATE`,
      [user.userId]
    );

    const draftId = draftResult.rows[0]?.id as string | undefined;

    if (items.length === 0) {
      if (draftId) {
        await pool.query('DELETE FROM order_items WHERE order_id = $1', [draftId]);
        await pool.query('DELETE FROM orders WHERE id = $1', [draftId]);
      }
      await pool.query('COMMIT');
      return res.json({ message: 'Draft cleared' });
    }

    const productIds = items.map((item: DraftItem) => item.productId);
    const productResult = await pool.query(
      `SELECT id, price FROM products WHERE id = ANY($1::text[])`,
      [productIds]
    );

    const priceMap = new Map<string, number>();
    productResult.rows.forEach((row: any) => {
      priceMap.set(row.id, parseNumber(row.price));
    });

    for (const item of items) {
      if (!priceMap.has(item.productId)) {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid product ${item.productId}` });
      }
    }

    const subtotal = items.reduce((sum: number, item: DraftItem) => {
      return sum + (priceMap.get(item.productId) || 0) * item.quantity;
    }, 0);
    const taxRate = await getTaxRate();
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    const orderId = draftId || `DRAFT-${Date.now().toString().slice(-6)}`;
    if (!draftId) {
      await pool.query(
        `INSERT INTO orders (
          id, buyer_id, date, status, payment_terms, created_by,
          subtotal, tax, total, amount_paid, payment_status, history, stock_deducted
        ) VALUES ($1, $2, CURRENT_DATE, 'Draft', NULL, 'buyer', $3, $4, $5, 0, 'Unpaid', '[]'::jsonb, false)`,
        [orderId, user.userId, subtotal, tax, total]
      );
    } else {
      await pool.query(
        `UPDATE orders SET
          date = CURRENT_DATE,
          status = 'Draft',
          subtotal = $1,
          tax = $2,
          total = $3,
          amount_paid = 0,
          payment_status = 'Unpaid',
          stock_deducted = false,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [subtotal, tax, total, orderId]
      );
    }

    await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
    for (const item of items) {
      const priceAtOrder = priceMap.get(item.productId) || 0;
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_order, picked)
         VALUES ($1, $2, $3, $4, false)`,
        [orderId, item.productId, item.quantity, priceAtOrder]
      );
    }

    await pool.query('COMMIT');
    res.json({ id: orderId, status: 'Draft' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Upsert draft order error:', err);
    res.status(500).json({ error: 'Failed to save draft order' });
  }
};
// PATCH /api/orders/:orderId/items/:itemId/pick
export const updateOrderItemPicked = async (req: Request, res: Response) => {
  const orderId = getParam(req.params.orderId);
  const itemId = getParam(req.params.itemId);
  const { picked } = req.body;

  try {
    // Remove updated_at from the query
    const result = await pool.query(
      `UPDATE order_items 
       SET picked = $1 
       WHERE id = $2 AND order_id = $3 
       RETURNING *`,
      [picked, itemId, orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order item not found' });
    }

    // Check if order status should be updated from Pending to Processing
    if (picked) {
      const orderResult = await pool.query(
        'SELECT status FROM orders WHERE id = $1',
        [orderId]
      );
      
      if (normalizeStatus(orderResult.rows[0].status) === 'Pending') {
        await pool.query(
          'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['Processing', orderId]
        );

        await appendOrderHistory(orderId, {
          status: 'Processing',
          date: new Date().toLocaleString(),
          note: 'First item picked - moved to processing'
        });
      }
    }

    await logActivity(
      req,
      'Update Order Item',
      'Orders',
      `Order ${orderId} item ${itemId} picked=${picked}.`
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update order item picked error:', err);
    res.status(500).json({ error: 'Failed to update item picked status' });
  }
};

// GET /api/orders/metrics/inventory-turnover
export const getInventoryTurnoverMetrics = async (req: Request, res: Response) => {
  try {
    const stockResult = await pool.query(
      `SELECT
         COALESCE(SUM(
           COALESCE(stock_main_warehouse, 0) +
           COALESCE(stock_back_room, 0) +
           COALESCE(stock_show_room, 0)
         ), 0)::float AS current_stock_units
       FROM products`
    );

    const soldResult = await pool.query(
      `SELECT COALESCE(SUM(oi.quantity), 0)::float AS sold_units
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE UPPER(o.status) = 'DELIVERED'`
    );

    const trendResult = await pool.query(
      `WITH months AS (
         SELECT generate_series(
           date_trunc('month', CURRENT_DATE) - interval '5 months',
           date_trunc('month', CURRENT_DATE),
           interval '1 month'
         ) AS month_start
       )
       SELECT
         TO_CHAR(m.month_start, 'Mon YY') AS label,
         COALESCE(SUM(oi.quantity), 0)::float AS sold_units
       FROM months m
       LEFT JOIN orders o
         ON date_trunc('month', o.date::timestamp) = m.month_start
        AND UPPER(o.status) = 'DELIVERED'
       LEFT JOIN order_items oi ON oi.order_id = o.id
       GROUP BY m.month_start
       ORDER BY m.month_start ASC`
    );

    const currentStockUnits = Number(stockResult.rows[0]?.current_stock_units || 0);
    const soldUnits = Number(soldResult.rows[0]?.sold_units || 0);
    const turnover = currentStockUnits > 0 ? soldUnits / currentStockUnits : 0;

    const trend = trendResult.rows.map((row: any) => {
      const monthSoldUnits = Number(row.sold_units || 0);
      return {
        name: row.label,
        val: currentStockUnits > 0 ? monthSoldUnits / currentStockUnits : 0
      };
    });

    res.json({
      turnover,
      currentStockUnits,
      soldUnits,
      trend
    });
  } catch (err) {
    console.error('Get inventory turnover metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch inventory turnover metrics' });
  }
};
