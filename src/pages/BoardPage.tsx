import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useProjectStore } from '../store/useProjectStore';
import { AppHeader } from '../components/header/AppHeader';
import { InfiniteCanvas } from '../components/canvas/InfiniteCanvas';
import { CanvasControls } from '../components/canvas/CanvasControls';
import { TaskDetailPanel } from '../components/panel/TaskDetailPanel';
import { Loader2 } from 'lucide-react';

export const BoardPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentProject, selectProject, isLoading } = useProjectStore();

  useEffect(() => {
    if (projectId) {
      selectProject(projectId);
    }
  }, [projectId, selectProject]);

  if (isLoading && !currentProject) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
        <Loader2 className="w-9 h-9 animate-spin text-brand-500 mb-3" />
        <p className="text-sm font-medium text-slate-500">Connecting to spatial canvas...</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950 select-none">
      {/* Top Header */}
      <AppHeader />

      {/* Canvas Workspace Area */}
      <main className="flex-1 relative overflow-hidden">
        <InfiniteCanvas />
        <CanvasControls />
        <TaskDetailPanel />
      </main>
    </div>
  );
};
