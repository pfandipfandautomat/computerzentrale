import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { websocketService } from './services/websocketService.js';
import { monitoringService } from './services/monitoringService.js';
import { encryptionService } from './services/encryptionService.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check encryption configuration
if (!encryptionService.isConfigured()) {
  console.warn('⚠️  WARNING: ENCRYPTION_SECRET is not set. SSH key storage will not work.');
  console.warn('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
}

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api', router);

// Root endpoint (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (_req, res) => {
    res.json({
      name: 'Computerzentrale Backend',
      version: '1.0.0',
      description: 'Personal infrastructure monitoring webapp backend',
      endpoints: {
        health: '/api/health',
        nodes: '/api/nodes',
        edges: '/api/edges',
        monitoring: '/api/monitoring',
      },
    });
  });
}

// Serve frontend for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

// Error handler (must be last)
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server
websocketService.initialize(server);

// Initialize monitoring service
monitoringService.initialize().catch((error) => {
  console.error('Failed to initialize monitoring service:', error);
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║           Computerzentrale Backend Server              ║
║                                                       ║
║  Server running on: http://localhost:${PORT}         ║
║  WebSocket available on: ws://localhost:${PORT}      ║
║                                                       ║
║  API Endpoints:                                       ║
║    - GET  /api/health                                 ║
║    - GET  /api/nodes                                  ║
║    - GET  /api/edges                                  ║
║    - GET  /api/monitoring/status                      ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
