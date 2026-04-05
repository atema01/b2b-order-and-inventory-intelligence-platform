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
  creditRequestId: row.credit_request_id || undefined,
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
    const creditRequestId = String(req.query.creditRequestId || '').trim();
    const params: any[] = [];
    let sql = `
      SELECT id, order_id, buyer_id, credit_request_id, amount, method, reference_id, date_time, proof_image, status, notes
      FROM payments
    `;

    if (creditRequestId) {
      params.push(creditRequestId);
      sql += ` WHERE credit_request_id = $1`;
    }

    sql += ` ORDER BY date_time DESC`;

    const result = await pool.query(sql, params);
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
      `SELECT id, order_id, buyer_id, credit_request_id, amount, method, reference_id, date_time, proof_image, status, notes
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
  const { orderId, amount, method, referenceId, proofImage, notes, creditRequestId } = req.body || {};

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

    if (!creditRequestId && payAmount > remaining) {
      return res.status(400).json({ error: `Payment cannot exceed remaining balance of ${remaining}` });
    }

    let resolvedCreditRequestId: string | null = null;
    if (creditRequestId) {
      const creditResult = await pool.query(
        `SELECT id, buyer_id, order_id, amount, approved_amount, repaid_amount, status
         FROM credit_requests
         WHERE id = $1`,
        [creditRequestId]
      );

      if (creditResult.rows.length === 0) {
        return res.status(404).json({ error: 'Credit request not found' });
      }

      const credit = creditResult.rows[0];
      if (String(credit.buyer_id) !== String(order.buyer_id)) {
        return res.status(400).json({ error: 'Credit request does not belong to this buyer' });
      }

      if (String(credit.order_id || '') !== String(orderId)) {
        return res.status(400).json({ error: 'Credit request does not match this order' });
      }

      if (!['Approved', 'Partially Approved', 'Partially Paid'].includes(String(credit.status))) {
        return res.status(400).json({ error: 'Only approved credits can receive repayment submissions' });
      }

      const approvedAmount = parseNumber(credit.approved_amount);
      const repaidAmount = parseNumber(credit.repaid_amount);
      const outstandingCredit = Math.max(approvedAmount - repaidAmount, 0);

      if (outstandingCredit <= 0) {
        return res.status(400).json({ error: 'This credit is already fully repaid' });
      }

      if (payAmount > outstandingCredit) {
        return res.status(400).json({ error: `Payment cannot exceed outstanding credit of ${outstandingCredit}` });
      }

      resolvedCreditRequestId = String(credit.id);
    }

    const paymentId = `PAY-${Date.now().toString().slice(-6)}`;

    const result = await pool.query(
      `INSERT INTO payments (
        id, order_id, buyer_id, credit_request_id, amount, method, reference_id, proof_image, status, notes, date_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending Review', $9, NOW())
      RETURNING id, order_id, buyer_id, credit_request_id, amount, method, reference_id, date_time, proof_image, status, notes`,
      [
        paymentId,
        orderId,
        order.buyer_id,
        resolvedCreditRequestId,
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
      resolvedCreditRequestId ? 'Credit Repayment Submitted' : 'Payment Proof Submitted',
      resolvedCreditRequestId
        ? `New repayment ${paymentId} was submitted for credit ${resolvedCreditRequestId}.`
        : `New payment ${paymentId} was submitted for order ${orderId}.`,
      'medium',
      'seller',
      resolvedCreditRequestId || paymentId
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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const paymentResult = await client.query(
      `SELECT id, order_id, buyer_id, credit_request_id, amount, status
       FROM payments
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (paymentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = paymentResult.rows[0];
    const payAmount = parseNumber(payment.amount);
    const wasApproved = payment.status === 'Approved';
    const willBeApproved = status === 'Approved';
    let relatedId = payment.order_id;

    if (payment.credit_request_id) {
      relatedId = payment.credit_request_id;

      const creditResult = await client.query(
        `SELECT id, amount, approved_amount, repaid_amount, status
         FROM credit_requests
         WHERE id = $1
         FOR UPDATE`,
        [payment.credit_request_id]
      );

      if (creditResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Linked credit request not found' });
      }

      const credit = creditResult.rows[0];
      const requestAmount = parseNumber(credit.amount);
      const approvedAmount = parseNumber(credit.approved_amount);
      const currentRepaid = parseNumber(credit.repaid_amount);
      let nextRepaid = currentRepaid;

      if (!wasApproved && willBeApproved) {
        const remainingCredit = Math.max(approvedAmount - currentRepaid, 0);
        if (payAmount > remainingCredit) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Approved repayment exceeds outstanding credit balance' });
        }
        nextRepaid = currentRepaid + payAmount;
      } else if (wasApproved && !willBeApproved) {
        nextRepaid = Math.max(0, currentRepaid - payAmount);
      }

      const nextCreditStatus =
        nextRepaid >= approvedAmount && approvedAmount > 0
          ? 'Fully Paid'
          : nextRepaid > 0
            ? 'Partially Paid'
            : approvedAmount < requestAmount
              ? 'Partially Approved'
              : 'Approved';

      await client.query(
        `UPDATE credit_requests
         SET repaid_amount = $1,
             repaid_at = $2,
             status = $3
         WHERE id = $4`,
        [
          nextRepaid,
          nextRepaid > 0 ? new Date().toISOString().slice(0, 10) : null,
          nextCreditStatus,
          payment.credit_request_id
        ]
      );

      if (!wasApproved && willBeApproved) {
        await client.query(
          `UPDATE users
           SET available_credit = GREATEST(0, COALESCE(available_credit, 0) - $1),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [payAmount, payment.buyer_id]
        );
      } else if (wasApproved && !willBeApproved) {
        await client.query(
          `UPDATE users
           SET available_credit = COALESCE(available_credit, 0) + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [payAmount, payment.buyer_id]
        );
      }
    } else {
      const orderResult = await client.query(
        'SELECT id, total, amount_paid FROM orders WHERE id = $1 FOR UPDATE',
        [payment.order_id]
      );
      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Order not found' });
      }

      const order = orderResult.rows[0];
      const total = parseNumber(order.total);
      const currentPaid = parseNumber(order.amount_paid);
      let newPaid = currentPaid;

      if (!wasApproved && willBeApproved) {
        newPaid = Math.min(total, currentPaid + payAmount);
      } else if (wasApproved && !willBeApproved) {
        newPaid = Math.max(0, currentPaid - payAmount);
      }

      await client.query(
        `UPDATE orders
         SET amount_paid = $1,
             payment_status = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newPaid, getOrderPaymentStatus(newPaid, total), order.id]
      );
    }

    const updatedPayment = await client.query(
      `UPDATE payments
       SET status = $1,
           notes = $2
       WHERE id = $3
       RETURNING id, order_id, buyer_id, credit_request_id, amount, method, reference_id, date_time, proof_image, status, notes`,
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
      payment.credit_request_id ? `Credit Repayment ${status}` : `Payment ${status}`,
      payment.credit_request_id
        ? `Your repayment ${id} for credit ${payment.credit_request_id} is now ${status}.${notes ? ` Note: ${notes}` : ''}`
        : `Your payment ${id} for order ${payment.order_id} is now ${status}.${notes ? ` Note: ${notes}` : ''}`,
      status === 'Approved' ? 'low' : 'medium',
      payment.buyer_id,
      relatedId
    );

    await client.query('COMMIT');
    res.json(buildPayment(updatedPayment.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update payment status error:', err);
    res.status(500).json({ error: 'Failed to update payment status' });
  } finally {
    client.release();
  }
};
