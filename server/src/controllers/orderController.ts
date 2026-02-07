// src/controllers/orderController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { it } from 'node:test';

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
    `SELECT reorder_point, stock_main_warehouse, stock_back_room, stock_show_room 
     FROM products WHERE id = $1`,
    [productId]
  );

  if (productResult.rows.length > 0) {
    const product = productResult.rows[0];

    const main = parseInteger(product.stock_main_warehouse);
    const back = parseInteger(product.stock_back_room);
    const show = parseInteger(product.stock_show_room);
    const reorderPoint = parseInteger(product.reorder_point);

    const totalStock = main + back + show;

    let newStatus = 'In Stock';

    if (totalStock === 0) {
      newStatus = 'Empty';
    } else if (totalStock < reorderPoint) {
      newStatus = 'Low';
    }

    await pool.query(
      `UPDATE products 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newStatus, productId]
    );
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

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.id, o.buyer_id AS "buyerId", o.date, o.status,
        o.subtotal, o.tax, o.total, o.amount_paid AS "amountPaid",
        o.payment_status AS "paymentStatus", o.created_by AS "createdBy",
        o.stock_deducted AS "stockDeducted", o.history
      FROM orders o
      ORDER BY o.date DESC
    `);

    // Fetch order items and convert numeric fields
    const orders = await Promise.all(result.rows.map(async (order: any) => {
      const itemsResult = await pool.query(
        `SELECT 
           product_id AS "productId", 
           quantity, 
           price_at_order AS "priceAtOrder", 
           picked 
         FROM order_items 
         WHERE order_id = $1`,
        [order.id]
      );

      // Convert order numeric fields
      const processedOrder = {
        ...order,
        subtotal: parseNumber(order.subtotal),
        tax: parseNumber(order.tax),
        total: parseNumber(order.total),
        amountPaid: parseNumber(order.amount_paid),
        stockDeducted: Boolean(order.stock_deducted),
        items: itemsResult.rows.map((item: any) => ({
          ...item,
          quantity: parseInteger(item.quantity),
          priceAtOrder: parseNumber(item.price_at_order)
        }))
      };

      return processedOrder;
    }));

    res.json(orders);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};
// POST /api/orders
export const createOrder = async (req: Request, res: Response) => {
  
  const orderData = req.body;
  
  try {
    // Start transaction
    await pool.query('BEGIN');

    // Deduct stock from products first
    for (const item of orderData.items) {
      const productResult = await pool.query(
        'SELECT stock_main_warehouse, stock_back_room, stock_show_room FROM products WHERE id = $1',
        [item.productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const currentStock = productResult.rows[0];
      const totalStock = currentStock.stock_main_warehouse + 
                        currentStock.stock_back_room + 
                        currentStock.stock_show_room;

      if (totalStock < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }

      // Deduct from main warehouse first, then back room, then show room
      let remainingQty = item.quantity;
      
      // Deduct from main warehouse
      let newMainWarehouse = Math.max(0, currentStock.stock_main_warehouse - remainingQty);
      if (currentStock.stock_main_warehouse >= remainingQty) {
        remainingQty = 0;
      } else {
        remainingQty -= currentStock.stock_main_warehouse;
      }

      // Deduct from back room if needed
      let newBackRoom = currentStock.stock_back_room;
      if (remainingQty > 0) {
        newBackRoom = Math.max(0, currentStock.stock_back_room - remainingQty);
        if (currentStock.stock_back_room >= remainingQty) {
          remainingQty = 0;
        } else {
          remainingQty -= currentStock.stock_back_room;
        }
      }

      // Deduct from show room if needed
      let newShowRoom = currentStock.stock_show_room;
      if (remainingQty > 0) {
        newShowRoom = Math.max(0, currentStock.stock_show_room - remainingQty);
      }

      // Update product stock
      await pool.query(
        `UPDATE products SET 
          stock_main_warehouse = $1,
          stock_back_room = $2, 
          stock_show_room = $3,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [newMainWarehouse, newBackRoom, newShowRoom, item.productId]
      );
      await updateProductStatus(item.productId);

    }

    // Create the order
    const orderResult = await pool.query(
      `INSERT INTO orders (
        id, buyer_id, date, status, payment_terms, created_by,
        subtotal, tax, total, amount_paid, payment_status, history, stock_deducted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
      RETURNING *`,
      [
        orderData.id,
        orderData.buyerId,
        orderData.date,
        orderData.status,
        orderData.paymentTerms,
        orderData.createdBy,
        orderData.subtotal,
        orderData.tax,
        orderData.total,
        orderData.amountPaid,
        orderData.paymentStatus,
        JSON.stringify(orderData.history)
      ]
    );

    // Insert order items
    for (const item of orderData.items) {
      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_at_order, picked)
         VALUES ($1, $2, $3, $4, false)`,
        [orderData.id, item.productId, item.quantity, item.priceAtOrder]
      );
    }

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
  const { id } = req.params;
  const orderData = req.body;

  try {
    // Update order
    await pool.query(
      `UPDATE orders SET 
        buyer_id = $1, date = $2, status = $3, payment_terms = $4,
        subtotal = $5, tax = $6, total = $7, amount_paid = $8,
        payment_status = $9, history = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $11`,
      [
        orderData.buyerId,
        orderData.date,
        orderData.status,
        orderData.paymentTerms,
        orderData.subtotal,
        orderData.tax,
        orderData.total,
        orderData.amountPaid,
        orderData.paymentStatus,
        JSON.stringify(orderData.history),
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

    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    
    // Process the returned order to ensure numeric types
    const processedOrder = {
      ...result.rows[0],
      subtotal: parseNumber(result.rows[0].subtotal),
      tax: parseNumber(result.rows[0].tax),
      total: parseNumber(result.rows[0].total),
      amountPaid: parseNumber(result.rows[0].amount_paid),
      stockDeducted: Boolean(result.rows[0].stock_deducted),
      items: [] // Items will be fetched separately in getOrderById
    };

    res.json(processedOrder);
  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ error: 'Failed to update order' });
  }
};

// PATCH /api/orders/:id/status
export const updateOrderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, note } = req.body;

  // Validate status
  const validStatuses = ['DRAFT', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'UNDELIVERED', 'CANCELLED', 'DELETED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    // Get current order to update history
    const currentOrder = await pool.query(
      'SELECT history FROM orders WHERE id = $1',
      [id]
    );

    if (currentOrder.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentHistory = currentOrder.rows[0].history || [];
    const newHistoryEntry = {
      status: status,
      date: new Date().toLocaleString(),
      note: note || ''
    };

    const updatedHistory = [...currentHistory, newHistoryEntry];

    // Update order status and history
    const result = await pool.query(
      `UPDATE orders SET 
        status = $1, 
        history = $2,
        updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING *`,
      [status, JSON.stringify(updatedHistory), id]
    );

    // Process the returned order to ensure numeric types
    const processedOrder = {
      ...result.rows[0],
      subtotal: parseNumber(result.rows[0].subtotal),
      tax: parseNumber(result.rows[0].tax),
      total: parseNumber(result.rows[0].total),
      amountPaid: parseNumber(result.rows[0].amount_paid),
      stockDeducted: Boolean(result.rows[0].stock_deducted)
    };

    res.json(processedOrder);
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    // Get order details
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
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
    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1',
      [id]
    );

    // Process order with proper numeric types
    const processedOrder = {
      ...order,
      subtotal: parseNumber(order.subtotal),
      tax: parseNumber(order.tax),
      total: parseNumber(order.total),
      amount_paid: parseNumber(order.amount_paid),
      stock_deducted: Boolean(order.stock_deducted),
      items: itemsResult.rows.map((item: any) => ({
        ...item,
        quantity: parseInteger(item.quantity),
        price_at_order: parseNumber(item.price_at_order)
      }))
    };

    res.json(processedOrder);
  } catch (err) {
    console.error('Get order by ID error:', err);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};
// PATCH /api/orders/:orderId/items/:itemId/pick
export const updateOrderItemPicked = async (req: Request, res: Response) => {
  const { orderId, itemId } = req.params;
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

    // Check if order status should be updated from PENDING to PROCESSING
    if (picked) {
      const orderResult = await pool.query(
        'SELECT status FROM orders WHERE id = $1',
        [orderId]
      );
      
      if (orderResult.rows[0].status === 'PENDING') {
        await pool.query(
          'UPDATE orders SET status = $1 WHERE id = $2',
          ['PROCESSING', orderId]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update order item picked error:', err);
    res.status(500).json({ error: 'Failed to update item picked status' });
  }
};