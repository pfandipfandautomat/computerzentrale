import { Router } from 'express';
import { cacheController } from '../controllers/cacheController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/cache/stats - Get cache statistics
router.get('/stats', asyncHandler(cacheController.getStats.bind(cacheController)));

// POST /api/cache/invalidate - Invalidate all SSH cache
router.post('/invalidate', asyncHandler(cacheController.invalidateAllCache.bind(cacheController)));

// POST /api/cache/invalidate/:nodeId - Invalidate cache for a specific node
router.post('/invalidate/:nodeId', asyncHandler(cacheController.invalidateNodeCache.bind(cacheController)));

// POST /api/cache/flush - Flush all cache (including non-SSH cache)
router.post('/flush', asyncHandler(cacheController.flushAllCache.bind(cacheController)));

export default router;
