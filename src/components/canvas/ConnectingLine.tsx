import React from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useProjectStore } from '../../store/useProjectStore';
import { getBezierPath } from '../../lib/utils';

export const ConnectingLine: React.FC = () => {
  const { pendingConnection } = useCanvasStore();
  const { tasks } = useProjectStore();

  if (!pendingConnection) return null;

  const sourceTask = tasks.find((t) => t.id === pendingConnection.sourceTaskId);
  if (!sourceTask) return null;

  // Task dimensions: default card width is 260px, height ~140px
  const CARD_WIDTH = 260;
  const CARD_HEIGHT = 140;

  const sourceX = sourceTask.pos_x + CARD_WIDTH / 2;
  const sourceY = pendingConnection.sourceHandle === 'bottom'
    ? sourceTask.pos_y + CARD_HEIGHT
    : sourceTask.pos_y;

  const targetX = pendingConnection.currentPoint.x;
  const targetY = pendingConnection.currentPoint.y;

  const path = getBezierPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    pendingConnection.sourceHandle,
    'top'
  );

  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible z-20">
      <path
        d={path}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2.5"
        strokeDasharray="5,5"
        className="animate-pulse"
      />
      <circle cx={targetX} cy={targetY} r="5" fill="#6366f1" />
    </svg>
  );
};
