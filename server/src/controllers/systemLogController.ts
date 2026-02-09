import { Request, Response } from 'express';
import pool from '../config/db';

// GET /api/system-logs
export const getSystemLogs = async (req: Request, res: Response) => {
  try {
    const pageParam = parseInt(String(req.query.page || ''), 10);
    const limitParam = parseInt(String(req.query.limit || ''), 10);
    const usePagination = Number.isFinite(pageParam) && Number.isFinite(limitParam) && pageParam > 0 && limitParam > 0;
    const offset = usePagination ? (pageParam - 1) * limitParam : 0;

    const result = await pool.query(
      `SELECT id, timestamp, actor_name AS "actorName", actor_type AS "actorType", action, module, details
       FROM system_logs
       ORDER BY timestamp DESC
       ${usePagination ? 'LIMIT $1 OFFSET $2' : ''}`,
      usePagination ? [limitParam, offset] : []
    );
    if (usePagination) {
      const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM system_logs');
      const total = countResult.rows[0]?.count || 0;
      res.json({ data: result.rows, page: pageParam, limit: limitParam, total });
    } else {
      res.json(result.rows);
    }
  } catch (err) {
    console.error('Get system logs error:', err);
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
};
