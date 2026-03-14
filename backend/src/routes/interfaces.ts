import { Router } from 'express';
import { interfaceController } from '../controllers/interfaceController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/interfaces/:nodeId - Get all interfaces for a node
router.get('/:nodeId', asyncHandler(interfaceController.getNodeInterfaces.bind(interfaceController)));

// POST /api/interfaces/:nodeId - Create interface for a node
router.post('/:nodeId', asyncHandler(interfaceController.createInterface.bind(interfaceController)));

// DELETE /api/interfaces/:nodeId/:id - Delete interface
router.delete('/:nodeId/:id', asyncHandler(interfaceController.deleteInterface.bind(interfaceController)));

export default router;
