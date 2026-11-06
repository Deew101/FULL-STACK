import React, { useRef, useState, useCallback, memo } from 'react';
import { Group } from '../../types/database';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useProjectStore } from '../../store/useProjectStore';
import {
  Layers,
  Flag,
  Trash2,
  GripHorizontal,
} from 'lucide-react';

interface GroupContainerProps {
  group: Group;
  isSelected: boolean;
}

const COLOR_PRESETS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
];

export const GroupContainer: React.FC<GroupContainerProps> = memo(({ group, isSelected }) => {
  const { transform, selectGroup } = useCanvasStore();
  const { updateGroup, deleteGroup } = useProjectStore();

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState(group.label);

  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const startDragRef = useRef({ mouseX: 0, mouseY: 0, x: group.pos_x, y: group.pos_y });
  const startResizeRef = useRef({ mouseX: 0, mouseY: 0, width: group.width, height: group.height });

  // Move Group
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('.group-control')) return;
      if (e.button !== 0) return;

      e.stopPropagation();
      selectGroup(group.id);

      isDraggingRef.current = true;
      startDragRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        x: group.pos_x,
        y: group.pos_y,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const deltaX = (moveEvent.clientX - startDragRef.current.mouseX) / transform.scale;
        const deltaY = (moveEvent.clientY - startDragRef.current.mouseY) / transform.scale;

        updateGroup(group.id, {
          pos_x: Math.round(startDragRef.current.x + deltaX),
          pos_y: Math.round(startDragRef.current.y + deltaY),
        });
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [group.id, group.pos_x, group.pos_y, transform.scale, selectGroup, updateGroup]
  );

  // Resize Group from bottom-right handle
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    isResizingRef.current = true;
    startResizeRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: group.width,
      height: group.height,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaW = (moveEvent.clientX - startResizeRef.current.mouseX) / transform.scale;
      const deltaH = (moveEvent.clientY - startResizeRef.current.mouseY) / transform.scale;

      const newWidth = Math.max(240, Math.round(startResizeRef.current.width + deltaW));
      const newHeight = Math.max(180, Math.round(startResizeRef.current.height + deltaH));

      updateGroup(group.id, { width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleSaveLabel = () => {
    setIsEditingLabel(false);
    if (labelInput.trim() && labelInput.trim() !== group.label) {
      updateGroup(group.id, { label: labelInput.trim() });
    }
  };

  const isSprint = group.kind === 'sprint';

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        selectGroup(group.id);
      }}
      className={`absolute rounded-3xl border-2 transition-all duration-100 select-none ${
        isSelected
          ? 'ring-2 ring-brand-500 shadow-xl'
          : 'shadow-sm hover:shadow-md'
      }`}
      style={{
        transform: `translate3d(${group.pos_x}px, ${group.pos_y}px, 0)`,
        width: `${group.width}px`,
        height: `${group.height}px`,
        borderColor: group.color,
        backgroundColor: `${group.color}0D`, // ~5% opacity tint
        zIndex: 5, // Under task nodes
      }}
    >
      {/* Group Header Bar */}
      <div
        onMouseDown={handleMouseDown}
        className="px-4 py-2.5 rounded-t-3xl border-b flex items-center justify-between cursor-grab active:cursor-grabbing backdrop-blur-xs"
        style={{
          borderColor: `${group.color}33`,
          backgroundColor: `${group.color}1A`,
        }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isSprint ? (
            <Layers className="w-4 h-4 shrink-0" style={{ color: group.color }} />
          ) : (
            <Flag className="w-4 h-4 shrink-0" style={{ color: group.color }} />
          )}

          {isEditingLabel ? (
            <input
              type="text"
              autoFocus
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onBlur={handleSaveLabel}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveLabel()}
              className="group-control px-2 py-0.5 text-xs font-bold rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-white"
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingLabel(true);
              }}
              className="text-xs font-bold tracking-wide uppercase truncate cursor-text"
              style={{ color: group.color }}
              title="Double-click to edit label"
            >
              {group.label}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="group-control flex items-center gap-1.5 pl-2">
          {/* Color picker circles */}
          <div className="hidden sm:flex items-center gap-1">
            {COLOR_PRESETS.slice(0, 4).map((c) => (
              <button
                key={c}
                onClick={(e) => {
                  e.stopPropagation();
                  updateGroup(group.id, { color: c });
                }}
                className={`w-3.5 h-3.5 rounded-full border border-white dark:border-slate-800 transition hover:scale-125 ${
                  group.color === c ? 'ring-1 ring-slate-800 dark:ring-white scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
                title="Change color"
              />
            ))}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteGroup(group.id);
            }}
            className="p-1 rounded text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-white/40 dark:hover:bg-slate-800/40 transition"
            title="Delete Group"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <GripHorizontal className="w-4 h-4 text-slate-400 opacity-60" />
        </div>
      </div>

      {/* Resize Handle at Bottom-Right */}
      <div
        onMouseDown={handleResizeStart}
        className="group-control absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 z-10"
        title="Drag to resize"
      >
        <div
          className="w-2.5 h-2.5 rounded-br-sm border-r-2 border-b-2"
          style={{ borderColor: group.color }}
        />
      </div>
    </div>
  );
});

GroupContainer.displayName = 'GroupContainer';
