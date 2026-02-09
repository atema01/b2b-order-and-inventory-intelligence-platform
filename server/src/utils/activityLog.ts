// src/utils/activityLog.ts
import { Request } from 'express';
import pool from '../config/db';

type ActorType = 'Admin' | 'Staff' | 'Buyer' | 'System';

const mapActorType = (roleId?: string): ActorType => {
  if (!roleId) return 'System';
  if (roleId === 'R-BUYER') return 'Buyer';
  if (roleId === 'R-ADMIN') return 'Admin';
  return 'Staff';
};

const getActorInfo = async (req: Request): Promise<{ actorName: string; actorType: ActorType }> => {
  const userId = (req as any).user?.userId;
  const roleId = (req as any).user?.role;
  if (!userId) {
    return { actorName: 'System', actorType: 'System' };
  }

  try {
    const result = await pool.query(
      'SELECT name FROM users WHERE id = $1',
      [userId]
    );
    const actorName = result.rows[0]?.name || 'System';
    return { actorName, actorType: mapActorType(roleId) };
  } catch {
    return { actorName: 'System', actorType: 'System' };
  }
};

export const logActivity = async (
  req: Request,
  action: string,
  module: string,
  details: string
) => {
  const { actorName, actorType } = await getActorInfo(req);
  await pool.query(
    `INSERT INTO system_logs (timestamp, actor_name, actor_type, action, module, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [new Date().toISOString(), actorName, actorType, action, module, details]
  );
};
