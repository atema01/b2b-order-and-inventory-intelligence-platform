import dotenv from 'dotenv';
dotenv.config();

import { createNotificationRecord } from './src/services/notificationService';
import pool from './src/config/db';

async function test() {
  console.log("Testing notification recording...");
  try {
    const record = await createNotificationRecord(
      'System',
      'Test Notification',
      'This is a test notification to verify emails.',
      'low',
      'seller'
    );
    console.log("Record created:", record);
  } catch (error) {
    console.error("Failed:", error);
  } finally {
    await pool.end();
  }
}

test();
