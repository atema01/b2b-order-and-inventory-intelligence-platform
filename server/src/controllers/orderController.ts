// src/controllers/orderController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { logActivity } from '../utils/activityLog';
import { runFbProphetForecast, ProphetFrequency } from '../services/fbProphetService';
import { createNotificationRecord } from '../services/notificationService';
import { emitCreditChanged, emitInventoryChanged, emitOrderChanged, emitPaymentChanged } from '../services/realtime';

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
    }

    await emitProductInventorySnapshot(productId);
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

const generateEntityId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

const VALID_STATUSES = [
  'Draft',
  'On Review',
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
  ON_REVIEW: 'On Review',
  'ON REVIEW': 'On Review',
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

const emitProductInventorySnapshot = async (productId: string) => {
  const result = await pool.query(
    `SELECT id, status, stock_main_warehouse, stock_back_room, stock_show_room
     FROM products
     WHERE id = $1`,
    [productId]
  );

  if (result.rows.length === 0) return;

  const row = result.rows[0];
  const mainWarehouse = parseInteger(row.stock_main_warehouse);
  const backRoom = parseInteger(row.stock_back_room);
  const showRoom = parseInteger(row.stock_show_room);

  emitInventoryChanged({
    productId: row.id,
    status: row.status,
    stock: {
      mainWarehouse,
      backRoom,
      showRoom,
      total: mainWarehouse + backRoom + showRoom
    }
  });
};

const FORECAST_ELIGIBLE_STATUSES = new Set([
  'Pending',
  'Processing',
  'Shipped',
  'Delivered',
  'Undelivered'
]);

type ForecastModel = 'holt-winters' | 'fb-prophet';

const getStartOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
};

const getStartOfMonth = (date: Date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const holtWintersForecast = (
  data: number[],
  seasonLength: number,
  alpha: number = 0.3,
  beta: number = 0.1,
  gamma: number = 0.1,
  forecastLength: number
) => {
  if (data.length < seasonLength * 2) return [];

  const clean = data.map((v) => (Number.isFinite(v) ? Math.max(0, v) : 0));
  const zeroRatio = clean.filter((v) => v === 0).length / clean.length;

  if (zeroRatio > 0.6) {
    const window = Math.min(6, clean.length);
    const recent = clean.slice(-window);
    const prev = clean.slice(-(window * 2), -window);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / Math.max(1, recent.length);
    const prevAvg = prev.length > 0 ? prev.reduce((a, b) => a + b, 0) / prev.length : recentAvg;
    const trend = (recentAvg - prevAvg) * 0.35;
    const cap = Math.max(1, recentAvg * 3);

    return Array.from({ length: forecastLength }, (_, i) => {
      const val = recentAvg + trend * (i + 1);
      return Math.max(0, Math.min(cap, val));
    });
  }

  const firstSeason = clean.slice(0, seasonLength);
  const secondSeason = clean.slice(seasonLength, seasonLength * 2);
  const avg1 = firstSeason.reduce((a, b) => a + b, 0) / seasonLength;
  const avg2 = secondSeason.reduce((a, b) => a + b, 0) / seasonLength;

  let level = avg1;
  let trend = (avg2 - avg1) / seasonLength;
  const seasonals = new Array(clean.length).fill(0);

  for (let i = 0; i < seasonLength; i++) {
    seasonals[i] = clean[i] - avg1;
  }

  for (let t = seasonLength; t < clean.length; t++) {
    const y = clean[t];
    const prevLevel = level;
    const prevSeason = seasonals[t - seasonLength] ?? 0;

    level = alpha * (y - prevSeason) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    seasonals[t] = gamma * (y - level) + (1 - gamma) * prevSeason;
  }

  const recentAvg =
    clean.slice(-Math.min(6, clean.length)).reduce((a, b) => a + b, 0) / Math.min(6, clean.length);
  const cap = Math.max(1, recentAvg * 4);

  const forecasts: number[] = [];
  for (let m = 1; m <= forecastLength; m++) {
    const sIdx = clean.length - seasonLength + ((m - 1) % seasonLength);
    const seasonal = seasonals[sIdx] ?? 0;
    const value = level + m * trend + seasonal;
    forecasts.push(Math.max(0, Math.min(cap, value)));
  }

  return forecasts;
};

const buildDemandForecastPayload = (
  model: ForecastModel,
  orders: Array<{ date: string; total: number; items: Array<{ productId: string; quantity: number }> }>,
  productId?: string
): Promise<{
  chartData: Array<{ name: string; hist: number | null; fc: number | null }>;
  message: string;
  hasSufficientData: boolean;
  timeResolution: 'Day' | 'Week' | 'Month';
  modelRequested: ForecastModel;
  modelUsed: ForecastModel;
}> => (async () => {
  if (productId) {
    orders = orders.filter((order) => order.items.some((item) => item.productId === productId));
  }

  if (orders.length === 0) {
    return {
      chartData: [{ name: 'No Data', hist: 0, fc: null }],
      message: productId ? 'No order history found for this product.' : 'No sales data available.',
      hasSufficientData: false,
      timeResolution: 'Month',
      modelRequested: model,
      modelUsed: model
    };
  }

  const timestamps = orders.map((o) => new Date(o.date).getTime()).filter((t) => !Number.isNaN(t));
  if (timestamps.length === 0) {
    return {
      chartData: [{ name: 'No Data', hist: 0, fc: null }],
      message: productId ? 'No valid date history found for this product.' : 'No sales data available.',
      hasSufficientData: false,
      timeResolution: 'Month',
      modelRequested: model,
      modelUsed: model
    };
  }

  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const startDate = new Date(minTime);
  const endDate = new Date(maxTime);

  const buildTimelineForMode = (mode: 'daily' | 'weekly' | 'monthly') => {
    const aggregatedUnits: Record<string, number> = {};
    const getKey = (d: Date) => {
      if (mode === 'daily') return d.toISOString().split('T')[0];
      if (mode === 'weekly') return getStartOfWeek(d).toISOString().split('T')[0];
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    orders.forEach((order) => {
      const dateObj = new Date(order.date);
      if (Number.isNaN(dateObj.getTime())) return;
      const key = getKey(dateObj);
      const qty = productId
        ? order.items
            .filter((item) => item.productId === productId)
            .reduce((sum, item) => sum + item.quantity, 0)
        : order.items.reduce((sum, item) => sum + item.quantity, 0);
      aggregatedUnits[key] = (aggregatedUnits[key] || 0) + qty;
    });

    const timelineData: Array<{ date: Date; units: number }> = [];
    let current =
      mode === 'daily'
        ? getStartOfDay(startDate)
        : mode === 'weekly'
          ? getStartOfWeek(startDate)
          : getStartOfMonth(startDate);

    let loopGuard = 0;
    while (current <= endDate && loopGuard < 1000) {
      const key = getKey(current);
      timelineData.push({
        date: new Date(current),
        units: aggregatedUnits[key] || 0
      });
      if (mode === 'daily') current.setDate(current.getDate() + 1);
      else if (mode === 'weekly') current.setDate(current.getDate() + 7);
      else current.setMonth(current.getMonth() + 1);
      loopGuard++;
    }

    let seasonLength = 12;
    let forecastLength = 6;
    let timeResolution: 'Day' | 'Week' | 'Month' = 'Month';
    if (mode === 'daily') {
      seasonLength = 7;
      forecastLength = 7;
      timeResolution = 'Day';
    } else if (mode === 'weekly') {
      seasonLength = 4;
      forecastLength = 8;
      timeResolution = 'Week';
    }

    return {
      mode,
      seasonLength,
      forecastLength,
      timeResolution,
      timelineData
    };
  };

  const candidates = [
    buildTimelineForMode('daily'),
    buildTimelineForMode('weekly'),
    buildTimelineForMode('monthly')
  ];

  const selectedCandidate =
    candidates.find((candidate) => candidate.timelineData.length >= candidate.seasonLength * 2) ||
    [...candidates].reverse().find((candidate) => candidate.timelineData.length > 0) ||
    candidates[0];

  const { mode, seasonLength, forecastLength, timeResolution, timelineData } = selectedCandidate;

  const historyValues = timelineData.map((d) => d.units);
  const hasSufficientData = historyValues.length >= seasonLength * 2;
  const message = hasSufficientData
    ? `Projecting demand by ${timeResolution} (Holt-Winters)`
    : `Data accumulation in progress. Need ${seasonLength * 2} ${timeResolution.toLowerCase()}s (Have ${historyValues.length}).`;

  let modelUsed: ForecastModel = model;
  let forecastedValues: number[] = [];
  let fallbackNote = '';

  if (hasSufficientData) {
    if (model === 'fb-prophet') {
      try {
        const frequency: ProphetFrequency = mode === 'daily' ? 'D' : mode === 'weekly' ? 'W-MON' : 'MS';
        const prophetResult = await runFbProphetForecast({
          history: timelineData.map((point) => ({
            ds: point.date.toISOString().slice(0, 10),
            y: point.units
          })),
          periods: forecastLength,
          frequency
        });
        forecastedValues = prophetResult.forecast;
      } catch (err) {
        modelUsed = 'holt-winters';
        fallbackNote = err instanceof Error ? err.message : 'FB Prophet is unavailable.';
        forecastedValues = holtWintersForecast(historyValues, seasonLength, 0.3, 0.1, 0.1, forecastLength);
      }
    } else {
      forecastedValues = holtWintersForecast(historyValues, seasonLength, 0.3, 0.1, 0.1, forecastLength);
    }
  }

  const formatLabel = (d: Date) => {
    if (mode === 'daily') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (mode === 'weekly') return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const chartData: Array<{ name: string; hist: number | null; fc: number | null }> = timelineData.map((point) => ({
    name: formatLabel(point.date),
    hist: point.units,
    fc: null
  }));

  if (hasSufficientData && forecastedValues.length > 0 && timelineData.length > 0) {
    const lastDate = new Date(timelineData[timelineData.length - 1].date);
    for (let i = 0; i < forecastedValues.length; i++) {
      if (mode === 'daily') lastDate.setDate(lastDate.getDate() + 1);
      else if (mode === 'weekly') lastDate.setDate(lastDate.getDate() + 7);
      else lastDate.setMonth(lastDate.getMonth() + 1);
      chartData.push({
        name: formatLabel(lastDate),
        hist: null,
        fc: Math.round(forecastedValues[i])
      });
    }
  }

  return {
    chartData: chartData.length > 0 ? chartData : [{ name: 'No Data', hist: 0, fc: null }],
    message: hasSufficientData
      ? modelUsed === 'fb-prophet'
        ? `Projecting demand by ${timeResolution} (FB Prophet)`
        : model === 'fb-prophet' && fallbackNote
          ? `FB Prophet is unavailable on this server. Falling back to Holt-Winters. ${fallbackNote}`
          : `Projecting demand by ${timeResolution} (Holt-Winters)`
      : message,
    hasSufficientData,
    timeResolution,
    modelRequested: model,
    modelUsed
  };
})();

// System logs disabled; user-initiated logs use logActivity

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
    const deductStock = shouldDeductStock(normalizedStatus);
    const taxRate = await getTaxRate();
    const taxValue = Math.max(0, parseNumber(orderData.subtotal) * taxRate);
    if (deductStock) {
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
        deductStock
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
      await createNotificationRecord(
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
    emitOrderChanged({
      action: 'created',
      orderId,
      buyerId: String(orderData.buyerId || ''),
      status: normalizedStatus
    });
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

// POST /api/orders/checkout
// Convert a buyer draft into a live order only after payment proof is submitted.
export const checkoutDraftOrderWithPayment = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (user.role !== 'R-BUYER') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const draftId = String(req.body?.draftId || '').trim();
  const payment = req.body?.payment || {};
  const payAmount = parseNumber(payment.amount);
  const method = String(payment.method || '').trim();

  if (!draftId) {
    return res.status(400).json({ error: 'draftId is required' });
  }
  if (!method) {
    return res.status(400).json({ error: 'Payment method is required' });
  }
  if (payAmount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be greater than zero' });
  }
  if (!Number.isFinite(payAmount)) {
    return res.status(400).json({ error: 'Payment amount must be a valid number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const draftResult = await client.query(
      `SELECT id, buyer_id, date, subtotal, tax, total, payment_terms, created_by
       FROM orders
       WHERE id = $1 AND buyer_id = $2 AND status = 'Draft'
       FOR UPDATE`,
      [draftId, user.userId]
    );

    if (draftResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Draft order not found' });
    }

    const draft = draftResult.rows[0];
    const total = parseNumber(draft.total);
    if (payAmount > total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Payment cannot exceed order total of ${total}` });
    }

    const draftItemsResult = await client.query(
      `SELECT product_id AS "productId", quantity, price_at_order AS "priceAtOrder"
       FROM order_items
       WHERE order_id = $1`,
      [draftId]
    );

    if (draftItemsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Draft order has no items' });
    }

    const orderId = generateEntityId('ORD');
    const paymentId = generateEntityId('PAY');
    const historyEntry = {
      status: 'On Review',
      date: new Date().toLocaleString(),
      note: 'Payment submitted. Awaiting seller verification.'
    };

    await client.query(
      `INSERT INTO orders (
        id, buyer_id, date, status, payment_terms, created_by,
        subtotal, tax, total, amount_paid, payment_status, history, stock_deducted
      ) VALUES ($1, $2, CURRENT_DATE, 'On Review', $3, 'buyer', $4, $5, $6, 0, 'Unpaid', $7, false)`,
      [
        orderId,
        draft.buyer_id,
        draft.payment_terms || null,
        parseNumber(draft.subtotal),
        parseNumber(draft.tax),
        total,
        JSON.stringify([historyEntry])
      ]
    );

    for (const item of draftItemsResult.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_order, picked)
         VALUES ($1, $2, $3, $4, false)`,
        [orderId, item.productId, parseInteger(item.quantity), parseNumber(item.priceAtOrder)]
      );
    }

    await client.query(
      `INSERT INTO payments (
        id, order_id, buyer_id, credit_request_id, amount, method, reference_id, proof_image, status, notes, date_time
      ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, 'Pending Review', $8, NOW())`,
      [
        paymentId,
        orderId,
        draft.buyer_id,
        payAmount,
        method,
        payment.referenceId || null,
        payment.proofImage || null,
        payment.notes || null
      ]
    );

    await client.query('DELETE FROM orders WHERE id = $1', [draftId]);

    await logActivity(
      req,
      'Checkout Draft Order',
      'Orders',
      `Draft #${draftId.split('-').pop()} checked out as order #${orderId.split('-').pop()} with payment ${paymentId}.`
    );

    await createNotificationRecord(
      'Payment',
      'Payment Proof Submitted',
      `Order #${orderId.split('-').pop()} is awaiting payment verification.`,
      'medium',
      'seller',
      paymentId
    );

    await client.query('COMMIT');

    emitOrderChanged({
      action: 'created',
      orderId,
      buyerId: String(draft.buyer_id),
      status: 'On Review'
    });

    emitPaymentChanged({
      action: 'created',
      paymentId,
      orderId,
      buyerId: String(draft.buyer_id),
      status: 'Pending Review'
    });

    return res.status(201).json({
      orderId,
      paymentId,
      status: 'On Review'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Checkout draft order error:', err);
    return res.status(500).json({ error: 'Failed to checkout draft order' });
  } finally {
    client.release();
  }
};

// POST /api/orders/checkout-with-credit
// Convert draft to live order on review, attach credit request, and optional upfront payment proof.
export const checkoutDraftOrderWithCredit = async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (user.role !== 'R-BUYER') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const draftId = String(req.body?.draftId || '').trim();
  const creditRequest = req.body?.creditRequest || {};
  const payment = req.body?.payment || {};

  const requestedCredit = parseNumber(creditRequest.amount);
  const paymentTerms = String(creditRequest.paymentTerms || '').trim();
  const reason = String(creditRequest.reason || '').trim();
  const notes = String(creditRequest.notes || '').trim();
  const paymentMethod = String(payment.method || '').trim();
  const paymentAmount = parseNumber(payment.amount);

  if (!draftId) {
    return res.status(400).json({ error: 'draftId is required' });
  }
  if (requestedCredit <= 0) {
    return res.status(400).json({ error: 'Credit amount must be greater than zero' });
  }
  if (!reason) {
    return res.status(400).json({ error: 'Credit reason is required' });
  }
  if (!['Net 15', 'Net 30'].includes(paymentTerms)) {
    return res.status(400).json({ error: 'paymentTerms must be Net 15 or Net 30' });
  }
  if (notes.length > 1000) {
    return res.status(400).json({ error: 'Notes cannot exceed 1000 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const draftResult = await client.query(
      `SELECT id, buyer_id, subtotal, tax, total, payment_terms
       FROM orders
       WHERE id = $1 AND buyer_id = $2 AND status = 'Draft'
       FOR UPDATE`,
      [draftId, user.userId]
    );

    if (draftResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Draft order not found' });
    }

    const draft = draftResult.rows[0];
    const total = parseNumber(draft.total);
    if (requestedCredit > total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Credit amount cannot exceed order total' });
    }

    const requiredUpfrontPayment = Math.max(0, Number((total - requestedCredit).toFixed(2)));
    const isFullCredit = requiredUpfrontPayment <= 0;

    if (!isFullCredit) {
      if (!paymentMethod) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Payment method is required for partial credit checkout' });
      }
    if (paymentAmount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment amount must be greater than zero for partial credit checkout' });
    }
    if (!Number.isFinite(paymentAmount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Payment amount must be a valid number for partial credit checkout' });
    }
      if (Math.abs(paymentAmount - requiredUpfrontPayment) > 0.01) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Payment amount must match remaining upfront amount (${requiredUpfrontPayment})` });
      }
      if (!payment.referenceId && !payment.proofImage) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Provide at least a payment reference or proof image for partial credit checkout' });
      }
    }

    const draftItemsResult = await client.query(
      `SELECT product_id AS "productId", quantity, price_at_order AS "priceAtOrder"
       FROM order_items
       WHERE order_id = $1`,
      [draftId]
    );

    if (draftItemsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Draft order has no items' });
    }

    const orderId = generateEntityId('ORD');
    const creditId = generateEntityId('CR');
    const paymentId = isFullCredit ? null : generateEntityId('PAY');

    const historyEntry = {
      status: 'On Review',
      date: new Date().toLocaleString(),
      note: isFullCredit
        ? 'Order submitted with full credit request. Awaiting credit approval.'
        : 'Order submitted with partial credit request and upfront payment proof. Awaiting review.'
    };

    await client.query(
      `INSERT INTO orders (
        id, buyer_id, date, status, payment_terms, created_by,
        subtotal, tax, total, amount_paid, payment_status, history, stock_deducted
      ) VALUES ($1, $2, CURRENT_DATE, 'On Review', $3, 'buyer', $4, $5, $6, 0, 'Unpaid', $7, false)`,
      [
        orderId,
        draft.buyer_id,
        draft.payment_terms || null,
        parseNumber(draft.subtotal),
        parseNumber(draft.tax),
        total,
        JSON.stringify([historyEntry])
      ]
    );

    for (const item of draftItemsResult.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_order, picked)
         VALUES ($1, $2, $3, $4, false)`,
        [orderId, item.productId, parseInteger(item.quantity), parseNumber(item.priceAtOrder)]
      );
    }

    await client.query(
      `INSERT INTO credit_requests (
         id, buyer_id, order_id, amount, reason, payment_terms, status, request_date, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, 'Pending', CURRENT_DATE, $7)`,
      [
        creditId,
        draft.buyer_id,
        orderId,
        requestedCredit,
        reason,
        paymentTerms,
        notes || null
      ]
    );

    if (!isFullCredit && paymentId) {
      await client.query(
        `INSERT INTO payments (
          id, order_id, buyer_id, credit_request_id, amount, method, reference_id, proof_image, status, notes, date_time
        ) VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, 'Pending Review', $8, NOW())`,
        [
          paymentId,
          orderId,
          draft.buyer_id,
          paymentAmount,
          paymentMethod,
          payment.referenceId || null,
          payment.proofImage || null,
          payment.notes || null
        ]
      );
    }

    await client.query('DELETE FROM orders WHERE id = $1', [draftId]);

    await logActivity(
      req,
      'Checkout Draft With Credit',
      'Orders',
      `Draft #${draftId.split('-').pop()} checked out as order #${orderId.split('-').pop()} with credit request ${creditId}.`
    );

    await createNotificationRecord(
      'Payment',
      'Credit Request Submitted',
      `Order #${orderId.split('-').pop()} submitted with credit request ${creditId}.`,
      'medium',
      'seller',
      creditId
    );

    if (!isFullCredit && paymentId) {
      await createNotificationRecord(
        'Payment',
        'Payment Proof Submitted',
        `Upfront payment proof ${paymentId} was submitted for order #${orderId.split('-').pop()}.`,
        'medium',
        'seller',
        paymentId
      );
    }

    await client.query('COMMIT');

    emitOrderChanged({
      action: 'created',
      orderId,
      buyerId: String(draft.buyer_id),
      status: 'On Review'
    });

    emitCreditChanged({
      action: 'created',
      creditRequestId: creditId,
      buyerId: String(draft.buyer_id),
      orderId,
      status: 'Pending'
    });

    if (!isFullCredit && paymentId) {
      emitPaymentChanged({
        action: 'created',
        paymentId,
        orderId,
        buyerId: String(draft.buyer_id),
        status: 'Pending Review'
      });
    }

    return res.status(201).json({
      orderId,
      creditRequestId: creditId,
      paymentId,
      status: 'On Review'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Checkout draft with credit error:', err);
    return res.status(500).json({ error: 'Failed to checkout draft with credit' });
  } finally {
    client.release();
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
    emitOrderChanged({
      action: 'updated',
      orderId: id,
      buyerId: processedOrder.buyerId,
      status: normalizedStatus
    });
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

    const actorRole = (req as any).user?.role;
    const buyerNotificationTitles: Record<string, string> = {
      'On Review': 'Order Under Payment Review',
      Pending: 'Order Confirmed',
      Processing: 'Order Processing',
      Shipped: 'Order Shipped',
      Delivered: 'Order Delivered',
      Undelivered: 'Delivery Attempt Failed',
      Cancelled: 'Order Cancelled',
      Deleted: 'Order Removed'
    };

    if (actorRole !== 'R-BUYER' && result.rows[0]?.buyer_id && buyerNotificationTitles[normalizedStatus]) {
      const baseMessage = `Your order #${id.split('-').pop()} is now ${normalizedStatus}.`;
      const message = note ? `${baseMessage} Note: ${note}` : baseMessage;

      await createNotificationRecord(
        'Order',
        buyerNotificationTitles[normalizedStatus],
        message,
        ['Cancelled', 'Undelivered'].includes(normalizedStatus) ? 'medium' : 'low',
        String(result.rows[0].buyer_id),
        id
      );
    }

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

    emitOrderChanged({
      action: 'status-updated',
      orderId: id,
      buyerId: processedOrder.buyerId,
      status: normalizedStatus
    });
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

// GET /api/orders/metrics/demand-forecast
export const getDemandForecastMetrics = async (req: Request, res: Response) => {
  const productId = getParam(req.query.productId as string | string[] | undefined);
  const modelParam = getParam(req.query.model as string | string[] | undefined);
  const model: ForecastModel = modelParam === 'fb-prophet' ? 'fb-prophet' : 'holt-winters';

  try {
    const ordersResult = await pool.query(
      `SELECT o.id, o.date, o.status, o.total
       FROM orders o
       ORDER BY o.date ASC`
    );

    const eligibleOrders = ordersResult.rows
      .map((row: any) => ({
        ...row,
        status: normalizeStatus(row.status),
        total: parseNumber(row.total)
      }))
      .filter((row: any) => FORECAST_ELIGIBLE_STATUSES.has(row.status));

    const orderIds = eligibleOrders.map((order: any) => order.id);
    const itemsByOrder = new Map<string, Array<{ productId: string; quantity: number }>>();

    if (orderIds.length > 0) {
      const itemsResult = await pool.query(
        `SELECT order_id, product_id, quantity
         FROM order_items
         WHERE order_id = ANY($1::varchar[])`,
        [orderIds]
      );

      itemsResult.rows.forEach((row: any) => {
        const items = itemsByOrder.get(row.order_id) || [];
        items.push({
          productId: String(row.product_id),
          quantity: parseInteger(row.quantity)
        });
        itemsByOrder.set(row.order_id, items);
      });
    }

    const orders = eligibleOrders.map((order: any) => ({
      id: String(order.id),
      date: String(order.date),
      total: parseNumber(order.total),
      items: itemsByOrder.get(order.id) || []
    }));

    res.json(await buildDemandForecastPayload(model, orders, productId || undefined));
  } catch (err) {
    console.error('Get demand forecast metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch demand forecast metrics' });
  }
};
