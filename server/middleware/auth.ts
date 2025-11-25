import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
}

// Admin check middleware - checks if user email is in admin list
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userEmail) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!ADMIN_EMAILS.includes(req.userEmail.toLowerCase())) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

