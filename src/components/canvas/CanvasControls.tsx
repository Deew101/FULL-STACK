import React from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useProjectStore } from '../../store/useProjectStore';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  MousePointer,
  Hand,
  Plus,
  Layers,
  Flag,
  Undo2,
  Redo2,
} from 'lucide-react';

export const CanvasControls: React.FC = () => {
  const { transform, zoomIn, zoomOut, resetView, activeTool, setActiveTool } = useCanvasStore();
  const { createTask, createGroup, undo, redo, undoStack, redoStack } = useProjectStore();

  const zoomPercent = Math.round(transform.scale * 100);

  const handleAddNewTask = () => {
    // Place task in viewport center in world coords
    const worldX = (window.innerWidth / 2 - transform.x) / transform.scale - 120;
    const worldY = (window.innerHeight / 2 - transform.y) / transform.scale - 60;
    createTask({
      title: 'New Task',
      pos_x: Math.round(worldX),
      pos_y: Math.round(worldY),
    });
  };

  const handleAddNewGroup = (kind: 'sprint' | 'epic') => {
    const worldX = (window.innerWidth / 2 - transform.x) / transform.scale - 200;
    const worldY = (window.innerHeight / 2 - transform.y) / transform.scale - 150;
    createGroup({
      label: kind === 'sprint' ? 'Sprint Goal' : 'Epic Initiative',
      kind,
      pos_x: Math.round(worldX),
      pos_y: Math.round(worldY),
      width: 440,
      height: 320,
      color: kind === 'sprint' ? '#6366f1' : '#8b5cf6',
    });
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 p-1.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xl backdrop-blur-md">
      {/* Tool Toggles */}
      <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-800 pr-2">
        <button
          onClick={() => setActiveTool('select')}
          className={`p-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
            activeTool === 'select'
              ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Select & Drag tool (V)"
        >
          <MousePointer className="w-4 h-4" />
          <span className="hidden sm:inline">Select</span>
        </button>

        <button
          onClick={() => setActiveTool('pan')}
          className={`p-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
            activeTool === 'pan'
              ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Pan tool (H or Space+Drag)"
        >
          <Hand className="w-4 h-4" />
          <span className="hidden sm:inline">Pan</span>
        </button>
      </div>

      {/* Creation Actions */}
      <div className="flex items-center gap-1 border-r border-slate-200 dark:border-slate-800 pr-2">
        <button
          onClick={handleAddNewTask}
          className="px-2.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
          title="Add Task (or press N / double click)"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Task</span>
        </button>

        <button
          onClick={() => handleAddNewGroup('sprint')}
          className="px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold transition flex items-center gap-1.5"
          title="Add Sprint Container"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-500" />
          <span className="hidden sm:inline">Sprint</span>
        </button>

        <button
          onClick={() => handleAddNewGroup('epic')}
          className="px-2.5 py-1.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-semibold transition flex items-center gap-1.5"
          title="Add Epic Container"
        >
          <Flag className="w-3.5 h-3.5 text-purple-500" />
          <span className="hidden sm:inline">Epic</span>
        </button>
      </div>

      {/* Undo / Redo */}
      <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-800 pr-2">
        <button
          onClick={() => undo()}
          disabled={undoStack.length === 0}
          className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white disabled:opacity-30 rounded-lg transition"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => redo()}
          disabled={redoStack.length === 0}
          className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white disabled:opacity-30 rounded-lg transition"
          title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1 pl-1">
        <button
          onClick={zoomOut}
          className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300 w-12 text-center select-none">
          {zoomPercent}%
        </span>

        <button
          onClick={zoomIn}
          className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={resetView}
          className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Reset View (100%)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
