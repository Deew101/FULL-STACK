import { create } from 'zustand';
import { CanvasTransform, CanvasTool, MarqueeSelection, PendingConnection, Point } from '../types/canvas';

interface CanvasState {
  transform: CanvasTransform;
  activeTool: CanvasTool;
  selectedTaskIds: string[];
  selectedGroupId: string | null;
  activeDetailTaskId: string | null;
  marquee: MarqueeSelection | null;
  pendingConnection: PendingConnection | null;
  shakingTaskId: string | null;

  // Transform actions
  setTransform: (transform: Partial<CanvasTransform>) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAtPoint: (deltaFactor: number, clientX: number, clientY: number, containerRect: DOMRect) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;

  // Tool & selection actions
  setActiveTool: (tool: CanvasTool) => void;
  selectTask: (taskId: string, multi?: boolean) => void;
  setSelection: (taskIds: string[]) => void;
  selectGroup: (groupId: string | null) => void;
  clearSelection: () => void;
  setActiveDetailTaskId: (taskId: string | null) => void;

  // Marquee actions
  startMarquee: (start: Point) => void;
  updateMarquee: (current: Point) => void;
  endMarquee: () => void;

  // Connection actions
  startConnection: (sourceTaskId: string, sourceHandle: 'top' | 'bottom', point: Point) => void;
  updateConnection: (point: Point) => void;
  endConnection: () => void;

  // Animation triggers
  triggerShake: (taskId: string) => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3.0;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  transform: { x: window.innerWidth ? window.innerWidth / 2 - 300 : 200, y: window.innerHeight ? window.innerHeight / 2 - 200 : 150, scale: 1 },
  activeTool: 'select',
  selectedTaskIds: [],
  selectedGroupId: null,
  activeDetailTaskId: null,
  marquee: null,
  pendingConnection: null,
  shakingTaskId: null,

  setTransform: (newTransform) =>
    set((state) => ({
      transform: {
        ...state.transform,
        ...newTransform,
        scale: newTransform.scale !== undefined
          ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newTransform.scale))
          : state.transform.scale,
      },
    })),

  panBy: (dx, dy) =>
    set((state) => ({
      transform: {
        ...state.transform,
        x: state.transform.x + dx,
        y: state.transform.y + dy,
      },
    })),

  zoomAtPoint: (deltaFactor, clientX, clientY, containerRect) => {
    const { transform } = get();
    const mouseX = clientX - containerRect.left;
    const mouseY = clientY - containerRect.top;

    const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, transform.scale * deltaFactor));
    if (nextScale === transform.scale) return;

    // Zoom centered at cursor point
    const scaleRatio = nextScale / transform.scale;
    const newX = mouseX - (mouseX - transform.x) * scaleRatio;
    const newY = mouseY - (mouseY - transform.y) * scaleRatio;

    set({
      transform: {
        x: newX,
        y: newY,
        scale: nextScale,
      },
    });
  },

  zoomIn: () => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    get().zoomAtPoint(1.2, centerX, centerY, { left: 0, top: 0 } as DOMRect);
  },

  zoomOut: () => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    get().zoomAtPoint(0.8333, centerX, centerY, { left: 0, top: 0 } as DOMRect);
  },

  resetView: () => {
    const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 - 300 : 200;
    const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 - 200 : 150;
    set({
      transform: { x: centerX, y: centerY, scale: 1 },
    });
  },

  setActiveTool: (tool) => set({ activeTool: tool }),

  selectTask: (taskId, multi = false) => {
    set((state) => {
      if (multi) {
        const exists = state.selectedTaskIds.includes(taskId);
        return {
          selectedTaskIds: exists
            ? state.selectedTaskIds.filter((id) => id !== taskId)
            : [...state.selectedTaskIds, taskId],
          selectedGroupId: null,
        };
      }
      return {
        selectedTaskIds: [taskId],
        selectedGroupId: null,
      };
    });
  },

  setSelection: (taskIds) =>
    set({ selectedTaskIds: taskIds, selectedGroupId: null }),

  selectGroup: (groupId) =>
    set({ selectedGroupId: groupId, selectedTaskIds: [] }),

  clearSelection: () =>
    set({ selectedTaskIds: [], selectedGroupId: null, activeDetailTaskId: null }),

  setActiveDetailTaskId: (taskId) =>
    set({ activeDetailTaskId: taskId }),

  startMarquee: (start) =>
    set({
      marquee: {
        startX: start.x,
        startY: start.y,
        currentX: start.x,
        currentY: start.y,
        active: true,
      },
    }),

  updateMarquee: (current) =>
    set((state) => {
      if (!state.marquee) return state;
      return {
        marquee: {
          ...state.marquee,
          currentX: current.x,
          currentY: current.y,
        },
      };
    }),

  endMarquee: () => set({ marquee: null }),

  startConnection: (sourceTaskId, sourceHandle, point) =>
    set({
      pendingConnection: {
        sourceTaskId,
        sourceHandle,
        currentPoint: point,
      },
    }),

  updateConnection: (point) =>
    set((state) => {
      if (!state.pendingConnection) return state;
      return {
        pendingConnection: {
          ...state.pendingConnection,
          currentPoint: point,
        },
      };
    }),

  endConnection: () => set({ pendingConnection: null }),

  triggerShake: (taskId) => {
    set({ shakingTaskId: taskId });
    setTimeout(() => {
      if (get().shakingTaskId === taskId) {
        set({ shakingTaskId: null });
      }
    }, 500);
  },
}));
