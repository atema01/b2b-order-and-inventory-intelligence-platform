import pool from '../config/db';
import { emitNotificationChanged } from './realtime';
import { sendEmailNotification } from './emailService';
export const createNotificationRecord = async (
  type: string,
  title: string,
  message: string,
  severity: 'low' | 'medium' | 'high' | string,
  recipientId: string,
  relatedId?: string
) => {
  console.log("email was initiated");
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
  (async () => {
    try {
      let emailAddress = '';
      if (recipientId === 'seller') {
        emailAddress = process.env.SELLER_EMAIL || '';
      } else {
        const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [recipientId]);
        if (userResult.rows.length > 0) {
          emailAddress = userResult.rows[0].email;
        }
      }
      if (emailAddress) {
        const subject = `[B2B Updates] ${title}`;
        await sendEmailNotification(emailAddress, subject, message);
      }
    } catch (e) {
      console.error("Could not send email for notification", e);
    }
  })();
  return notification;
};

