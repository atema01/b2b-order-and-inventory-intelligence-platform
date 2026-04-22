import { Request, Response } from 'express';
import pool from '../config/db';
import { emitNotificationChanged } from '../services/realtime';

const getRecipientId = (req: Request) => {
  const user = (req as any).user;
  if (!user) return 'seller';
  return user.role === 'R-BUYER' ? user.userId : 'seller';
};

// GET /api/notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const recipientId = getRecipientId(req);
    const result = await pool.query(
      `SELECT id, type, title, message, time, is_read AS "isRead", severity, recipient_id AS "recipientId", related_id AS "relatedId"
       FROM notifications
       WHERE recipient_id = $1
       ORDER BY time DESC`,
      [recipientId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// POST /api/notifications/read-all
export const markAllNotificationsRead = async (req: Request, res: Response) => {
  try {
    const recipientId = getRecipientId(req);
    await pool.query(
      `UPDATE notifications
       SET is_read = true
       WHERE recipient_id = $1`,
      [recipientId]
    );
    emitNotificationChanged(recipientId, { action: 'read-all' });
    res.json({ success: true });
  } catch (err) {
    console.error('Mark notifications read error:', err);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
};

// POST /api/notifications/:id/read
export const markNotificationRead = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const recipientId = getRecipientId(req);
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = true
       WHERE id = $1 AND recipient_id = $2
       RETURNING id, type, title, message, time, is_read AS "isRead", severity, recipient_id AS "recipientId", related_id AS "relatedId"`,
      [id, recipientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    emitNotificationChanged(recipientId, {
      action: 'updated',
      notificationId: result.rows[0].id,
      notification: result.rows[0]
    });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  try {
    const recipientId = getRecipientId(req);
    const result = await pool.query(
      `DELETE FROM notifications
       WHERE id = $1 AND recipient_id = $2
       RETURNING id`,
      [id, recipientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    emitNotificationChanged(recipientId, {
      action: 'deleted',
      notificationId: id
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};
