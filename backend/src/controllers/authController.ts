import { Request, Response } from 'express';
import { generateToken, verifyPassword, isPasswordProtected } from '../middleware/auth.js';

export const authController = {
  // Check if auth is required
  status: async (_req: Request, res: Response) => {
    res.json({
      required: isPasswordProtected(),
    });
  },

  // Login with password
  login: async (req: Request, res: Response) => {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (!verifyPassword(password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = generateToken();

    // Set cookie - use lax sameSite and only secure over HTTPS
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    return res.json({ success: true, token });
  },

  // Logout
  logout: async (_req: Request, res: Response) => {
    res.clearCookie('auth_token', { path: '/' });
    res.json({ success: true });
  },

  // Verify current session
  verify: async (_req: Request, res: Response) => {
    // If we reach here, the auth middleware already verified the token
    res.json({ authenticated: true });
  },
};
