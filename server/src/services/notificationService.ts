import pool from '../config/db';
import { emitNotificationChanged } from './realtime';

export const createNotificationRecord = async (
  type: string,
  title: string,
  message: string,
  severity: 'low' | 'medium' | 'high' | string,
  recipientId: string,
  relatedId?: string
) => {
  const result = await pool.query(
    `INSERT INTO notifications (type, title, message, time, is_read, severity, recipient_id, related_id)
     VALUES ($1, $2, $3, $4, false, $5, $6, $7)
     RETURNING id, type, title, message, time, is_read AS "isRead", severity, recipient_id AS "recipientId", related_id AS "relatedId"`,
    [type, title, message, new Date().toISOString(), severity, recipientId, relatedId || null]
  );

  const notification = result.rows[0];
  emitNotificationChanged(recipientId, {
    action: 'created',
    notificationId: notification.id,
    notification
  });

  return notification;
};
