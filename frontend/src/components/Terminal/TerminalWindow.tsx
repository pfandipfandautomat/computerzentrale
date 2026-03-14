import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Terminal as TerminalIcon, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Terminal } from './Terminal';
import { cn } from '@/lib/utils';
import { useWindowDrag } from '@/components/Sidebar/NodeDetailWindow/useWindowDrag';

interface TerminalWindowProps {
  nodeId: string;
  nodeName: string;
  onClose: () => void;
}

const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 1400;
const MAX_HEIGHT = 900;
const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 550;

export function TerminalWindow({ nodeId, nodeName, onClose }: TerminalWindowProps) {
  const { position, isDragging, windowRef, handleMouseDown } = useWindowDrag({
    initialPosition: { 
      x: Math.max(50, (window.innerWidth - DEFAULT_WIDTH) / 2),
      y: Math.max(50, (window.innerHeight - DEFAULT_HEIGHT) / 2 - 50)
    }
  });
  
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [preMaximizeState, setPreMaximizeState] = useState({ position: { x: 0, y: 0 }, size: { width: 0, height: 0 } });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Resize handling
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };
  }, [size]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStart.current.x;
      const deltaY = e.clientY - resizeStart.current.y;
      
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStart.current.width + deltaX));
      const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, resizeStart.current.height + deltaY));
      
      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'se-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Handle maximize/restore
  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      // Restore
      setSize(preMaximizeState.size);
      setIsMaximized(false);
    } else {
      // Maximize
      setPreMaximizeState({ position, size });
      setSize({ 
        width: window.innerWidth - 40, 
        height: window.innerHeight - 100 
      });
      setIsMaximized(true);
    }
  }, [isMaximized, position, size, preMaximizeState]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const windowStyle = isMaximized 
    ? { left: 20, top: 70, width: window.innerWidth - 40, height: window.innerHeight - 100 }
    : { left: position.x, top: position.y, width: size.width, height: size.height };

  return (
    <div
      ref={windowRef}
      className={cn(
        "fixed z-50 flex flex-col",
        "bg-card/95 backdrop-blur-xl",
        "border border-border/50 rounded-lg shadow-2xl",
        "overflow-hidden",
        (isDragging || isResizing) && "select-none"
      )}
      style={windowStyle}
    >
        {/* Header */}
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "flex items-center justify-between px-4 py-2.5 border-b border-border/50 bg-card/80",
            "select-none",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/30">
              <TerminalIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Terminal</h2>
              <span className="text-xs text-muted-foreground">{nodeName}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMaximize}
              className="h-7 w-7 rounded-md hover:bg-secondary"
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 rounded-md hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Terminal Content */}
        <div className="flex-1 min-h-0">
          <Terminal nodeId={nodeId} autoConnect />
        </div>

        {/* Resize Handle */}
        {!isMaximized && (
          <div
            onMouseDown={handleResizeStart}
            className={cn(
              "absolute bottom-0 right-0 w-4 h-4 cursor-se-resize",
              "after:absolute after:bottom-1 after:right-1",
              "after:w-2 after:h-2 after:border-r-2 after:border-b-2",
              "after:border-muted-foreground/30 after:rounded-br-sm",
              "hover:after:border-muted-foreground/60"
            )}
          />
        )}
    </div>
  );
}
