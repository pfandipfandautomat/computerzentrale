import { Router } from 'express';
import { wireguardController } from '../controllers/wireguardController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET /api/wireguard/hosts - Get all WireGuard hosts and their interfaces
router.get('/hosts', asyncHandler(wireguardController.getWireGuardHosts.bind(wireguardController)));

// GET /api/wireguard/:id/status - Get WireGuard status for a node (legacy)
router.get('/:id/status', asyncHandler(wireguardController.getStatus.bind(wireguardController)));

// GET /api/wireguard/:nodeId/interfaces - List all WireGuard interfaces on a node
router.get('/:nodeId/interfaces', asyncHandler(wireguardController.listInterfaces.bind(wireguardController)));

// GET /api/wireguard/:nodeId/interfaces/:interfaceName - Get detailed info for a specific interface
router.get('/:nodeId/interfaces/:interfaceName', asyncHandler(wireguardController.getInterface.bind(wireguardController)));

// POST /api/wireguard/:nodeId/interfaces/:interfaceName/peers - Create a new peer
router.post('/:nodeId/interfaces/:interfaceName/peers', asyncHandler(wireguardController.createPeer.bind(wireguardController)));

// DELETE /api/wireguard/:nodeId/interfaces/:interfaceName/peers/:publicKey - Delete a peer
router.delete('/:nodeId/interfaces/:interfaceName/peers/:publicKey', asyncHandler(wireguardController.deletePeer.bind(wireguardController)));

export default router;
