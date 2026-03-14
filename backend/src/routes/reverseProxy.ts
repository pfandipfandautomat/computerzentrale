import { Router } from 'express';
import { reverseProxyController } from '../controllers/reverseProxyController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/reverse-proxy/hosts - Get all reverse proxy hosts and their configs
router.get('/hosts', asyncHandler(reverseProxyController.getReverseProxyHosts.bind(reverseProxyController)));

// GET /api/reverse-proxy/:id/configs - Get reverse proxy configs for a node (legacy)
router.get('/:id/configs', asyncHandler(reverseProxyController.getConfigs.bind(reverseProxyController)));

// GET /api/reverse-proxy/:nodeId/files - List all nginx config files for a node
router.get('/:nodeId/files', asyncHandler(reverseProxyController.listConfigFiles.bind(reverseProxyController)));

// GET /api/reverse-proxy/:nodeId/files/:filename - Get content of a specific config file
router.get('/:nodeId/files/:filename', asyncHandler(reverseProxyController.getConfigFile.bind(reverseProxyController)));

// POST /api/reverse-proxy/:nodeId/files - Create a new nginx config
router.post('/:nodeId/files', asyncHandler(reverseProxyController.createConfig.bind(reverseProxyController)));

// DELETE /api/reverse-proxy/:nodeId/files/:filename - Delete a config file
router.delete('/:nodeId/files/:filename', asyncHandler(reverseProxyController.deleteConfig.bind(reverseProxyController)));

// POST /api/reverse-proxy/:nodeId/test - Test nginx configuration
router.post('/:nodeId/test', asyncHandler(reverseProxyController.testConfig.bind(reverseProxyController)));

// POST /api/reverse-proxy/:nodeId/reload - Reload nginx
router.post('/:nodeId/reload', asyncHandler(reverseProxyController.reloadNginx.bind(reverseProxyController)));

export default router;
