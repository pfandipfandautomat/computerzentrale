# Computerzentrale Backend

Personal infrastructure monitoring webapp backend built with Express, TypeScript, and SQLite.

## Features

- **RESTful API** for managing infrastructure nodes and connections
- **Real-time monitoring** with WebSocket support
- **Automated ping checks** using node-cron scheduler
- **SQLite database** with Drizzle ORM
- **TypeScript** for type safety
- **CORS enabled** for frontend integration
- **Telegram Alerting** - Per-node online/offline alerts via Telegram bot
- **Event Logging** - Track all status change events with alert history
- **Server Restart** - Remote server restart via SSH

## Tech Stack

- **Express.js** - Web framework
- **TypeScript** - Type-safe JavaScript
- **SQLite** - Lightweight database
- **Drizzle ORM** - Type-safe database toolkit
- **WebSocket (ws)** - Real-time communication
- **node-cron** - Task scheduling
- **ping** - Network monitoring
- **Redis** - Caching layer
- **InfluxDB** - Time series metrics

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Generate database migrations
npm run db:generate

# Run migrations
npm run db:migrate
```

### Development

```bash
# Start development server with hot reload
npm run dev
```

The server will start on `http://localhost:3001`

### Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Nodes
- `GET /api/nodes` - Get all nodes
- `GET /api/nodes/:id` - Get node by ID
- `POST /api/nodes` - Create new node
- `PATCH /api/nodes/:id` - Update node
- `DELETE /api/nodes/:id` - Delete node

### Edges
- `GET /api/edges` - Get all edges
- `GET /api/edges/:id` - Get edge by ID
- `POST /api/edges` - Create new edge
- `PUT /api/edges/:id` - Update edge
- `DELETE /api/edges/:id` - Delete edge

### Monitoring
- `GET /api/monitoring/status` - Get monitoring status
- `GET /api/monitoring/settings` - Get monitoring settings
- `PUT /api/monitoring/settings` - Update monitoring settings
- `POST /api/monitoring/check` - Trigger immediate check
- `POST /api/monitoring/ping/:id` - Ping specific node

### Docker
- `GET /api/docker/hosts` - Get all Docker hosts and containers
- `GET /api/docker/:id/containers` - Get Docker containers for a node
- `POST /api/docker/:nodeId/containers/:containerId/start` - Start a container
- `POST /api/docker/:nodeId/containers/:containerId/stop` - Stop a container
- `POST /api/docker/:nodeId/containers/:containerId/restart` - Restart a container
- `DELETE /api/docker/:nodeId/containers/:containerId` - Delete a container
- `GET /api/docker/:nodeId/containers/:containerId/logs` - Get container logs

### Metrics
- `GET /api/metrics/status` - Get metrics service status
- `GET /api/metrics/:nodeId/history` - Get ping history for a node
- `GET /api/metrics/:nodeId/uptime` - Get uptime statistics for a node
- `GET /api/metrics/:nodeId/aggregated` - Get aggregated metrics
- `GET /api/metrics/:nodeId/server` - Get server metrics (CPU, memory, etc.)
- `GET /api/metrics/:nodeId/server/latest` - Get latest server metrics
- `GET /api/metrics/:nodeId/server/aggregated` - Get aggregated server metrics

### Alerting
- `GET /api/alerting/telegram/config` - Get Telegram configuration status
- `POST /api/alerting/telegram/config` - Save Telegram configuration
- `POST /api/alerting/telegram/test` - Test Telegram connection
- `GET /api/alerting/events` - Get all alert events
- `GET /api/alerting/events/node/:nodeId` - Get events for a specific node
- `DELETE /api/alerting/events` - Clear all events
- `GET /api/alerting/event-types` - Get available event types
- `GET /api/alerting/rules` - Get alert rules
- `POST /api/alerting/rules` - Create alert rule
- `DELETE /api/alerting/rules/:id` - Delete alert rule

### Reverse Proxy
- `GET /api/reverse-proxy/:id/configs` - Get nginx proxy configurations
- `POST /api/reverse-proxy/:id/configs` - Create nginx proxy configuration
- `GET /api/reverse-proxy/:id/test` - Test nginx configuration
- `POST /api/reverse-proxy/:id/reload` - Reload nginx

### WireGuard
- `GET /api/wireguard/:id/status` - Get WireGuard VPN status
- `GET /api/wireguard/:id/interfaces` - Get WireGuard interfaces
- `GET /api/wireguard/:id/interfaces/:name` - Get interface details
- `POST /api/wireguard/:id/interfaces/:name/peer` - Add peer to interface

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/status` - Check auth status
- `POST /api/auth/logout` - Logout

### SSH
- `GET /api/nodes/:id/ssh-key` - Get SSH key for a node
- `POST /api/nodes/:id/ssh-key` - Store SSH key for a node
- `DELETE /api/nodes/:id/ssh-key` - Delete SSH key for a node
- `POST /api/nodes/:id/restart` - Restart a server node via SSH

### Network Interfaces
- `GET /api/interfaces/:id` - Get network interfaces for a node

## WebSocket Events

Connect to `ws://localhost:3001` to receive real-time updates:

- `connected` - Connection established
- `ping_results` - Monitoring check results
- `node_update` - Node created/updated
- `node_deleted` - Node deleted
- `edge_update` - Edge created/updated
- `edge_deleted` - Edge deleted

## Database Schema

### Nodes Table
- `id` - Unique identifier
- `name` - Node name
- `host` - Hostname or IP address
- `port` - Optional port number
- `type` - Node type (server, router, nas, iot, service, custom)
- `position_x`, `position_y` - Canvas position
- `status` - Current status (online, offline, unknown)
- `latency` - Ping latency in ms
- `last_checked` - Last monitoring check timestamp
- `created_at`, `updated_at` - Timestamps

### Edges Table
- `id` - Unique identifier
- `source` - Source node ID
- `target` - Target node ID
- `label` - Optional edge label
- `created_at` - Timestamp

### Settings Table
- `id` - Settings identifier (default: 'default')
- `ping_interval` - Monitoring interval in seconds
- `enabled` - Monitoring enabled flag

### Telegram Config Table
- `id` - Unique identifier
- `bot_token` - Telegram bot token (encrypted)
- `chat_id` - Telegram chat ID
- `enabled` - Alerts enabled flag

### Alert Rules Table
- `id` - Unique identifier
- `event_type` - Type of event to alert on
- `enabled` - Rule enabled flag
- `node_id` - Optional node filter
- `threshold` - Optional threshold value
- `message` - Custom alert message

### Events Table
- `id` - Unique identifier
- `event_type` - Type of event
- `node_id` - Associated node ID
- `node_name` - Node name at time of event
- `message` - Event message
- `details` - JSON details
- `severity` - Event severity (info, warning, error, critical)
- `alert_sent` - Whether Telegram alert was sent
- `created_at` - Timestamp

## Project Structure

```
backend/
├── src/
│   ├── controllers/       # Request handlers
│   ├── database/          # Database setup and schema
│   ├── middleware/        # Express middleware
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   │   ├── alertingService.ts      # Alert processing and event logging
│   │   ├── cacheService.ts         # Redis caching
│   │   ├── influxService.ts        # InfluxDB integration
│   │   ├── monitoringService.ts    # Ping monitoring
│   │   ├── serverMetricsService.ts # Server metrics collection
│   │   ├── sshService.ts           # SSH command execution
│   │   ├── telegramService.ts      # Telegram bot integration
│   │   └── websocketService.ts     # WebSocket management
│   ├── types/             # TypeScript types
│   └── index.ts           # Application entry point
├── drizzle/               # Database migrations (generated)
├── data/                  # SQLite database files
├── package.json
├── tsconfig.json
└── drizzle.config.ts
```

## License

MIT
