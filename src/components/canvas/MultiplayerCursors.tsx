import React from 'react';
import { useProjectStore } from '../../store/useProjectStore';

export const MultiplayerCursors: React.FC = () => {
  const { remoteCursors } = useProjectStore();

  const cursorsList = Object.values(remoteCursors);
  if (cursorsList.length === 0) return null;

  return (
    <>
      {cursorsList.map((cursor) => (
        <div
          key={cursor.userId}
          className="absolute pointer-events-none transition-all duration-75 ease-out z-40"
          style={{
            transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)`,
          }}
        >
          {/* SVG Cursor Pointer */}
          <svg
            className="w-5 h-5 drop-shadow-md"
            viewBox="0 0 24 24"
            fill={cursor.color || '#6366f1'}
            stroke="white"
            strokeWidth="1.5"
          >
            <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z" />
          </svg>

          {/* Name Label */}
          <div
            className="absolute left-4 top-3 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white whitespace-nowrap shadow-sm"
            style={{ backgroundColor: cursor.color || '#6366f1' }}
          >
            {cursor.userName}
          </div>
        </div>
      ))}
    </>
  );
};
