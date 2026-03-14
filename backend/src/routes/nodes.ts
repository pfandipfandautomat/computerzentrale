import { Router } from 'express';
import { nodeController } from '../controllers/nodeController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/nodes - Get all nodes
router.get('/', asyncHandler(nodeController.getAllNodes.bind(nodeController)));

// PATCH /api/nodes/positions - Batch update node positions (must come before /:id routes)
router.patch('/positions', asyncHandler(nodeController.updatePositions.bind(nodeController)));

// GET /api/nodes/:id - Get node by ID
router.get('/:id', asyncHandler(nodeController.getNodeById.bind(nodeController)));

// POST /api/nodes - Create new node
router.post('/', asyncHandler(nodeController.createNode.bind(nodeController)));

// PUT /api/nodes/:id - Update node
router.put('/:id', asyncHandler(nodeController.updateNode.bind(nodeController)));

// PATCH /api/nodes/:id - Partial update node
router.patch('/:id', asyncHandler(nodeController.updateNode.bind(nodeController)));

// DELETE /api/nodes/:id - Delete node
router.delete('/:id', asyncHandler(nodeController.deleteNode.bind(nodeController)));

// POST /api/nodes/:id/restart - Restart a node via SSH
router.post('/:id/restart', asyncHandler(nodeController.restartNode.bind(nodeController)));

export default router;
