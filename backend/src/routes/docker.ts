import { Router } from 'express';
import { dockerController } from '../controllers/dockerController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/docker/hosts - Get all Docker hosts and their containers
router.get('/hosts', asyncHandler(dockerController.getDockerHosts.bind(dockerController)));

// GET /api/docker/:id/containers - Get containers for a node
router.get('/:id/containers', asyncHandler(dockerController.getContainers.bind(dockerController)));

// POST /api/docker/:nodeId/containers/:containerId/start - Start a container
router.post('/:nodeId/containers/:containerId/start', asyncHandler(dockerController.startContainer.bind(dockerController)));

// POST /api/docker/:nodeId/containers/:containerId/stop - Stop a container
router.post('/:nodeId/containers/:containerId/stop', asyncHandler(dockerController.stopContainer.bind(dockerController)));

// POST /api/docker/:nodeId/containers/:containerId/restart - Restart a container
router.post('/:nodeId/containers/:containerId/restart', asyncHandler(dockerController.restartContainer.bind(dockerController)));

// DELETE /api/docker/:nodeId/containers/:containerId - Delete a container
router.delete('/:nodeId/containers/:containerId', asyncHandler(dockerController.deleteContainer.bind(dockerController)));

// GET /api/docker/:nodeId/containers/:containerId/logs - Get container logs
router.get('/:nodeId/containers/:containerId/logs', asyncHandler(dockerController.getContainerLogs.bind(dockerController)));

export default router;
