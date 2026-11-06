import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CanvasTransform, Point } from '../types/canvas';
import { Dependency, Task } from '../types/database';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts screen/viewport pixel coordinates into canvas world coordinates
 */
export function screenToWorld(
  clientX: number,
  clientY: number,
  transform: CanvasTransform,
  containerRect: DOMRect | { left: number; top: number }
): Point {
  const mouseCanvasX = clientX - containerRect.left;
  const mouseCanvasY = clientY - containerRect.top;
  return {
    x: (mouseCanvasX - transform.x) / transform.scale,
    y: (mouseCanvasY - transform.y) / transform.scale,
  };
}

/**
 * Converts canvas world coordinates into screen/viewport pixel coordinates
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  transform: CanvasTransform,
  containerRect: DOMRect | { left: number; top: number }
): Point {
  return {
    x: worldX * transform.scale + transform.x + containerRect.left,
    y: worldY * transform.scale + transform.y + containerRect.top,
  };
}

/**
 * Generates smooth SVG cubic bezier path between two points
 */
export function getBezierPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sourceHandle: 'top' | 'bottom' = 'bottom',
  targetHandle: 'top' | 'bottom' = 'top'
): string {
  const dy = Math.abs(y2 - y1);
  const curvature = Math.max(40, dy * 0.5);

  const cp1Y = sourceHandle === 'bottom' ? y1 + curvature : y1 - curvature;
  const cp2Y = targetHandle === 'top' ? y2 - curvature : y2 + curvature;

  return `M ${x1} ${y1} C ${x1} ${cp1Y}, ${x2} ${cp2Y}, ${x2} ${y2}`;
}

/**
 * Checks if adding edge (newSource -> newTarget) creates a cycle in the dependency graph
 * Source blocks Target, so edge goes Source -> Target.
 * A cycle exists if there is already a path from Target -> Source.
 */
export function wouldCreateCycle(
  dependencies: Dependency[],
  newSourceId: string,
  newTargetId: string
): boolean {
  if (newSourceId === newTargetId) return true;

  // Build adjacency list for existing dependencies: u -> [v] (u blocks v)
  const adj = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (dep.type === 'blocks') {
      const list = adj.get(dep.source_task_id) || [];
      list.push(dep.target_task_id);
      adj.set(dep.source_task_id, list);
    }
  }

  // Check if we can reach newSourceId starting from newTargetId
  const visited = new Set<string>();
  const queue = [newTargetId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === newSourceId) {
      return true; // Cycle detected!
    }
    if (!visited.has(current)) {
      visited.add(current);
      const neighbors = adj.get(current) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }
  }

  return false;
}

/**
 * Finds all unfinished blocker tasks for a given task
 */
export function getUnfinishedBlockers(
  taskId: string,
  tasks: Task[],
  dependencies: Dependency[]
): Task[] {
  // Find all dependencies where source_task blocks this taskId
  const blockerDepIds = dependencies
    .filter((d) => d.target_task_id === taskId && d.type === 'blocks')
    .map((d) => d.source_task_id);

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const blockers: Task[] = [];

  for (const blockerId of blockerDepIds) {
    const blockerTask = taskMap.get(blockerId);
    if (blockerTask && blockerTask.status !== 'done') {
      blockers.push(blockerTask);
    }
  }

  return blockers;
}

/**
 * Helper to generate unique IDs for local mock state or optimistic items
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}
