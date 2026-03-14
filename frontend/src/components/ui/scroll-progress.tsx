import * as React from 'react';
import { cn } from '@/lib/utils';

interface ScrollProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const ScrollProgress = React.forwardRef<HTMLDivElement, ScrollProgressProps>(
  ({ className, children, ...props }, ref) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const progressRef = React.useRef<HTMLDivElement>(null);
    const rafRef = React.useRef<number>();

    // Merge refs
    React.useImperativeHandle(ref, () => scrollRef.current!);

    React.useEffect(() => {
      const scrollEl = scrollRef.current;
      const progressEl = progressRef.current;
      if (!scrollEl || !progressEl) return;

      const updateProgress = () => {
        const { scrollTop, scrollHeight, clientHeight } = scrollEl;
        const maxScroll = scrollHeight - clientHeight;
        
        if (maxScroll <= 0) {
          // Content fits, no scrolling needed
          progressEl.style.opacity = '0';
          return;
        }

        const progress = scrollTop / maxScroll;
        progressEl.style.transform = `scaleX(${progress})`;
        // Show when scrolled, fade out near top
        progressEl.style.opacity = progress < 0.01 ? '0' : '1';
      };

      const onScroll = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(updateProgress);
      };

      // Initial check
      updateProgress();

      // Also check on resize (content might change)
      const resizeObserver = new ResizeObserver(updateProgress);
      resizeObserver.observe(scrollEl);

      scrollEl.addEventListener('scroll', onScroll, { passive: true });

      return () => {
        scrollEl.removeEventListener('scroll', onScroll);
        resizeObserver.disconnect();
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, []);

    return (
      <div className="relative flex-1 min-h-0">
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="absolute top-0 left-0 right-0 z-10 h-[2px] bg-primary/60 origin-left pointer-events-none"
          style={{
            transform: 'scaleX(0)',
            opacity: 0,
            transition: 'opacity 0.3s ease',
          }}
        />
        {/* Scrollable content */}
        <div
          ref={scrollRef}
          className={cn(
            'h-full overflow-y-auto scrollbar-none',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  }
);

ScrollProgress.displayName = 'ScrollProgress';

export { ScrollProgress };
