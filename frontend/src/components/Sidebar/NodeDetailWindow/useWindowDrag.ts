import { useState, useCallback, useEffect, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface UseWindowDragOptions {
  initialPosition?: Position;
  boundaryPadding?: number;
}

export function useWindowDrag(options: UseWindowDragOptions = {}) {
  const { 
    initialPosition = { x: window.innerWidth / 2 - 240, y: 100 },
    boundaryPadding = 20 
  } = options;

  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only start drag if clicking on the header itself, not buttons
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const windowEl = windowRef.current;
    if (!windowEl) return;

    const windowWidth = windowEl.offsetWidth;
    const windowHeight = windowEl.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newX = e.clientX - dragOffset.current.x;
    let newY = e.clientY - dragOffset.current.y;

    // Constrain to viewport with padding
    newX = Math.max(boundaryPadding, Math.min(newX, viewportWidth - windowWidth - boundaryPadding));
    newY = Math.max(boundaryPadding, Math.min(newY, viewportHeight - windowHeight - boundaryPadding));

    setPosition({ x: newX, y: newY });
  }, [isDragging, boundaryPadding]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return {
    position,
    isDragging,
    windowRef,
    handleMouseDown,
  };
}
