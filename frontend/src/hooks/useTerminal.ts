import { useRef, useCallback, useState, useEffect } from 'react';
import type { Terminal } from '@xterm/xterm';

interface UseTerminalOptions {
  nodeId: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
}

interface UseTerminalReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: (terminal: Terminal) => void;
  disconnect: () => void;
  resize: (cols: number, rows: number) => void;
}

const getWebSocketUrl = (): string => {
  if (typeof window === 'undefined') return 'ws://localhost:3001';
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.DEV ? 'localhost:3001' : window.location.host;
  
  return `${protocol}//${host}`;
};

export function useTerminal({
  nodeId,
  onConnected,
  onDisconnected,
  onError,
}: UseTerminalOptions): UseTerminalReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'terminal_stop' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const connect = useCallback((terminal: Terminal) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      disconnect();
    }

    terminalRef.current = terminal;
    setIsConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        // Request terminal session
        const cols = terminal.cols;
        const rows = terminal.rows;
        ws.send(JSON.stringify({
          type: 'terminal_start',
          nodeId,
          cols,
          rows,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'terminal_started':
              setIsConnected(true);
              setIsConnecting(false);
              onConnected?.();
              break;

            case 'terminal_output':
              if (message.data && terminalRef.current) {
                terminalRef.current.write(message.data);
              }
              break;

            case 'terminal_error':
              setError(message.message);
              setIsConnecting(false);
              onError?.(message.message);
              break;

            case 'terminal_closed':
              setIsConnected(false);
              setIsConnecting(false);
              onDisconnected?.();
              break;

            case 'error':
              setError(message.message);
              setIsConnecting(false);
              onError?.(message.message);
              break;
          }
        } catch (err) {
          console.error('Failed to parse terminal message:', err);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection error');
        setIsConnecting(false);
        onError?.('WebSocket connection error');
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        onDisconnected?.();
      };

      // Set up terminal input handler
      terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'terminal_input',
            data,
          }));
        }
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnecting(false);
      onError?.(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [nodeId, disconnect, onConnected, onDisconnected, onError]);

  const resize = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'terminal_resize',
        cols,
        rows,
      }));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    resize,
  };
}
