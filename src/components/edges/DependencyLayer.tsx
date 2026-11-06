import React, { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Dependency, DependencyType, Task } from '../../types/database';
import { getBezierPath } from '../../lib/utils';
import { X, Link2, Ban } from 'lucide-react';

export const DependencyLayer: React.FC = () => {
  const { dependencies, tasks } = useProjectStore();

  const taskMap = new Map<string, Task>();
  tasks.forEach((t) => taskMap.set(t.id, t));

  return (
    <svg className="absolute inset-0 pointer-events-none overflow-visible z-10">
      <defs>
        {/* Arrow marker for 'blocks' */}
        <marker
          id="marker-blocks"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
        </marker>

        {/* Arrow marker for 'relates_to' */}
        <marker
          id="marker-relates"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#06b6d4" />
        </marker>
      </defs>

      {dependencies.map((dep) => {
        const source = taskMap.get(dep.source_task_id);
        const target = taskMap.get(dep.target_task_id);
        if (!source || !target) return null;

        return <DependencyEdge key={dep.id} dependency={dep} source={source} target={target} />;
      })}
    </svg>
  );
};

const CARD_WIDTH = 260;
const CARD_HEIGHT = 140;

const DependencyEdge: React.FC<{
  dependency: Dependency;
  source: Task;
  target: Task;
}> = ({ dependency, source, target }) => {
  const { deleteDependency, updateDependencyType } = useProjectStore();
  const [isHovered, setIsHovered] = useState(false);

  // Source bottom handle center
  const x1 = source.pos_x + CARD_WIDTH / 2;
  const y1 = source.pos_y + CARD_HEIGHT;

  // Target top handle center
  const x2 = target.pos_x + CARD_WIDTH / 2;
  const y2 = target.pos_y;

  const path = getBezierPath(x1, y1, x2, y2, 'bottom', 'top');

  // Midpoint for interactive badge
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const isBlocks = dependency.type === 'blocks';
  const strokeColor = isBlocks ? '#ef4444' : '#06b6d4';
  const markerId = isBlocks ? 'url(#marker-blocks)' : 'url(#marker-relates)';

  const toggleType = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextType: DependencyType = isBlocks ? 'relates_to' : 'blocks';
    updateDependencyType(dependency.id, nextType);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteDependency(dependency.id);
  };

  return (
    <g
      className="pointer-events-auto cursor-pointer group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Invisible thick path for easier hovering / clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="18"
        className="pointer-events-stroke"
      />

      {/* Visible bezier line */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isHovered ? '3' : '2'}
        strokeDasharray={isBlocks ? undefined : '5,5'}
        markerEnd={markerId}
        className="transition-all duration-150"
      />

      {/* Interactive center badge (visible always or on hover) */}
      <foreignObject
        x={midX - 55}
        y={midY - 14}
        width="110"
        height="28"
        className="overflow-visible pointer-events-auto"
      >
        <div
          className={`flex items-center justify-between gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border shadow-md backdrop-blur-md transition-all duration-200 select-none ${
            isBlocks
              ? 'bg-rose-50/95 dark:bg-rose-950/95 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
              : 'bg-cyan-50/95 dark:bg-cyan-950/95 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
          } ${isHovered ? 'scale-110 shadow-lg' : 'opacity-85'}`}
        >
          <button
            onClick={toggleType}
            className="flex items-center gap-1 hover:underline"
            title="Click to toggle type: Blocks vs Relates"
          >
            {isBlocks ? <Ban className="w-3 h-3 text-rose-500" /> : <Link2 className="w-3 h-3 text-cyan-500" />}
            <span>{isBlocks ? 'Blocks' : 'Relates'}</span>
          </button>

          <button
            onClick={handleDelete}
            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-rose-600 transition"
            title="Delete Dependency"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </foreignObject>
    </g>
  );
};
