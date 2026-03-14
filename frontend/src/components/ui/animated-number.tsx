import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  decimals?: number;
  duration?: number;
}

export function AnimatedNumber({ 
  value, 
  className, 
  decimals = 0,
  duration = 500 
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const frameRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const startValueRef = useRef(value);

  useEffect(() => {
    startValueRef.current = displayValue;
    startTimeRef.current = performance.now();

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) return;
      
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use ease-out-quart for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 4);
      
      const current = startValueRef.current + (value - startValueRef.current) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span className={cn("tabular-nums", className)}>
      {displayValue.toFixed(decimals)}
    </span>
  );
}
