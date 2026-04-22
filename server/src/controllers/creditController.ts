// server/src/controllers/creditController.ts
import { Request, Response } from 'express';
import pool from '../config/db';
import { logActivity } from '../utils/activityLog';
import { createNotificationRecord } from '../services/notificationService';
import { emitCreditChanged, emitOrderChanged, emitPaymentChanged } from '../services/realtime';

const parseNumber = (value: any): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

const parsePaymentTermDays = (value: any): number => {
  const text = String(value || '').trim();
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);

const addDays = (dateValue: string | undefined, days: number) => {
  if (!dateValue) return undefined;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnly(date);
};

const buildCreditRequest = (row: any) => {
  const approvedAmount = row.approved_amount !== null ? parseNumber(row.approved_amount) : undefined;
  const repaidAmount = row.repaid_amount !== null ? parseNumber(row.repaid_amount) : 0;
  const outstandingAmount = Math.max((approvedAmount || 0) - repaidAmount, 0);
  const paymentTerms = row.payment_terms || '';
  const dueDate =
    approvedAmount && approvedAmount > 0
      ? addDays(row.action_date || row.request_date, parsePaymentTermDays(paymentTerms))
      : undefined;

  return {
  id: row.id,
  buyerId: row.buyer_id,
  orderId: row.order_id || undefined,
  amount: parseNumber(row.amount),
  approvedAmount,
  repaidAmount,
  outstandingAmount,
  reason: row.reason,
  status: row.status,
  requestDate: row.request_date,
  actionDate: row.action_date || undefined,
  paymentTerms,
  dueDate,
  repaidAt: row.repaid_at || undefined,
  notes: row.notes || ''
  };
};

const creditRequestSelect = `
  SELECT cr.id, cr.buyer_id, cr.order_id, cr.amount, cr.approved_amount, cr.repaid_amount,
         cr.reason, cr.status, cr.request_date, cr.action_date, cr.repaid_at, cr.notes,
         COALESCE(cr.payment_terms, o.payment_terms, u.payment_terms, '') AS payment_terms
  FROM credit_requests cr
  LEFT JOIN orders o ON o.id = cr.order_id
  LEFT JOIN users u ON u.id = cr.buyer_id
`;

const getOrderPaymentStatus = (amountPaid: number, total: number): 'Unpaid' | 'Partially Paid' | 'Paid' => {
  if (amountPaid <= 0) return 'Unpaid';
  if (amountPaid >= total) return 'Paid';
  return 'Partially Paid';
};

const generateEntityId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

// GET /api/credits/:id
export const getCreditRequestById = async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  const userId = (req as any).user?.userId;

  const { id } = req.params;
  try {
    const result = await pool.query(
      `${creditRequestSelect}
       WHERE cr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credit request not found' });
    }

    if (userRole === 'R-BUYER' && String(result.rows[0].buyer_id) !== String(userId)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json(buildCreditRequest(result.rows[0]));
  } catch (err) {
    console.error('Get credit request by id error:', err);
    res.status(500).json({ error: 'Failed to fetch credit request' });
  }
};

// GET /api/credits/my/:id
export const getMyCreditRequestById = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `${creditRequestSelect}
       WHERE cr.id = $1 AND cr.buyer_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credit request not found' });
    }

    res.json(buildCreditRequest(result.rows[0]));
  } catch (err) {
    console.error('Get my credit request by id error:', err);
    res.status(500).json({ error: 'Failed to fetch credit request' });
  }
};

// GET /api/credits
export const getAllCreditRequests = async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  if (userRole === 'R-BUYER') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  try {
    const result = await pool.query(
      `${creditRequestSelect}
       ORDER BY cr.request_date DESC, cr.created_at DESC`
    );
    res.json(result.rows.map(buildCreditRequest));
  } catch (err) {
    console.error('Get all credit requests error:', err);
    res.status(500).json({ error: 'Failed to fetch credit requests' });
  }
};

// GET /api/credits/my
export const getMyCreditRequests = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await pool.query(
      `${creditRequestSelect}
       WHERE cr.buyer_id = $1
       ORDER BY cr.request_date DESC, cr.created_at DESC`,
      [userId]
    );

    res.json(result.rows.map(buildCreditRequest));
  } catch (err) {
    console.error('Get credit requests error:', err);
    res.status(500).json({ error: 'Failed to fetch credit requests' });
  }
};

// POST /api/credits
export const createCreditRequest = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  const userRole = (req as any).user?.role;
  const { buyerId, orderId, amount, reason, notes, paymentTerms } = req.body || {};
  const requestedAmount = parseNumber(amount);
  const trimmedReason = String(reason || '').trim();
  const trimmedNotes = String(notes || '').trim();

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!amount || !reason || !paymentTerms) {
    return res.status(400).json({ error: 'amount, reason, and paymentTerms are required' });
  }

  if (requestedAmount <= 0) {
    return res.status(400).json({ error: 'Credit amount must be greater than 0' });
  }

  if (!trimmedReason) {
    return res.status(400).json({ error: 'Reason is required' });
  }

  if (trimmedNotes.length > 1000) {
    return res.status(400).json({ error: 'Notes cannot exceed 1000 characters' });
  }

  if (!['Net 15', 'Net 30'].includes(String(paymentTerms))) {
    return res.status(400).json({ error: 'paymentTerms must be Net 15 or Net 30' });
  }

  const targetBuyerId = userRole === 'R-BUYER' ? userId : buyerId;
  if (!targetBuyerId) {
    return res.status(400).json({ error: 'buyerId is required' });
  }

  const creditId = generateEntityId('CR');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (orderId) {
      const linkedOrder = await client.query(
        `SELECT id, buyer_id, total
         FROM orders
         WHERE id = $1`,
        [orderId]
      );

      if (linkedOrder.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Linked order not found' });
      }

      if (String(linkedOrder.rows[0].buyer_id) !== String(targetBuyerId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Linked order does not belong to this buyer.' });
      }

      const orderTotal = parseNumber(linkedOrder.rows[0].total);
      if (requestedAmount > orderTotal) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Credit amount cannot exceed linked order total' });
      }

      const existingCredit = await client.query(
        `SELECT id
         FROM credit_requests
         WHERE order_id = $1
         LIMIT 1`,
        [orderId]
      );

      if (existingCredit.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Order ${orderId} already has a credit request.` });
      }
    }

    const result = await client.query(
      `INSERT INTO credit_requests (
         id, buyer_id, order_id, amount, reason, payment_terms, status, request_date, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, 'Pending', CURRENT_DATE, $7)
       RETURNING id, buyer_id, order_id, amount, approved_amount, repaid_amount, reason, status,
                 request_date, action_date, repaid_at, notes, payment_terms`,
      [creditId, targetBuyerId, orderId || null, requestedAmount, trimmedReason, paymentTerms, trimmedNotes || null]
    );

    await client.query('COMMIT');

    await logActivity(
      req,
      'Create Credit Request',
      'Finance',
      `Credit request ${creditId} created for buyer ${targetBuyerId}.`
    );

    // Notify internal team that a new credit request is waiting for review.
    await createNotificationRecord(
      'Payment',
      'Credit Request Submitted',
      `Credit request ${creditId} was submitted.`,
      'medium',
      'seller',
      creditId
    );

    emitCreditChanged({
      action: 'created',
      creditRequestId: creditId,
      buyerId: String(targetBuyerId),
      orderId: orderId || undefined,
      status: 'Pending'
    });
    res.status(201).json(buildCreditRequest(result.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create credit request error:', err);
    res.status(500).json({ error: 'Failed to create credit request' });
  } finally {
    client.release();
  }
};

// PATCH /api/credits/:id
export const updateCreditRequest = async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  if (userRole === 'R-BUYER') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const id = String(req.params.id || '');
  const { status, approvedAmount, notes } = req.body || {};

  const allowedStatuses = ['Pending', 'Approved', 'Rejected', 'Partially Approved'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  if (status === 'Rejected' && !String(notes || '').trim()) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const current = await client.query(
      `SELECT id, buyer_id, order_id, amount, status, approved_amount
       FROM credit_requests
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Credit request not found' });
    }

    const existing = current.rows[0];
    const requestAmount = parseNumber(existing.amount);
    let finalApproved = 0;

    if (status === 'Approved' || status === 'Partially Approved') {
      finalApproved = parseNumber(approvedAmount);
      if (finalApproved <= 0) {
        return res.status(400).json({ error: 'Approved amount must be greater than 0' });
      }
      if (finalApproved > requestAmount) {
        return res.status(400).json({ error: 'Approved amount cannot exceed requested amount' });
      }
    } else if (status === 'Pending' || status === 'Rejected') {
      finalApproved = 0;
    }

    const previousApproved = parseNumber(existing.approved_amount);
    const previousContributed =
      existing.status === 'Approved' ||
      existing.status === 'Partially Approved' ||
      existing.status === 'Partially Paid' ||
      existing.status === 'Fully Paid'
        ? previousApproved
        : 0;
    const nextContributed =
      status === 'Approved' || status === 'Partially Approved'
        ? finalApproved
        : 0;
    const creditDelta = nextContributed - previousContributed;
    const orderId = existing.order_id ? String(existing.order_id) : '';

    let orderBuyerId = String(existing.buyer_id);
    let orderTotal = 0;
    let currentOrderPaid = 0;
    let nextOrderPaid = 0;
    let currentOrderStatus = '';
    let currentOrderHistory: any[] = [];
    let orderStatusEventPayload: { orderId: string; buyerId: string; status: string } | null = null;

    if (orderId) {
      const orderResult = await client.query(
        `SELECT id, buyer_id, total, amount_paid, status, history
         FROM orders
         WHERE id = $1
         FOR UPDATE`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Linked order not found' });
      }

      const linkedOrder = orderResult.rows[0];
      orderBuyerId = String(linkedOrder.buyer_id);
      orderTotal = parseNumber(linkedOrder.total);
      currentOrderPaid = parseNumber(linkedOrder.amount_paid);
      nextOrderPaid = Math.min(orderTotal, Math.max(0, currentOrderPaid + creditDelta));
      currentOrderStatus = String(linkedOrder.status || '');
      currentOrderHistory = Array.isArray(linkedOrder.history) ? linkedOrder.history : [];
    }

    const result = await client.query(
      `UPDATE credit_requests
       SET status = $1,
           approved_amount = $2,
           action_date = $3,
           notes = $4
       WHERE id = $5
       RETURNING id, buyer_id, order_id, amount, approved_amount, repaid_amount, reason, status,
                 request_date, action_date, repaid_at, notes`,
      [
        status,
        status === 'Pending' ? null : finalApproved,
        status === 'Pending' ? null : new Date().toISOString().slice(0, 10),
        notes ?? null,
        id
      ]
    );

    if (creditDelta !== 0) {
      await client.query(
        `UPDATE users
         SET available_credit = GREATEST(0, COALESCE(available_credit, 0) + $1),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [creditDelta, existing.buyer_id]
      );
    }

    if (orderId) {
      const shouldReleaseOrder =
        currentOrderStatus.trim().toUpperCase() === 'ON REVIEW' &&
        nextOrderPaid >= orderTotal;

      if (shouldReleaseOrder) {
        const updatedHistory = [
          ...currentOrderHistory,
          {
            status: 'Pending',
            date: new Date().toLocaleString(),
            note: `Credit request ${id} approved enough to release the order.`
          }
        ];

        await client.query(
          `UPDATE orders
           SET amount_paid = $1,
               payment_status = $2,
               status = 'Pending',
               history = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [nextOrderPaid, getOrderPaymentStatus(nextOrderPaid, orderTotal), JSON.stringify(updatedHistory), orderId]
        );

        orderStatusEventPayload = {
          orderId: String(orderId),
          buyerId: String(orderBuyerId),
          status: 'Pending'
        };
      } else {
        await client.query(
          `UPDATE orders
           SET amount_paid = $1,
               payment_status = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [nextOrderPaid, getOrderPaymentStatus(nextOrderPaid, orderTotal), orderId]
        );
      }

      if (nextContributed > 0 || previousContributed > 0) {
        const creditPaymentId = `PAY-${id.replace(/^CR-/, 'CRD-')}`;
        const creditPaymentNotes =
          nextContributed > 0
            ? `Auto-recorded from credit request ${id}. Proof will be attached when the credit is repaid.`
            : `Credit request ${id} is no longer contributing to payment coverage.`;

        const existingPayment = await client.query(
          `SELECT id
           FROM payments
           WHERE order_id = $1
             AND reference_id = $2
           LIMIT 1
           FOR UPDATE`,
          [orderId, id]
        );

        if (existingPayment.rows.length === 0) {
          await client.query(
            `INSERT INTO payments (
               id, order_id, buyer_id, amount, method, reference_id, proof_image, status, notes, date_time
             ) VALUES ($1, $2, $3, $4, 'Credit', $5, NULL, $6, $7, NOW())`,
            [
              creditPaymentId,
              orderId,
              orderBuyerId,
              nextContributed,
              id,
              nextContributed > 0 ? 'Approved' : 'Rejected',
              creditPaymentNotes
            ]
          );
        } else {
          await client.query(
            `UPDATE payments
             SET amount = $1,
                 method = 'Credit',
                 status = $2,
                 proof_image = NULL,
                 notes = $3
             WHERE id = $4`,
            [
              nextContributed,
              nextContributed > 0 ? 'Approved' : 'Rejected',
              creditPaymentNotes,
              existingPayment.rows[0].id
            ]
          );
        }
      }
    }

    await client.query('COMMIT');

    if (orderStatusEventPayload) {
      emitOrderChanged({
        action: 'status-updated',
        orderId: orderStatusEventPayload.orderId,
        buyerId: orderStatusEventPayload.buyerId,
        status: orderStatusEventPayload.status
      });
    }

    await logActivity(
      req,
      'Update Credit Request',
      'Finance',
      `Credit request ${id} marked ${status} with amount ${finalApproved}.`
    );

    // Notify buyer when credit request status changes.
    await createNotificationRecord(
      'Payment',
      `Credit Request ${status}`,
      `Your credit request ${id} is now ${status}.`,
      status === 'Approved' ? 'low' : 'medium',
      String(existing.buyer_id),
      String(id)
    );

    emitCreditChanged({
      action: 'updated',
      creditRequestId: String(id),
      buyerId: String(existing.buyer_id),
      orderId: orderId || undefined,
      status
    });

    if (orderId && (nextContributed > 0 || previousContributed > 0)) {
      emitPaymentChanged({
        action: 'updated',
        paymentId: `PAY-${id.replace(/^CR-/, 'CRD-')}`,
        orderId,
        buyerId: String(existing.buyer_id),
        creditRequestId: String(id),
        status: nextContributed > 0 ? 'Approved' : 'Rejected'
      });
    }

    res.json(buildCreditRequest(result.rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update credit request error:', err);
    res.status(500).json({ error: 'Failed to update credit request' });
  } finally {
    client.release();
  }
};

// POST /api/credits/:id/repay
export const repayCreditRequest = async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  const userId = (req as any).user?.userId;
  const id = String(req.params.id || '');
  const { amount, note, referenceId, proofImage } = req.body || {};
  const repaymentAmount = parseNumber(amount);
  const trimmedNote = String(note || '').trim();
  const trimmedReferenceId = String(referenceId || '').trim();
  const trimmedProofImage = String(proofImage || '').trim();

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (repaymentAmount <= 0) {
    return res.status(400).json({ error: 'Repayment amount must be greater than 0' });
  }

  if (!trimmedReferenceId && !trimmedProofImage) {
    return res.status(400).json({ error: 'Provide at least a bank reference or proof of payment image' });
  }

  if (trimmedReferenceId.length > 100) {
    return res.status(400).json({ error: 'Bank reference cannot exceed 100 characters' });
  }

  if (trimmedNote.length > 1000) {
    return res.status(400).json({ error: 'Repayment note cannot exceed 1000 characters' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const current = await client.query(
      `SELECT cr.id, cr.buyer_id, cr.order_id, cr.status, cr.approved_amount, cr.repaid_amount, cr.notes
       FROM credit_requests cr
       WHERE cr.id = $1
       FOR UPDATE`,
      [id]
    );

    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Credit request not found' });
    }

    const existing = current.rows[0];
    if (userRole === 'R-BUYER' && String(existing.buyer_id) !== String(userId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (
      existing.status !== 'Approved' &&
      existing.status !== 'Partially Approved' &&
      existing.status !== 'Partially Paid'
    ) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only approved credits can be repaid' });
    }

    const approvedAmount = parseNumber(existing.approved_amount);
    const repaidAmount = parseNumber(existing.repaid_amount);
    const outstandingAmount = Math.max(approvedAmount - repaidAmount, 0);

    if (outstandingAmount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This credit is already fully repaid' });
    }

    if (repaymentAmount > outstandingAmount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Repayment amount exceeds unpaid credit' });
    }

    if (!existing.order_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only credits linked to an order can be repaid through the payment review flow' });
    }

    const paymentId = generateEntityId('PAY');
    const paymentNote = trimmedNote || null;

    const paymentResult = await client.query(
      `INSERT INTO payments (
         id, order_id, buyer_id, credit_request_id, amount, method, reference_id, proof_image, status, notes, date_time
       ) VALUES ($1, $2, $3, $4, $5, 'Credit Repayment', $6, $7, 'Pending Review', $8, NOW())
       RETURNING id, order_id, buyer_id, credit_request_id, amount, method, reference_id, date_time, proof_image, status, notes`,
      [
        paymentId,
        existing.order_id,
        existing.buyer_id,
        id,
        repaymentAmount,
        trimmedReferenceId || null,
        trimmedProofImage || null,
        paymentNote
      ]
    );

    await client.query('COMMIT');

    await logActivity(
      req,
      'Submit Credit Repayment',
      'Finance',
      `Credit repayment ${paymentId} submitted for credit request ${id}.`
    );

    await createNotificationRecord(
      'Payment',
      'Credit Repayment Submitted',
      `A repayment of ETB ${repaymentAmount.toLocaleString()} was submitted for credit ${id} and is waiting for review.`,
      'medium',
      'seller',
      paymentId
    );

    emitCreditChanged({
      action: 'repaid',
      creditRequestId: String(id),
      buyerId: String(existing.buyer_id),
      orderId: String(existing.order_id),
      status: String(existing.status)
    });
    emitPaymentChanged({
      action: 'created',
      paymentId,
      orderId: String(existing.order_id),
      buyerId: String(existing.buyer_id),
      creditRequestId: String(id),
      status: 'Pending Review'
    });
    res.status(201).json({
      message: 'Credit repayment submitted for review',
      payment: paymentResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Repay credit request error:', err);
    res.status(500).json({ error: 'Failed to repay credit request' });
  } finally {
    client.release();
  }
};
