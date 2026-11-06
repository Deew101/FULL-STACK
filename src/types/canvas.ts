export interface Point {
  x: number;
  y: number;
}

export interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

export interface MarqueeSelection {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
}

export interface PendingConnection {
  sourceTaskId: string;
  sourceHandle: 'top' | 'bottom';
  currentPoint: Point;
}

export type CanvasTool = 'select' | 'pan' | 'sprint' | 'epic';
