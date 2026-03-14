import { Router } from 'express';
import { edgeController } from '../controllers/edgeController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/edges - Get all edges
router.get('/', asyncHandler(edgeController.getAllEdges.bind(edgeController)));

// DELETE /api/edges - Delete all edges
router.delete('/', asyncHandler(edgeController.deleteAllEdges.bind(edgeController)));

// GET /api/edges/:id - Get edge by ID
router.get('/:id', asyncHandler(edgeController.getEdgeById.bind(edgeController)));

// POST /api/edges - Create new edge
router.post('/', asyncHandler(edgeController.createEdge.bind(edgeController)));

// PUT /api/edges/:id - Update edge
router.put('/:id', asyncHandler(edgeController.updateEdge.bind(edgeController)));

// DELETE /api/edges/:id - Delete edge
router.delete('/:id', asyncHandler(edgeController.deleteEdge.bind(edgeController)));

export default router;
