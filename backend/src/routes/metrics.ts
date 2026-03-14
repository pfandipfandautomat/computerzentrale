import { Router } from 'express';
import {
  getNodeHistory,
  getNodeUptime,
  getAggregatedMetrics,
  getMetricsStatus,
  getServerMetrics,
  getLatestServerMetrics,
  getAggregatedServerMetrics,
} from '../controllers/metricsController.js';

const router = Router();

// Metrics status
router.get('/status', getMetricsStatus);

// Node-specific metrics
router.get('/:nodeId/history', getNodeHistory);
router.get('/:nodeId/uptime', getNodeUptime);
router.get('/:nodeId/aggregated', getAggregatedMetrics);

// Server metrics
router.get('/:nodeId/server', getServerMetrics);
router.get('/:nodeId/server/latest', getLatestServerMetrics);
router.get('/:nodeId/server/aggregated', getAggregatedServerMetrics);

export default router;
