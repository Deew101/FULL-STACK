import React, { useRef, useCallback, memo } from 'react';
import { Task, TaskStatus } from '../../types/database';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useProjectStore } from '../../store/useProjectStore';
import { screenToWorld } from '../../lib/utils';
import {
  CheckCircle2,
  Clock,
  AlertOctagon,
  Circle,
  Paperclip,
  CheckSquare,
  GripHorizontal,
} from 'lucide-react';

interface TaskNodeProps {
  task: Task;
  isSelected: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}

const statusConfig: Record<
  TaskStatus,
  { label: string; bg: string; text: string; dot: string; icon: any }
> = {
  todo: {
    label: 'To Do',
    bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    text: 'text-slate-500',
    dot: 'bg-slate-400',
    icon: Circle,
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    text: 'text-emerald-600',
    dot: 'bg-emerald-500',
    icon: Clock,
  },
  blocked: {
    label: 'Blocked',
    bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800',
    text: 'text-rose-600',
    dot: 'bg-rose-500',
    icon: AlertOctagon,
  },
  done: {
    label: 'Done',
    bg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800',
    text: 'text-blue-600',
    dot: 'bg-blue-500',
    icon: CheckCircle2,
  },
};

export const TaskNode: React.FC<TaskNodeProps> = memo(({ task, isSelected, containerRef }) => {
  const {
    transform,
    selectTask,
    setActiveDetailTaskId,
    startConnection,
    updateConnection,
    endConnection,
    shakingTaskId,
  } = useCanvasStore();

  const {
    updateTaskPosition,
    createDependency,
    broadcastCardDrag,
    broadcastCardDragEnd,
  } = useProjectStore();

  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ mouseX: 0, mouseY: 0, taskX: task.pos_x, taskY: task.pos_y });

  const isShaking = shakingTaskId === task.id;
  const status = statusConfig[task.status] || statusConfig.todo;
  const StatusIcon = status.icon;

  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  // Dragging card mechanics
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Ignore if clicking on handles, buttons, or inputs
      if ((e.target as HTMLElement).closest('.handle-point')) return;
      if (e.button !== 0) return; // Left mouse only

      e.stopPropagation();

      const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
      selectTask(task.id, isMulti);

      isDraggingRef.current = true;
      dragStartPosRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        taskX: task.pos_x,
        taskY: task.pos_y,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;

        const deltaX = (moveEvent.clientX - dragStartPosRef.current.mouseX) / transform.scale;
        const deltaY = (moveEvent.clientY - dragStartPosRef.current.mouseY) / transform.scale;

        const newX = Math.round(dragStartPosRef.current.taskX + deltaX);
        const newY = Math.round(dragStartPosRef.current.taskY + deltaY);

        // Optimistically update locally and broadcast ephemeral drag
        updateTaskPosition(task.id, newX, newY, false);
        broadcastCardDrag(task.id, newX, newY);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          broadcastCardDragEnd(task.id);

          const deltaX = (upEvent.clientX - dragStartPosRef.current.mouseX) / transform.scale;
          const deltaY = (upEvent.clientY - dragStartPosRef.current.mouseY) / transform.scale;

          const finalX = Math.round(dragStartPosRef.current.taskX + deltaX);
          const finalY = Math.round(dragStartPosRef.current.taskY + deltaY);

          // Persist final position to Supabase and history stack
          updateTaskPosition(task.id, finalX, finalY, true);
        }

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [task.id, task.pos_x, task.pos_y, transform.scale, selectTask, updateTaskPosition, broadcastCardDrag, broadcastCardDragEnd]
  );

  // Dependency Handle Dragging
  const handleStartConnection = (e: React.MouseEvent, handle: 'top' | 'bottom') => {
    e.stopPropagation();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const worldPoint = screenToWorld(e.clientX, e.clientY, transform, rect);
    startConnection(task.id, handle, worldPoint);

    const onPointerMove = (moveEvent: MouseEvent) => {
      const currentWorld = screenToWorld(moveEvent.clientX, moveEvent.clientY, transform, rect);
      updateConnection(currentWorld);
    };

    const onPointerUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);

      // Check if mouse released over another node's top or bottom handle
      const targetHandle = document
        .elementFromPoint(upEvent.clientX, upEvent.clientY)
        ?.closest('.handle-point');

      if (targetHandle) {
        const targetTaskId = targetHandle.getAttribute('data-task-id');
        if (targetTaskId && targetTaskId !== task.id) {
          // Source is bottom handle, target is top handle
          createDependency(task.id, targetTaskId, 'blocks');
        }
      }

      endConnection();
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveDetailTaskId(task.id);
  };

  return (
    <div
      id={`node-${task.id}`}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`absolute w-[260px] select-none rounded-2xl bg-white dark:bg-slate-900 border transition-shadow duration-150 cursor-grab active:cursor-grabbing group ${
        isSelected
          ? 'ring-2 ring-brand-500 border-brand-500 shadow-xl shadow-brand-500/15 z-30'
          : 'border-slate-200/90 dark:border-slate-800 shadow-md hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 z-20'
      } ${isShaking ? 'animate-shake ring-2 ring-rose-500' : ''}`}
      style={{
        transform: `translate3d(${task.pos_x}px, ${task.pos_y}px, 0)`,
        willChange: 'transform',
      }}
    >
      {/* Top Handle (Target connector) */}
      <div
        data-task-id={task.id}
        data-handle="top"
        onMouseDown={(e) => handleStartConnection(e, 'top')}
        className="handle-point absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-brand-500 shadow-sm cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity hover:scale-125 hover:bg-brand-500 z-40"
        title="Connect dependency (target)"
      />

      {/* Card Content */}
      <div className="p-3.5 flex flex-col gap-2.5">
        {/* Header row: Status pill + Grip */}
        <div className="flex items-center justify-between gap-2">
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${status.bg}`}
          >
            <StatusIcon className="w-3 h-3 shrink-0" />
            <span>{status.label}</span>
          </div>

          <GripHorizontal className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition" />
        </div>

        {/* Task Title */}
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
          {task.title}
        </h4>

        {/* Short description preview if available */}
        {task.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
            {task.description.replace(/<[^>]*>/g, '')}
          </p>
        )}

        {/* Footer: Subtasks, Attachments, Assignee */}
        <div className="mt-1 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            {totalSubtasks > 0 && (
              <div
                className={`flex items-center gap-1 text-[11px] ${
                  completedSubtasks === totalSubtasks
                    ? 'text-emerald-600 font-medium'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
                title={`Subtasks: ${completedSubtasks}/${totalSubtasks}`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>
                  {completedSubtasks}/{totalSubtasks}
                </span>
              </div>
            )}

            {task.attachments && task.attachments.length > 0 && (
              <div
                className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400"
                title={`${task.attachments.length} attachment(s)`}
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>{task.attachments.length}</span>
              </div>
            )}
          </div>

          {/* Assignee Avatar */}
          {task.assignee ? (
            task.assignee.avatar_url ? (
              <img
                src={task.assignee.avatar_url}
                alt={task.assignee.display_name}
                className="w-6 h-6 rounded-full object-cover border border-white dark:border-slate-800 shadow-sm"
                title={`Assigned to ${task.assignee.display_name}`}
              />
            ) : (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                style={{ backgroundColor: task.assignee.cursor_color || '#6366f1' }}
                title={`Assigned to ${task.assignee.display_name}`}
              >
                {task.assignee.display_name.charAt(0).toUpperCase()}
              </div>
            )
          ) : (
            <div className="w-6 h-6 rounded-full border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-[9px] text-slate-400">
              ?
            </div>
          )}
        </div>
      </div>

      {/* Bottom Handle (Source connector) */}
      <div
        data-task-id={task.id}
        data-handle="bottom"
        onMouseDown={(e) => handleStartConnection(e, 'bottom')}
        className="handle-point absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white dark:bg-slate-800 border-2 border-brand-500 shadow-sm cursor-crosshair opacity-0 group-hover:opacity-100 transition-opacity hover:scale-125 hover:bg-brand-500 z-40"
        title="Drag to block another task"
      />
    </div>
  );
});

TaskNode.displayName = 'TaskNode';
