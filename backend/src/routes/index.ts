import { Router } from 'express';
import nodesRouter from './nodes.js';
import edgesRouter from './edges.js';
import monitoringRouter from './monitoring.js';
import dockerRouter from './docker.js';
import reverseProxyRouter from './reverseProxy.js';
import wireguardRouter from './wireguard.js';
import cacheRouter from './cache.js';
import metricsRouter from './metrics.js';
import authRouter from './auth.js';
import interfacesRouter from './interfaces.js';
import alertingRouter from './alerting.js';
import gpuRouter from './gpu.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Health check endpoint (no auth required)
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'computerzentrale-backend',
  });
});

// Auth routes (no auth required for login/status)
router.use('/auth', authRouter);

// Apply auth middleware to all other routes
router.use(authMiddleware);

// Mount protected route modules
router.use('/nodes', nodesRouter);
router.use('/edges', edgesRouter);
router.use('/monitoring', monitoringRouter);
router.use('/docker', dockerRouter);
router.use('/reverse-proxy', reverseProxyRouter);
router.use('/wireguard', wireguardRouter);
router.use('/cache', cacheRouter);
router.use('/metrics', metricsRouter);
router.use('/interfaces', interfacesRouter);
router.use('/alerting', alertingRouter);
router.use('/gpu', gpuRouter);

export default router;
