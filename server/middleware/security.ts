import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // HIPAA-compliant security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.openai.com;");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
}

// Audit logging middleware
interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const auditLogs: AuditLog[] = [];

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

export function auditLog(action: string, resource: string, req: Request, metadata?: Record<string, unknown>) {
  const authReq = req as AuthenticatedRequest;
  const log: AuditLog = {
    id: crypto.randomUUID(),
    userId: authReq.user?.id,
    action,
    resource,
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.get('user-agent') || 'unknown',
    timestamp: new Date().toISOString(),
    metadata,
  };
  
  auditLogs.push(log);
  
  // In production, persist to database
  console.log(`[AUDIT] ${action} on ${resource} by ${log.userId || 'anonymous'} from ${log.ipAddress}`);
  
  return log;
}

export function auditMiddleware(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function (body) {
      if (res.statusCode < 400) {
        auditLog(action, req.path, req, {
          method: req.method,
          statusCode: res.statusCode,
        });
      }
      return originalSend.call(this, body);
    };
    
    next();
  };
}

// Data encryption utilities for PHI
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

export function encryptPHI(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptPHI(encryptedText: string): string {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Rate limiting (simple in-memory implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = rateLimitStore.get(key);
    
    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again after ${Math.ceil((record.resetTime - now) / 1000)} seconds.`,
      });
    }
    
    record.count++;
    next();
  };
}

// Get audit logs (admin only)
export function getAuditLogs(userId?: string, limit = 100): AuditLog[] {
  let logs = auditLogs;
  
  if (userId) {
    logs = logs.filter(log => log.userId === userId);
  }
  
  return logs.slice(-limit).reverse();
}

