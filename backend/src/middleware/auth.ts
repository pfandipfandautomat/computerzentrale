import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Use ENCRYPTION_SECRET if set, otherwise generate an ephemeral key (sessions won't survive restarts)
const JWT_SECRET = (() => {
  if (process.env.ENCRYPTION_SECRET) {
    return process.env.ENCRYPTION_SECRET;
  }
  console.warn('\x1b[33m⚠ ENCRYPTION_SECRET not set — using ephemeral key. Sessions will not survive restarts.\x1b[0m');
  console.warn('\x1b[33m  Run: openssl rand -hex 32 and set ENCRYPTION_SECRET in your .env file.\x1b[0m');
  return crypto.randomBytes(32).toString('hex');
})();
const APP_PASSWORD = process.env.APP_PASSWORD;

export interface AuthRequest extends Request {
  isAuthenticated?: boolean;
}

// Generate a session token
export function generateToken(): string {
  return jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: '7d' });
}

// Verify a session token
export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// Check if password protection is enabled
export function isPasswordProtected(): boolean {
  return !!APP_PASSWORD && APP_PASSWORD.length > 0;
}

// Verify password
export function verifyPassword(password: string): boolean {
  if (!APP_PASSWORD) return true;
  return password === APP_PASSWORD;
}

// Auth middleware - protects routes
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  // If no password is set, allow all requests
  if (!isPasswordProtected()) {
    req.isAuthenticated = true;
    return next();
  }

  // Check for token in cookie or Authorization header
  const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');

  if (token && verifyToken(token)) {
    req.isAuthenticated = true;
    return next();
  }

  res.status(401).json({ error: 'Unauthorized' });
}

// Auth middleware for WebSocket - returns boolean
export function verifyWebSocketAuth(token?: string): boolean {
  if (!isPasswordProtected()) return true;
  if (!token) return false;
  return verifyToken(token);
}
