import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Public routes (no auth required)
router.get('/status', authController.status);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Protected route (requires auth)
router.get('/verify', authMiddleware, authController.verify);

export default router;
