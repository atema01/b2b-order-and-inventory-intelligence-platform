import { Request, Response } from 'express';
import pool from '../config/db';
import { suggestedQuestions } from '../ai/websiteKnowledge';
import { generateWebsiteHelpAnswer, isGeminiConfigured } from '../services/geminiService';

const requestWindowMs = 60 * 1000;
const requestLimit = 10;
const requestLog = new Map<string, number[]>();

const isRateLimited = (userId: string): boolean => {
  const now = Date.now();
  const existing = requestLog.get(userId) || [];
  const recent = existing.filter((timestamp) => now - timestamp < requestWindowMs);

  if (recent.length >= requestLimit) {
    requestLog.set(userId, recent);
    return true;
  }

  recent.push(now);
  requestLog.set(userId, recent);
  return false;
};

export const getChatbotStatus = async (_req: Request, res: Response) => {
  res.json({
    configured: isGeminiConfigured(),
    suggestedQuestions
  });
};

export const chatWithWebsiteAssistant = async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  const userId = authUser?.userId;
  const roleId = authUser?.role;
  const question = String(req.body?.message || '').trim();
  const currentPath = typeof req.body?.currentPath === 'string' ? req.body.currentPath.trim() : '';
  const currentPageTitle = typeof req.body?.currentPageTitle === 'string' ? req.body.currentPageTitle.trim() : '';

  if (!userId || !roleId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!question) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  if (question.length > 1000) {
    return res.status(400).json({ error: 'Message is too long. Please keep it under 1000 characters.' });
  }

  if (!isGeminiConfigured()) {
    return res.status(503).json({
      error: 'Chatbot is not configured yet. Add GEMINI_API_KEY to server/.env and restart the server.'
    });
  }

  if (isRateLimited(userId)) {
    return res.status(429).json({ error: 'Too many chatbot requests. Please wait a moment and try again.' });
  }

  try {
    const userResult = await pool.query(
      `SELECT r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );

    const permissionResult = await pool.query(
      `SELECT p.name
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = $1`,
      [roleId]
    );

    const roleName = userResult.rows[0]?.role_name || 'Unknown';
    const permissionNames = permissionResult.rows.map((row: { name: string }) => row.name);

    const answer = await generateWebsiteHelpAnswer(question, {
      userId,
      roleName,
      permissionNames,
      currentPath,
      currentPageTitle
    });

    if (!answer) {
      return res.status(502).json({ error: 'The assistant returned an empty response. Please try again.' });
    }

    return res.json({ answer });
  } catch (err) {
    console.error('Website assistant error:', err);
    return res.status(500).json({ error: 'Failed to get chatbot response.' });
  }
};
