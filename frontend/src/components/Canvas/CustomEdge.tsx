import { memo, useState } from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from '@xyflow/react';
import { X } from 'lucide-react';
import { CustomEdgeData } from '@/types';
import { cn } from '@/lib/utils';

const CustomEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
  }: EdgeProps) => {
    const edgeData = data as CustomEdgeData | undefined;
    const isDimmed = edgeData?.isDimmed ?? false;
    
    const [isHovered, setIsHovered] = useState(false);

    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

    const onEdgeClick = (evt: React.MouseEvent) => {
      evt.stopPropagation();
      if (edgeData?.onDelete) {
        edgeData.onDelete(id);
      }
    };

    const strokeColor = style?.stroke || 'hsl(var(--muted-foreground))';

    return (
      <>
        <BaseEdge
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            ...style,
            strokeWidth: 2,
            stroke: strokeColor,
            strokeDasharray: '5,5',
            opacity: isDimmed ? 0.2 : 1,
            transition: 'opacity 0.2s ease-in-out',
            animation: edgeData?.sourceStatus === 'online' && edgeData?.targetStatus === 'online' 
              ? 'dashdraw 0.5s linear infinite' 
              : 'none',
          }}
        />
        <path
          d={edgePath}
          fill="none"
          strokeWidth={20}
          stroke="transparent"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{ 
            cursor: 'pointer', 
            pointerEvents: 'stroke',
            opacity: isDimmed ? 0.2 : 1,
          }}
        />
        <EdgeLabelRenderer>
          {isHovered && (
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
              }}
              className="nodrag nopan"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <button
                onClick={onEdgeClick}
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full',
                  'bg-destructive text-destructive-foreground',
                  'shadow-md transition-all hover:scale-110 hover:shadow-lg',
                  'border border-border'
                )}
                title="Delete connection"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </EdgeLabelRenderer>
        <style>{`
          @keyframes dashdraw {
            to {
              stroke-dashoffset: -10;
            }
          }
        `}</style>
      </>
    );
  }
);

CustomEdge.displayName = 'CustomEdge';

export default CustomEdge;
