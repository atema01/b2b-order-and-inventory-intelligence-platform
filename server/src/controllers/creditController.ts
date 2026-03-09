// server/src/controllers/creditController.ts
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

const buildCreditRequest = (row: any) => ({
  id: row.id,
  buyerId: row.buyer_id,
  orderId: row.order_id || undefined,
  amount: parseNumber(row.amount),
  approvedAmount: row.approved_amount !== null ? parseNumber(row.approved_amount) : undefined,
  reason: row.reason,
  status: row.status,
  requestDate: row.request_date,
  actionDate: row.action_date || undefined,
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

// GET /api/credits/:id
export const getCreditRequestById = async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  if (userRole === 'R-BUYER') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, buyer_id, order_id, amount, approved_amount, reason, status,
              request_date, action_date, notes
       FROM credit_requests
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Credit request not found' });
    }

    res.json(buildCreditRequest(result.rows[0]));
  } catch (err) {
    console.error('Get credit request by id error:', err);
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
      `SELECT id, buyer_id, order_id, amount, approved_amount, reason, status,
              request_date, action_date, notes
       FROM credit_requests
       ORDER BY request_date DESC, created_at DESC`
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
      `SELECT id, buyer_id, order_id, amount, approved_amount, reason, status,
              request_date, action_date, notes
       FROM credit_requests
       WHERE buyer_id = $1
       ORDER BY request_date DESC, created_at DESC`,
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
  const { buyerId, orderId, amount, reason, notes } = req.body || {};

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!amount || !reason) {
    return res.status(400).json({ error: 'amount and reason are required' });
  }

  const targetBuyerId = userRole === 'R-BUYER' ? userId : buyerId;
  if (!targetBuyerId) {
    return res.status(400).json({ error: 'buyerId is required' });
  }

  const creditId = `CR-${Date.now().toString().slice(-6)}`;

  try {
    const result = await pool.query(
      `INSERT INTO credit_requests (
         id, buyer_id, order_id, amount, reason, status, request_date, notes
       ) VALUES ($1, $2, $3, $4, $5, 'Pending', CURRENT_DATE, $6)
       RETURNING id, buyer_id, order_id, amount, approved_amount, reason, status,
                 request_date, action_date, notes`,
      [creditId, targetBuyerId, orderId || null, amount, reason, notes || null]
    );

    await logActivity(
      req,
      'Create Credit Request',
      'Finance',
      `Credit request ${creditId} created for buyer ${targetBuyerId}.`
    );

    // Notify internal team that a new credit request is waiting for review.
    await createNotification(
      'Payment',
      'Credit Request Submitted',
      `Credit request ${creditId} was submitted.`,
      'medium',
      'seller',
      creditId
    );

    res.status(201).json(buildCreditRequest(result.rows[0]));
  } catch (err) {
    console.error('Create credit request error:', err);
    res.status(500).json({ error: 'Failed to create credit request' });
  }
};

// PATCH /api/credits/:id
export const updateCreditRequest = async (req: Request, res: Response) => {
  const userRole = (req as any).user?.role;
  if (userRole === 'R-BUYER') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const { id } = req.params;
  const { status, approvedAmount, notes } = req.body || {};

  const allowedStatuses = ['Pending', 'Approved', 'Rejected', 'Partially Approved'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  if (status === 'Rejected' && !String(notes || '').trim()) {
    return res.status(400).json({ error: 'Rejection reason is required' });
  }

  try {
    const current = await pool.query(
      `SELECT id, buyer_id, amount, status, approved_amount
       FROM credit_requests
       WHERE id = $1`,
      [id]
    );

    if (current.rows.length === 0) {
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
      existing.status === 'Approved' || existing.status === 'Partially Approved'
        ? previousApproved
        : 0;
    const nextContributed =
      status === 'Approved' || status === 'Partially Approved'
        ? finalApproved
        : 0;
    const creditDelta = nextContributed - previousContributed;

    const result = await pool.query(
      `UPDATE credit_requests
       SET status = $1,
           approved_amount = $2,
           action_date = $3,
           notes = $4
       WHERE id = $5
       RETURNING id, buyer_id, order_id, amount, approved_amount, reason, status,
                 request_date, action_date, notes`,
      [
        status,
        status === 'Pending' ? null : finalApproved,
        status === 'Pending' ? null : new Date().toISOString().slice(0, 10),
        notes ?? null,
        id
      ]
    );

    if (creditDelta !== 0) {
      await pool.query(
        `UPDATE users
         SET available_credit = GREATEST(0, COALESCE(available_credit, 0) + $1),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [creditDelta, existing.buyer_id]
      );
    }

    await logActivity(
      req,
      'Update Credit Request',
      'Finance',
      `Credit request ${id} marked ${status} with amount ${finalApproved}.`
    );

    // Notify buyer when credit request status changes.
    await createNotification(
      'Payment',
      `Credit Request ${status}`,
      `Your credit request ${id} is now ${status}.`,
      status === 'Approved' ? 'low' : 'medium',
      String(existing.buyer_id),
      String(id)
    );

    res.json(buildCreditRequest(result.rows[0]));
  } catch (err) {
    console.error('Update credit request error:', err);
    res.status(500).json({ error: 'Failed to update credit request' });
  }
};
