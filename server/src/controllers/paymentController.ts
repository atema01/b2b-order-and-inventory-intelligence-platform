// server/src/controllers/paymentController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { logActivity } from '../utils/activityLog';

const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const buildPayment = (row: any) => ({
  id: row.id,
  orderId: row.order_id,
  buyerId: row.buyer_id,
  amount: parseNumber(row.amount),
  method: row.method,
  referenceId: row.reference_id,
  dateTime: row.date_time,
  proofImage: row.proof_image || '',
  status: row.status,
  notes: row.notes || ''
});

const createNotification = async (
  type: string,
  title: string,
  message: string,
  severity: 'low' | 'medium' | 'high',
  recipientId: string,
  relatedId?: string
) => {
  await pool.query(
    `INSERT INTO notifications (type, title, message, time, is_read, severity, recipient_id, related_id)
     VALUES ($1, $2, $3, $4, false, $5, $6, $7)`,
    [type, title, message, new Date().toISOString(), severity, recipientId, relatedId || null]
  );
};

const getOrderPaymentStatus = (amountPaid: number, total: number): 'Unpaid' | 'Partially Paid' | 'Paid' => {
  if (amountPaid <= 0) return 'Unpaid';
  if (amountPaid >= total) return 'Paid';
  return 'Partially Paid';
};

// GET /api/payments
export const getAllPayments = async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  if (userRole === 'R-BUYER') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    const result = await pool.query(
      `SELECT id, order_id, buyer_id, amount, method, reference_id, date_time, proof_image, status, notes
       FROM payments
       ORDER BY date_time DESC`
    );
    res.json(result.rows.map(buildPayment));
  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
};

// GET /api/payments/:id
export const getPaymentById = async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  if (userRole === 'R-BUYER') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, order_id, buyer_id, amount, method, reference_id, date_time, proof_image, status, notes
       FROM payments
       WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(buildPayment(result.rows[0]));
  } catch (err) {
    console.error('Get payment error:', err);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
};

// POST /api/payments
export const createPayment = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const userId = user?.userId;
  const userRole = user?.role;
  const { orderId, amount, method, referenceId, proofImage, notes } = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!orderId || !amount || !method) {
    return res.status(400).json({ error: 'orderId, amount, and method are required' });
  }

  try {
    const orderResult = await pool.query(
      'SELECT id, buyer_id, total, amount_paid FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];
    if (userRole === 'R-BUYER' && order.buyer_id !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const total = parseNumber(order.total);
    const paid = parseNumber(order.amount_paid);
    const remaining = Math.max(0, total - paid);
    const payAmount = parseNumber(amount);

    if (payAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero' });
    }

    if (payAmount > remaining) {
      return res.status(400).json({ error: `Payment cannot exceed remaining balance of ${remaining}` });
    }

    const paymentId = `PAY-${Date.now().toString().slice(-6)}`;

    const result = await pool.query(
      `INSERT INTO payments (
        id, order_id, buyer_id, amount, method, reference_id, proof_image, status, notes, date_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending Review', $8, NOW())
      RETURNING id, order_id, buyer_id, amount, method, reference_id, date_time, proof_image, status, notes`,
      [
        paymentId,
        orderId,
        order.buyer_id,
        payAmount,
        method,
        referenceId || null,
        proofImage || null,
        notes || null
      ]
    );

    await logActivity(
      req,
      'Submit Payment',
      'Finance',
      `Payment ${paymentId} submitted for order ${orderId}.`
    );

    // Notify internal team that a buyer submitted a new payment proof for review.
    await createNotification(
      'Payment',
      'Payment Proof Submitted',
      `New payment ${paymentId} was submitted for order ${orderId}.`,
      'medium',
      'seller',
      paymentId
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ error: 'Failed to submit payment' });
  }
};

// PATCH /api/payments/:id
export const updatePaymentStatus = async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  if (userRole === 'R-BUYER') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { id } = req.params;
  const { status, notes } = req.body || {};
  const allowedStatuses = ['Approved', 'Rejected', 'Mismatched', 'Pending Review'];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  // Rejected and mismatched reviews must include context for the buyer.
  if ((status === 'Rejected' || status === 'Mismatched') && !String(notes || '').trim()) {
    return res.status(400).json({ error: 'Notes are required for rejected or mismatched payments' });
  }

  try {
    await pool.query('BEGIN');

    const paymentResult = await pool.query(
      `SELECT id, order_id, buyer_id, amount, status
       FROM payments
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (paymentResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];
    const orderResult = await pool.query(
      'SELECT id, total, amount_paid FROM orders WHERE id = $1 FOR UPDATE',
      [payment.order_id]
    );
    if (orderResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    // Keep order financials consistent when toggling in/out of Approved status.
    const order = orderResult.rows[0];
    const total = parseNumber(order.total);
    const currentPaid = parseNumber(order.amount_paid);
    const payAmount = parseNumber(payment.amount);
    const wasApproved = payment.status === 'Approved';
    const willBeApproved = status === 'Approved';
    let newPaid = currentPaid;

    if (!wasApproved && willBeApproved) {
      newPaid = Math.min(total, currentPaid + payAmount);
    } else if (wasApproved && !willBeApproved) {
      newPaid = Math.max(0, currentPaid - payAmount);
    }

    await pool.query(
      `UPDATE orders
       SET amount_paid = $1,
           payment_status = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [newPaid, getOrderPaymentStatus(newPaid, total), order.id]
    );

    const updatedPayment = await pool.query(
      `UPDATE payments
       SET status = $1,
           notes = $2
       WHERE id = $3
       RETURNING id, order_id, buyer_id, amount, method, reference_id, date_time, proof_image, status, notes`,
      [status, notes || null, id]
    );

    await logActivity(
      req,
      'Update Payment Status',
      'Finance',
      `Payment ${id} marked ${status}.`
    );

    // Notify buyer when payment review is completed or revised.
    await createNotification(
      'Payment',
      `Payment ${status}`,
      `Your payment ${id} for order ${payment.order_id} is now ${status}.${notes ? ` Note: ${notes}` : ''}`,
      status === 'Approved' ? 'low' : 'medium',
      payment.buyer_id,
      payment.order_id
    );

    await pool.query('COMMIT');
    res.json(buildPayment(updatedPayment.rows[0]));
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Update payment status error:', err);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
};
