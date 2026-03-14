import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useTerminal } from '@/hooks/useTerminal';
import { useThemeStore } from '@/stores/useThemeStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Power, PowerOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TerminalProps {
  nodeId: string;
  className?: string;
  autoConnect?: boolean;
}

export function Terminal({ nodeId, className, autoConnect = false }: TerminalProps) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const { theme } = useThemeStore();

  const {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    resize,
  } = useTerminal({
    nodeId,
    onConnected: () => {
      // Focus terminal when connected
      terminalRef.current?.focus();
    },
  });

  // Initialize terminal
  useEffect(() => {
    if (!terminalContainerRef.current || terminalRef.current) return;

    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: theme.terminal,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalContainerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    setIsInitialized(true);

    // Auto-connect if enabled
    if (autoConnect) {
      connect(terminal);
    }

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      setIsInitialized(false);
    };
  }, [nodeId, theme]); // Re-initialize when nodeId or theme changes

  // Handle resize
  useEffect(() => {
    if (!terminalContainerRef.current || !fitAddonRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && terminalRef.current) {
        try {
          fitAddonRef.current.fit();
          resize(terminalRef.current.cols, terminalRef.current.rows);
        } catch (e) {
          // Ignore resize errors during unmount
        }
      }
    });

    resizeObserver.observe(terminalContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [resize, isInitialized]);

  const handleConnect = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.clear();
      connect(terminalRef.current);
    }
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    if (terminalRef.current) {
      terminalRef.current.writeln('\r\n\x1b[33mDisconnected from server.\x1b[0m');
    }
  }, [disconnect]);

  const handleReconnect = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.clear();
      terminalRef.current.writeln('\x1b[33mReconnecting...\x1b[0m\r\n');
      connect(terminalRef.current);
    }
  }, [connect]);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="default" className="bg-green-600 text-xs">
              Connected
            </Badge>
          ) : isConnecting ? (
            <Badge variant="secondary" className="text-xs">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Connecting...
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Disconnected
            </Badge>
          )}
          {error && (
            <span className="text-xs text-red-400">{error}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!isConnected && !isConnecting && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleConnect}
              className="h-7 px-2 text-xs"
            >
              <Power className="h-3 w-3 mr-1" />
              Connect
            </Button>
          )}
          {isConnected && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReconnect}
                className="h-7 px-2 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reconnect
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDisconnect}
                className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
              >
                <PowerOff className="h-3 w-3 mr-1" />
                Disconnect
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Terminal Container */}
      <div
        ref={terminalContainerRef}
        className="flex-1 p-1 overflow-hidden"
        style={{ backgroundColor: theme.terminal.background }}
        onClick={() => terminalRef.current?.focus()}
      />
    </div>
  );
}
