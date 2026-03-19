import { Request, Response } from 'express';
import pool from '../config/db';

// GET /api/system-logs
export const getSystemLogs = async (req: Request, res: Response) => {
  try {
    const pageParam = parseInt(String(req.query.page || ''), 10);
    const limitParam = parseInt(String(req.query.limit || ''), 10);
    const usePagination = Number.isFinite(pageParam) && Number.isFinite(limitParam) && pageParam > 0 && limitParam > 0;
    const offset = usePagination ? (pageParam - 1) * limitParam : 0;

    const moduleFilter = String(req.query.module || '').trim();
    const search = String(req.query.search || '').trim();

    const whereClauses: string[] = [];
    const values: any[] = [];

    if (moduleFilter && moduleFilter !== 'All') {
      values.push(moduleFilter);
      whereClauses.push(`module = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      const idx = values.length;
      whereClauses.push(`(action ILIKE $${idx} OR details ILIKE $${idx} OR actor_name ILIKE $${idx})`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const selectValues = [...values];
    let paginationSql = '';
    if (usePagination) {
      selectValues.push(limitParam);
      const limitIdx = selectValues.length;
      selectValues.push(offset);
      const offsetIdx = selectValues.length;
      paginationSql = `LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
    }

    const result = await pool.query(
      `SELECT id, timestamp, actor_name AS "actorName", actor_type AS "actorType", action, module, details
       FROM system_logs
       ${whereSql}
       ORDER BY timestamp DESC
       ${paginationSql}`,
      selectValues
    );
    if (usePagination) {
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS count FROM system_logs ${whereSql}`,
        values
      );
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
