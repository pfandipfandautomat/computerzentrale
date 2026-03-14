import { Router } from 'express';
import { monitoringController } from '../controllers/monitoringController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/monitoring/settings - Get monitoring settings
router.get('/settings', asyncHandler(monitoringController.getSettings.bind(monitoringController)));

// GET /api/monitoring/ssh-key-status - Check if SSH key is configured
router.get('/ssh-key-status', asyncHandler(monitoringController.hasSSHKey.bind(monitoringController)));

// PUT /api/monitoring/settings - Update monitoring settings
router.put('/settings', asyncHandler(monitoringController.updateSettings.bind(monitoringController)));

// POST /api/monitoring/check - Trigger immediate monitoring check
router.post('/check', asyncHandler(monitoringController.checkNow.bind(monitoringController)));

// GET /api/monitoring/status - Get monitoring status
router.get('/status', asyncHandler(monitoringController.getStatus.bind(monitoringController)));

// POST /api/monitoring/ping/:id - Ping specific node
router.post('/ping/:id', asyncHandler(monitoringController.pingNode.bind(monitoringController)));

export default router;
