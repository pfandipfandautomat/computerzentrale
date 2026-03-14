# Computerzentrale Frontend

Personal infrastructure monitoring webapp built with React, TypeScript, and Vite.

## Features

- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router** for navigation
- **Zustand** for state management (critical for React Flow integration)
- **@xyflow/react** for network topology visualization
- **shadcn/ui** components with Tailwind CSS
- **WebSocket** support for real-time updates
- **Display Options Panel** - Toggle visibility of edges, nodes, metrics, and UI elements
- **Node Highlighting** - Visual highlighting of connected nodes on hover/select
- **Telegram Alerts** - Per-node monitoring toggle with Telegram integration
- **Event Log Modal** - View node status change history
- **Metrics Viewer** - Interactive charts with multiple time ranges and metric types
- **Dashboard Viewport Persistence** - Saves position and zoom across sessions
- **Remote Restart** - Restart server nodes via SSH
- **Management Links** - Quick navigation from node details to management pages
- **PWA Support** - Web manifest and custom favicon

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── Canvas/           # React Flow canvas components
│   ├── layout/           # Layout components (Header, etc.)
│   ├── Modals/           # Modal dialogs (Add/Edit/Delete Node, EventLog)
│   ├── NodeDetail/       # Node detail components (MonitoringToggle)
│   ├── Sidebar/          # Sidebar components (NodeDetailWindow, Toolbar)
│   └── ui/               # shadcn/ui components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── pages/                # Page components (Dashboard, Nodes, Management, Settings)
├── services/             # API services
├── stores/               # Zustand stores (CRITICAL)
├── types/                # TypeScript type definitions
├── App.tsx               # Main app component
├── main.tsx              # Entry point
└── index.css             # Global styles
```

## State Management with Zustand

### ⚠️ CRITICAL: Why Zustand is Essential

This project uses **Zustand** for state management, and this is **critical** for proper React Flow integration. Here's why:

#### The Problem with React State + React Flow

React Flow re-renders nodes when the `nodes` array reference changes. If you store data that changes frequently (like Docker containers, monitoring status, etc.) directly in the nodes array, **every update will cause the entire canvas to re-render**, leading to:

- UI flickering
- Poor performance
- Interrupted user interactions (dragging, selecting)

#### The Solution: Separate State in Zustand

We use Zustand to separate concerns:

```typescript
// ✅ CORRECT: Separate frequently-changing data from nodes
interface InfraStore {
  nodes: InfraNode[]                              // React Flow nodes (stable)
  containersByNodeId: Record<string, Container[]> // Containers (changes often)
  // ...
}
```

```typescript
// ❌ WRONG: Storing containers in nodes causes re-renders
nodes: state.nodes.map(n => 
  n.id === nodeId ? { ...n, containers: newContainers } : n
)
```

### Store Architecture

#### `useInfraStore.ts` - Main Infrastructure Store

Manages:
- `nodes` - Infrastructure nodes (servers, routers, etc.)
- `edges` - Connections between nodes
- `selectedNodeId` - Currently selected node
- `nodeStatusById` - Monitoring status per node (separate from nodes!)
- `containersByNodeId` - Docker containers per node (separate from nodes!)
- `proxyConfigsByNodeId` - Reverse proxy configs per node (separate from nodes!)
- `wireguardStatusByNodeId` - WireGuard status per node (separate from nodes!)

**Why separate stores?** React Flow re-renders when the `nodes` array changes. By storing frequently-changing data (status, containers, configs) in separate maps keyed by node ID, we prevent unnecessary re-renders while still keeping the data reactive.

#### `useSettingsStore.ts` - Settings Store

Manages:
- Monitoring settings (ping interval, enabled state)
- Persisted to localStorage

#### `useDisplayStore.ts` - Display Settings Store

Manages dashboard display preferences:
- `showAllEdges` / `showWireGuardEdges` / `showRegularEdges` - Edge visibility toggles
- `showOfflineNodes` - Hide/show offline nodes
- `showNodeMetrics` - Toggle metrics display on nodes (CPU/MEM gauges, sparklines)
- `showNodeDetails` - Toggle details display (containers, proxy configs, WireGuard peers)
- `showMiniMap` / `showGrid` - Visual element toggles

**Persisted to localStorage** using Zustand's `persist` middleware.

#### `useAlertingStore.ts` - Alerting Store

Manages:
- `telegramConfig` - Telegram bot configuration and status
- `events` - Alert event history
- `alertRules` - Alert rule definitions
- Fetch, save, and test Telegram configuration
- Fetch events (global and per-node)

### Best Practices

1. **Never store frequently-changing data in React Flow nodes**
   ```typescript
   // ❌ BAD - causes canvas re-renders
   updateNode(id, { containers: newContainers })
   
   // ✅ GOOD - only NodeEditor re-renders
   set({ containersByNodeId: { ...state.containersByNodeId, [id]: containers } })
   ```

2. **Use selectors for derived data**
   ```typescript
   // Get containers for a specific node
   const containers = useInfraStore(state => state.containersByNodeId[nodeId])
   ```

3. **Keep UI state local when appropriate**
   ```typescript
   // ✅ OK - loading states, form data, hover states
   const [isLoading, setIsLoading] = useState(false)
   const [formData, setFormData] = useState({ name: '', host: '' })
   ```

4. **Use Zustand for shared/global state**
   ```typescript
   // ✅ Nodes, edges, selection, containers - shared across components
   const { nodes, selectedNodeId } = useInfraStore()
   ```

### Adding New Shared State

When adding new state that needs to be shared:

1. Add the state and actions to the appropriate store
2. Keep data that changes frequently **separate** from React Flow nodes
3. Components subscribe only to the state they need

Example:
```typescript
// In useInfraStore.ts
interface InfraStore {
  // ... existing state
  newFeatureData: Record<string, SomeData>
  updateNewFeatureData: (nodeId: string, data: SomeData) => void
}

// Implementation
updateNewFeatureData: (nodeId, data) => set(state => ({
  newFeatureData: { ...state.newFeatureData, [nodeId]: data }
}))
```

## Tag-Based Features

The application supports special tags that enable additional functionality when assigned to nodes:

### Docker Tag (`docker`)
- Fetches container list via SSH using `docker ps`
- Displays in both the node card and detail sidebar
- Shows container name, image, and state with color-coded indicators

### Reverse Proxy Tag (`reverse-proxy`)
- Parses nginx configs from `/etc/nginx/sites-enabled/` and `/etc/nginx/conf.d/`
- Extracts server_name (domains) and proxy_pass (upstreams)
- Shows SSL status with lock icon

### WireGuard Tag (`wireguard`)
- Runs `wg show all dump` via SSH
- Displays interface info, peer list, and transfer statistics
- Calculates online status based on last handshake (< 3 minutes = online)

### Adding New Tag Features

To add a new tag-based feature:

1. **Backend**: Add a new method to `sshService.ts` to fetch the data
2. **Backend**: Create a new controller and route
3. **Frontend**: Add the type to `types/index.ts`
4. **Frontend**: Add API method to `services/api.ts`
5. **Frontend**: Add state to `useInfraStore.ts` (use `Record<string, YourType>` pattern)
6. **Frontend**: Update `NodeEditor.tsx` to display the data
7. **Frontend**: Update `InfraNode.tsx` to show summary on the canvas

## API Integration

The frontend is configured to proxy API requests to `http://localhost:3001`. Update the proxy configuration in `vite.config.ts` if your backend runs on a different port.

## License

MIT — see [LICENSE](../LICENSE) for details.
