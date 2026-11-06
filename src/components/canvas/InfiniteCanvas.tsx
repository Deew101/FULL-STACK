import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useProjectStore } from '../../store/useProjectStore';
import { screenToWorld } from '../../lib/utils';
import { TaskNode } from '../nodes/TaskNode';
import { GroupContainer } from '../groups/GroupContainer';
import { DependencyLayer } from '../edges/DependencyLayer';
import { ConnectingLine } from './ConnectingLine';
import { MultiplayerCursors } from './MultiplayerCursors';

export const InfiniteCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    transform,
    panBy,
    zoomAtPoint,
    activeTool,
    selectedTaskIds,
    selectedGroupId,
    clearSelection,
    setSelection,
    marquee,
    startMarquee,
    updateMarquee,
    endMarquee,
    setActiveDetailTaskId,
  } = useCanvasStore();

  const {
    tasks,
    groups,
    createTask,
    deleteSelectedTasks,
    broadcastCursor,
    undo,
    redo,
  } = useProjectStore();

  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const isSpacePressedRef = useRef(false);

  // Wheel zoom centered at mouse pointer
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      zoomAtPoint(zoomFactor, e.clientX, e.clientY, rect);
    },
    [zoomAtPoint]
  );

  // Mouse Down on canvas background
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // If clicking inside a task node, group handle, or control, ignore
      if ((e.target as HTMLElement).closest('.handle-point, #node, button, input, select, textarea, .group-control')) {
        return;
      }

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      // Middle click (button 1) or Space held or Pan tool active -> Pan canvas
      if (e.button === 1 || isSpacePressedRef.current || activeTool === 'pan') {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Left click (button 0)
      if (e.button === 0) {
        // If Shift is held, or if dragging in select tool, start marquee selection
        if (e.shiftKey) {
          startMarquee({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        } else {
          // Deselect everything
          clearSelection();
          // Pan by default on empty canvas drag
          setIsPanning(true);
          panStartRef.current = { x: e.clientX, y: e.clientY };
        }
      }
    },
    [activeTool, clearSelection, startMarquee]
  );

  // Global mouse move & up handlers for panning and marquee
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      // Broadcast cursor in canvas world coords
      const worldPoint = screenToWorld(e.clientX, e.clientY, transform, rect);
      broadcastCursor(Math.round(worldPoint.x), Math.round(worldPoint.y));

      // Handle active pan
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panBy(dx, dy);
        return;
      }

      // Handle active marquee
      if (marquee?.active) {
        updateMarquee({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    };

    const onMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
      }

      if (marquee?.active && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Compute marquee box in world coordinates
        const minScreenX = Math.min(marquee.startX, marquee.currentX);
        const maxScreenX = Math.max(marquee.startX, marquee.currentX);
        const minScreenY = Math.min(marquee.startY, marquee.currentY);
        const maxScreenY = Math.max(marquee.startY, marquee.currentY);

        const worldMin = screenToWorld(minScreenX + rect.left, minScreenY + rect.top, transform, rect);
        const worldMax = screenToWorld(maxScreenX + rect.left, maxScreenY + rect.top, transform, rect);

        const CARD_W = 260;
        const CARD_H = 140;

        // Find intersecting tasks
        const selected = tasks.filter((task) => {
          const taskRight = task.pos_x + CARD_W;
          const taskBottom = task.pos_y + CARD_H;
          return (
            task.pos_x <= worldMax.x &&
            taskRight >= worldMin.x &&
            task.pos_y <= worldMax.y &&
            taskBottom >= worldMin.y
          );
        }).map((t) => t.id);

        if (selected.length > 0) {
          setSelection(selected);
        }
        endMarquee();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isPanning, marquee, transform, panBy, updateMarquee, endMarquee, tasks, setSelection, broadcastCursor]);

  // Double click on empty canvas to create task at world coordinates
  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.handle-point, #node, button, input, select, textarea, .group-control')) {
      return;
    }
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const world = screenToWorld(e.clientX, e.clientY, transform, rect);

    createTask({
      title: 'New Task',
      pos_x: Math.round(world.x - 130), // Center card on cursor
      pos_y: Math.round(world.y - 70),
    });
  };

  // Keyboard Shortcuts (N, Del, Esc, Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input or editor
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.ProseMirror')
      ) {
        return;
      }

      // Space key for panning
      if (e.code === 'Space') {
        isSpacePressedRef.current = true;
      }

      // Delete or Backspace -> Delete selected tasks
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTaskIds.length > 0) {
          deleteSelectedTasks();
        }
      }

      // Esc -> Deselect all & close side panel
      if (e.key === 'Escape') {
        clearSelection();
        setActiveDetailTaskId(null);
      }

      // 'N' key -> New task at viewport center
      if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
        const worldX = (window.innerWidth / 2 - transform.x) / transform.scale - 130;
        const worldY = (window.innerHeight / 2 - transform.y) / transform.scale - 70;
        createTask({
          title: 'New Task',
          pos_x: Math.round(worldX),
          pos_y: Math.round(worldY),
        });
      }

      // Ctrl/Cmd + Z -> Undo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z -> Redo
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        redo();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [selectedTaskIds, deleteSelectedTasks, clearSelection, setActiveDetailTaskId, transform, createTask, undo, redo]);

  // Scaled background dot grid
  const gridSize = 24 * transform.scale;

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className={`relative w-full h-[calc(100vh-4rem)] overflow-hidden bg-slate-50 dark:bg-slate-950 ${
        isPanning || isSpacePressedRef.current || activeTool === 'pan'
          ? 'cursor-grab active:cursor-grabbing'
          : 'cursor-default'
      }`}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(148, 163, 184, 0.4) 1.5px, transparent 1.5px)',
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${transform.x}px ${transform.y}px`,
      }}
    >
      {/* Transformed World Container */}
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        {/* Layer 1: Sprints & Epics Groups (z-index 5) */}
        {groups.map((group) => (
          <GroupContainer
            key={group.id}
            group={group}
            isSelected={selectedGroupId === group.id}
          />
        ))}

        {/* Layer 2: Curved Bezier Dependency Edges (z-index 10) */}
        <DependencyLayer />

        {/* Layer 3: Active connection dragging line (z-index 20) */}
        <ConnectingLine />

        {/* Layer 4: Task Nodes (z-index 30) */}
        {tasks.map((task) => (
          <TaskNode
            key={task.id}
            task={task}
            isSelected={selectedTaskIds.includes(task.id)}
            containerRef={containerRef}
          />
        ))}

        {/* Layer 5: Multiplayer Live Cursors (z-index 40) */}
        <MultiplayerCursors />
      </div>

      {/* Marquee Selection Box (in screen coordinates) */}
      {marquee?.active && (
        <div
          className="absolute border border-brand-500 bg-brand-500/15 pointer-events-none z-50 rounded-sm"
          style={{
            left: `${Math.min(marquee.startX, marquee.currentX)}px`,
            top: `${Math.min(marquee.startY, marquee.currentY)}px`,
            width: `${Math.abs(marquee.currentX - marquee.startX)}px`,
            height: `${Math.abs(marquee.currentY - marquee.startY)}px`,
          }}
        />
      )}
    </div>
  );
};
