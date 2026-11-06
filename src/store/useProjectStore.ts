import { create } from 'zustand';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Project,
  Task,
  Dependency,
  Group,
  ProjectMember,
  UserPresence,
  CursorPayload,
  DragCardPayload,
  DependencyType,
} from '../types/database';
import { useAuthStore } from './useAuthStore';
import { useCanvasStore } from './useCanvasStore';
import { toast } from './useToastStore';
import { wouldCreateCycle, getUnfinishedBlockers, generateId } from '../lib/utils';

interface HistoryAction {
  type: 'MOVE_TASK' | 'CREATE_TASK' | 'DELETE_TASK' | 'MOVE_GROUP' | 'CREATE_GROUP' | 'DELETE_GROUP';
  payload: any;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  members: ProjectMember[];
  tasks: Task[];
  dependencies: Dependency[];
  groups: Group[];

  // Ephemeral live multiplayer
  onlinePresences: Record<string, UserPresence>;
  remoteCursors: Record<string, CursorPayload>;
  remoteCardDrags: Record<string, DragCardPayload>;

  isLoading: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;

  // Realtime channel
  realtimeChannel: RealtimeChannel | null;

  // Undo / Redo stack
  undoStack: HistoryAction[];
  redoStack: HistoryAction[];

  // Project Actions
  fetchProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project | null>;
  selectProject: (projectId: string) => Promise<void>;
  joinProjectByCode: (code: string) => Promise<{ success: boolean; projectId?: string; error?: string }>;

  // Task Actions
  createTask: (task: Partial<Task>) => Promise<Task | null>;
  updateTask: (id: string, updates: Partial<Task>, pushHistory?: boolean) => Promise<boolean>;
  updateTaskPosition: (id: string, x: number, y: number, pushHistory?: boolean) => Promise<void>;
  deleteTask: (id: string, pushHistory?: boolean) => Promise<void>;
  deleteSelectedTasks: () => Promise<void>;

  // Dependency Actions
  createDependency: (sourceTaskId: string, targetTaskId: string, type?: DependencyType) => Promise<boolean>;
  deleteDependency: (id: string) => Promise<void>;
  updateDependencyType: (id: string, type: DependencyType) => Promise<void>;

  // Group Actions
  createGroup: (group: Partial<Group>) => Promise<Group | null>;
  updateGroup: (id: string, updates: Partial<Group>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;

  // Storage / Attachments
  uploadAttachment: (taskId: string, file: File) => Promise<string | null>;
  deleteAttachment: (taskId: string, attachmentId: string) => Promise<void>;

  // Multiplayer Broadcasts
  broadcastCursor: (x: number, y: number) => void;
  broadcastCardDrag: (taskId: string, x: number, y: number) => void;
  broadcastCardDragEnd: (taskId: string) => void;

  // History Actions
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  // Cleanup
  leaveCurrentProject: () => void;
}

// Throttle cursor broadcasts to 40ms (~25fps)
let lastBroadcastTime = 0;

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  members: [],
  tasks: [],
  dependencies: [],
  groups: [],
  onlinePresences: {},
  remoteCursors: {},
  remoteCardDrags: {},
  isLoading: false,
  isSaving: false,
  lastSavedAt: null,
  realtimeChannel: null,
  undoStack: [],
  redoStack: [],

  fetchProjects: async () => {
    const { user } = useAuthStore.getState();
    if (!user) return;

    set({ isLoading: true });

    if (!isSupabaseConfigured) {
      // Local fallback projects
      const localKey = `spatial_projects_${user.id}`;
      const saved = localStorage.getItem(localKey);
      let list: Project[] = [];
      if (saved) {
        list = JSON.parse(saved);
      } else {
        const defaultProject: Project = {
          id: 'demo-project-1',
          name: 'Sprint 42 - Next Gen Engine',
          description: 'Autonomous collaboration and spatial whiteboard',
          invite_code: 'sprint42',
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        list = [defaultProject];
        localStorage.setItem(localKey, JSON.stringify(list));
      }
      set({ projects: list, isLoading: false });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ projects: data as Project[] });
    } catch (err: any) {
      toast.error('Failed to load projects', err.message);
    } finally {
      set({ isLoading: false });
    }
  },

  createProject: async (name, description = '') => {
    const { user } = useAuthStore.getState();
    if (!user) return null;

    if (!isSupabaseConfigured) {
      const newProj: Project = {
        id: generateId(),
        name,
        description,
        invite_code: Math.random().toString(36).substring(2, 8),
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const projects = [newProj, ...get().projects];
      set({ projects });
      localStorage.setItem(`spatial_projects_${user.id}`, JSON.stringify(projects));
      toast.success('Project created');
      return newProj;
    }

    try {
      const { data: project, error: projError } = await supabase
        .from('projects')
        .insert([{ name, description, created_by: user.id }])
        .select()
        .single();

      if (projError) throw projError;

      // Add user as owner in project_members
      await supabase
        .from('project_members')
        .insert([{ project_id: project.id, user_id: user.id, role: 'owner' }]);

      set((state) => ({ projects: [project as Project, ...state.projects] }));
      toast.success('Project created successfully');
      return project as Project;
    } catch (err: any) {
      toast.error('Could not create project', err.message);
      return null;
    }
  },

  selectProject: async (projectId: string) => {
    get().leaveCurrentProject();
    set({ isLoading: true });

    const { user, profile } = useAuthStore.getState();

    if (!isSupabaseConfigured) {
      // Offline / Local mock loader with realistic sample data
      const current = get().projects.find((p) => p.id === projectId) || null;
      const sampleTasks: Task[] = [
        {
          id: 'task-1',
          project_id: projectId,
          title: 'Design Infinite 2D Spatial Canvas',
          description: '<p>Implement matrix transformations for smooth pan and zoom mechanics.</p>',
          status: 'done',
          assignee_id: user?.id || null,
          pos_x: 100,
          pos_y: 120,
          subtasks: [
            { id: 'st-1', title: 'Coordinate translation', completed: true },
            { id: 'st-2', title: 'Dotted background scaling', completed: true },
          ],
          attachments: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignee: profile || undefined,
        },
        {
          id: 'task-2',
          project_id: projectId,
          title: 'Implement SVG Dependency Edges',
          description: '<p>Curved bezier curves connecting node handles with cycle detection.</p>',
          status: 'in_progress',
          assignee_id: user?.id || null,
          pos_x: 520,
          pos_y: 120,
          subtasks: [
            { id: 'st-3', title: 'Top and bottom node handles', completed: true },
            { id: 'st-4', title: 'Bezier curve math', completed: false },
          ],
          attachments: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assignee: profile || undefined,
        },
        {
          id: 'task-3',
          project_id: projectId,
          title: 'Verify Production GitHub Pages Deploy',
          description: '<p>Check build artifacts and HashRouter deep links.</p>',
          status: 'todo',
          assignee_id: null,
          pos_x: 940,
          pos_y: 120,
          subtasks: [],
          attachments: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const sampleDeps: Dependency[] = [
        {
          id: 'dep-1',
          project_id: projectId,
          source_task_id: 'task-1',
          target_task_id: 'task-2',
          type: 'blocks',
          created_at: new Date().toISOString(),
        },
        {
          id: 'dep-2',
          project_id: projectId,
          source_task_id: 'task-2',
          target_task_id: 'task-3',
          type: 'blocks',
          created_at: new Date().toISOString(),
        },
      ];

      const sampleGroups: Group[] = [
        {
          id: 'grp-1',
          project_id: projectId,
          label: 'Sprint 42: Canvas Core',
          color: '#6366f1',
          pos_x: 50,
          pos_y: 40,
          width: 820,
          height: 380,
          kind: 'sprint',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      set({
        currentProject: current,
        tasks: sampleTasks,
        dependencies: sampleDeps,
        groups: sampleGroups,
        members: [
          {
            id: 'mem-1',
            project_id: projectId,
            user_id: user?.id || 'demo-user',
            role: 'owner',
            created_at: new Date().toISOString(),
            profile: profile || undefined,
          },
        ],
        isLoading: false,
      });
      return;
    }

    try {
      // 1. Fetch project info
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projErr) throw projErr;

      // 2. Fetch project members with profiles
      const { data: members, error: memErr } = await supabase
        .from('project_members')
        .select('*, profile:profiles(*)')
        .eq('project_id', projectId);

      if (memErr) throw memErr;

      // 3. Fetch tasks with assignee profile
      const { data: tasks, error: taskErr } = await supabase
        .from('tasks')
        .select('*, assignee:profiles(*)')
        .eq('project_id', projectId);

      if (taskErr) throw taskErr;

      // 4. Fetch dependencies
      const { data: dependencies, error: depErr } = await supabase
        .from('dependencies')
        .select('*')
        .eq('project_id', projectId);

      if (depErr) throw depErr;

      // 5. Fetch groups
      const { data: groups, error: grpErr } = await supabase
        .from('groups')
        .select('*')
        .eq('project_id', projectId);

      if (grpErr) throw grpErr;

      set({
        currentProject: project as Project,
        members: members as ProjectMember[],
        tasks: (tasks || []) as Task[],
        dependencies: (dependencies || []) as Dependency[],
        groups: (groups || []) as Group[],
        isLoading: false,
      });

      // 6. Connect Realtime channel: Presence, Broadcast & Postgres changes
      const channel = supabase.channel(`project:${projectId}`, {
        config: {
          broadcast: { ack: false },
          presence: { key: user?.id || 'anon' },
        },
      });

      // Presence sync
      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const presenceMap: Record<string, UserPresence> = {};
          Object.keys(state).forEach((key) => {
            const presences = state[key] as any[];
            if (presences && presences.length > 0) {
              const p = presences[0];
              presenceMap[p.user_id] = p;
            }
          });
          set({ onlinePresences: presenceMap });
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          set((state) => {
            const copy = { ...state.onlinePresences };
            newPresences.forEach((p: any) => {
              copy[p.user_id] = p;
            });
            return { onlinePresences: copy };
          });
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          set((state) => {
            const copy = { ...state.onlinePresences };
            const cursors = { ...state.remoteCursors };
            leftPresences.forEach((p: any) => {
              delete copy[p.user_id];
              delete cursors[p.user_id];
            });
            return { onlinePresences: copy, remoteCursors: cursors };
          });
        });

      // Broadcast listener: live cursor positions
      channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
        if (!payload || payload.userId === user?.id) return;
        set((state) => ({
          remoteCursors: {
            ...state.remoteCursors,
            [payload.userId]: payload,
          },
        }));
      });

      // Broadcast listener: live card dragging
      channel.on('broadcast', { event: 'card_drag' }, ({ payload }) => {
        if (!payload || payload.userId === user?.id) return;
        set((state) => ({
          remoteCardDrags: {
            ...state.remoteCardDrags,
            [payload.taskId]: payload,
          },
        }));
      });

      // Broadcast listener: live card drag end
      channel.on('broadcast', { event: 'card_drag_end' }, ({ payload }) => {
        if (!payload) return;
        set((state) => {
          const drags = { ...state.remoteCardDrags };
          delete drags[payload.taskId];
          return { remoteCardDrags: drags };
        });
      });

      // Postgres changes: TASKS
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          set((state) => {
            if (eventType === 'INSERT') {
              if (state.tasks.some((t) => t.id === newRecord.id)) return state;
              return { tasks: [...state.tasks, newRecord as Task] };
            }
            if (eventType === 'UPDATE') {
              return {
                tasks: state.tasks.map((t) =>
                  t.id === newRecord.id ? { ...t, ...(newRecord as Task) } : t
                ),
              };
            }
            if (eventType === 'DELETE') {
              return {
                tasks: state.tasks.filter((t) => t.id !== oldRecord.id),
              };
            }
            return state;
          });
        }
      );

      // Postgres changes: DEPENDENCIES
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dependencies', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          set((state) => {
            if (eventType === 'INSERT') {
              if (state.dependencies.some((d) => d.id === newRecord.id)) return state;
              return { dependencies: [...state.dependencies, newRecord as Dependency] };
            }
            if (eventType === 'UPDATE') {
              return {
                dependencies: state.dependencies.map((d) =>
                  d.id === newRecord.id ? (newRecord as Dependency) : d
                ),
              };
            }
            if (eventType === 'DELETE') {
              return {
                dependencies: state.dependencies.filter((d) => d.id !== oldRecord.id),
              };
            }
            return state;
          });
        }
      );

      // Postgres changes: GROUPS
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'groups', filter: `project_id=eq.${projectId}` },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;
          set((state) => {
            if (eventType === 'INSERT') {
              if (state.groups.some((g) => g.id === newRecord.id)) return state;
              return { groups: [...state.groups, newRecord as Group] };
            }
            if (eventType === 'UPDATE') {
              return {
                groups: state.groups.map((g) =>
                  g.id === newRecord.id ? (newRecord as Group) : g
                ),
              };
            }
            if (eventType === 'DELETE') {
              return {
                groups: state.groups.filter((g) => g.id !== oldRecord.id),
              };
            }
            return state;
          });
        }
      );

      // Subscribe and track presence
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user?.id,
            display_name: profile?.display_name || user?.email?.split('@')[0] || 'Contributor',
            avatar_url: profile?.avatar_url,
            cursor_color: profile?.cursor_color || '#6366f1',
            online_at: new Date().toISOString(),
          });
        }
      });

      set({ realtimeChannel: channel });
    } catch (err: any) {
      toast.error('Failed to load board', err.message);
      set({ isLoading: false });
    }
  },

  joinProjectByCode: async (code: string) => {
    if (!isSupabaseConfigured) {
      const proj = get().projects.find((p) => p.invite_code.toLowerCase() === code.trim().toLowerCase());
      if (proj) {
        return { success: true, projectId: proj.id };
      }
      return { success: false, error: 'Project invite code not found' };
    }

    try {
      const { data, error } = await supabase.rpc('join_project_by_code', { code: code.trim() });
      if (error) throw error;

      if (data?.success) {
        await get().fetchProjects();
        return { success: true, projectId: data.project_id };
      } else {
        return { success: false, error: data?.error || 'Failed to join project' };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  createTask: async (taskData) => {
    const { currentProject, tasks } = get();
    const { profile } = useAuthStore.getState();
    if (!currentProject) return null;

    const newTask: Task = {
      id: generateId(),
      project_id: currentProject.id,
      title: taskData.title || 'New Task',
      description: taskData.description || '',
      status: taskData.status || 'todo',
      assignee_id: taskData.assignee_id || null,
      pos_x: taskData.pos_x ?? 200,
      pos_y: taskData.pos_y ?? 200,
      subtasks: taskData.subtasks || [],
      attachments: taskData.attachments || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignee: profile || undefined,
    };

    // Optimistic update
    set({ tasks: [...tasks, newTask] });

    // History for undo/redo
    const historyAction: HistoryAction = {
      type: 'CREATE_TASK',
      payload: newTask,
      undo: async () => {
        await get().deleteTask(newTask.id, false);
      },
      redo: async () => {
        set((state) => ({ tasks: [...state.tasks, newTask] }));
        if (isSupabaseConfigured) {
          await supabase.from('tasks').insert([newTask]);
        }
      },
    };
    set((state) => ({
      undoStack: [...state.undoStack, historyAction],
      redoStack: [],
    }));

    if (!isSupabaseConfigured) return newTask;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          id: newTask.id,
          project_id: newTask.project_id,
          title: newTask.title,
          description: newTask.description,
          status: newTask.status,
          assignee_id: newTask.assignee_id,
          pos_x: newTask.pos_x,
          pos_y: newTask.pos_y,
          subtasks: newTask.subtasks,
          attachments: newTask.attachments,
        }])
        .select('*, assignee:profiles(*)')
        .single();

      if (error) throw error;
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === newTask.id ? (data as Task) : t)),
      }));
      return data as Task;
    } catch (err: any) {
      toast.error('Failed to save task to cloud', err.message);
      // rollback
      set({ tasks });
      return null;
    }
  },

  updateTask: async (id, updates, pushHistory = true) => {
    const { tasks, dependencies } = get();
    const taskIndex = tasks.findIndex((t) => t.id === id);
    if (taskIndex === -1) return false;

    const originalTask = tasks[taskIndex];

    // Blocker validation: If trying to set to 'done', check if any blocking task is not done
    if (updates.status === 'done' && originalTask.status !== 'done') {
      const blockers = getUnfinishedBlockers(id, tasks, dependencies);
      if (blockers.length > 0) {
        useCanvasStore.getState().triggerShake(id);
        const blockerTitles = blockers.map((b) => `"${b.title}"`).join(', ');
        toast.warning(
          'Blocked from completing!',
          `Cannot mark as Done. Blocked by: ${blockerTitles}`
        );
        return false;
      }
    }

    const updatedTask: Task = {
      ...originalTask,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Optimistic update
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? updatedTask : t)),
      isSaving: true,
    }));

    if (pushHistory) {
      const historyAction: HistoryAction = {
        type: 'MOVE_TASK',
        payload: { id, before: originalTask, after: updatedTask },
        undo: async () => {
          await get().updateTask(id, originalTask, false);
        },
        redo: async () => {
          await get().updateTask(id, updatedTask, false);
        },
      };
      set((state) => ({
        undoStack: [...state.undoStack, historyAction],
        redoStack: [],
      }));
    }

    if (!isSupabaseConfigured) {
      setTimeout(() => {
        set({ isSaving: false, lastSavedAt: new Date() });
      }, 200);
      return true;
    }

    try {
      const dbUpdates: any = { ...updates, updated_at: new Date().toISOString() };
      delete dbUpdates.assignee; // not a column in tasks table

      const { error } = await supabase
        .from('tasks')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;
      set({ isSaving: false, lastSavedAt: new Date() });
      return true;
    } catch (err: any) {
      toast.error('Failed to update task', err.message);
      // rollback
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? originalTask : t)),
        isSaving: false,
      }));
      return false;
    }
  },

  updateTaskPosition: async (id, x, y, pushHistory = true) => {
    const { tasks } = get();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const oldX = task.pos_x;
    const oldY = task.pos_y;

    // Apply locally
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, pos_x: x, pos_y: y } : t)),
    }));

    if (pushHistory) {
      const historyAction: HistoryAction = {
        type: 'MOVE_TASK',
        payload: { id, oldX, oldY, newX: x, newY: y },
        undo: async () => {
          await get().updateTaskPosition(id, oldX, oldY, false);
        },
        redo: async () => {
          await get().updateTaskPosition(id, x, y, false);
        },
      };
      set((state) => ({
        undoStack: [...state.undoStack, historyAction],
        redoStack: [],
      }));
    }

    if (!isSupabaseConfigured) return;

    try {
      await supabase
        .from('tasks')
        .update({ pos_x: x, pos_y: y, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (err) {
      console.warn('Failed to persist task position:', err);
    }
  },

  deleteTask: async (id, pushHistory = true) => {
    const { tasks, dependencies } = get();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const relatedDeps = dependencies.filter(
      (d) => d.source_task_id === id || d.target_task_id === id
    );

    // Optimistic removal
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      dependencies: state.dependencies.filter(
        (d) => d.source_task_id !== id && d.target_task_id !== id
      ),
    }));

    if (pushHistory) {
      const historyAction: HistoryAction = {
        type: 'DELETE_TASK',
        payload: { task, relatedDeps },
        undo: async () => {
          set((state) => ({
            tasks: [...state.tasks, task],
            dependencies: [...state.dependencies, ...relatedDeps],
          }));
          if (isSupabaseConfigured) {
            await supabase.from('tasks').insert([task]);
            if (relatedDeps.length > 0) {
              await supabase.from('dependencies').insert(relatedDeps);
            }
          }
        },
        redo: async () => {
          await get().deleteTask(id, false);
        },
      };
      set((state) => ({
        undoStack: [...state.undoStack, historyAction],
        redoStack: [],
      }));
    }

    if (!isSupabaseConfigured) return;

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      toast.error('Failed to delete task', err.message);
      // rollback
      set({ tasks, dependencies });
    }
  },

  deleteSelectedTasks: async () => {
    const { selectedTaskIds, clearSelection } = useCanvasStore.getState();
    if (selectedTaskIds.length === 0) return;

    for (const id of selectedTaskIds) {
      await get().deleteTask(id);
    }
    clearSelection();
    toast.info(`Deleted ${selectedTaskIds.length} item(s)`);
  },

  createDependency: async (sourceTaskId, targetTaskId, type = 'blocks') => {
    const { currentProject, dependencies } = get();
    if (!currentProject) return false;

    if (sourceTaskId === targetTaskId) {
      toast.warning('A task cannot depend on itself');
      return false;
    }

    // Check duplicate
    const exists = dependencies.some(
      (d) => d.source_task_id === sourceTaskId && d.target_task_id === targetTaskId
    );
    if (exists) {
      toast.info('Dependency already exists');
      return false;
    }

    // Cycle check!
    if (type === 'blocks' && wouldCreateCycle(dependencies, sourceTaskId, targetTaskId)) {
      toast.error(
        'Dependency cycle detected!',
        'Connecting these tasks would create an infinite circular dependency.'
      );
      return false;
    }

    const newDep: Dependency = {
      id: generateId(),
      project_id: currentProject.id,
      source_task_id: sourceTaskId,
      target_task_id: targetTaskId,
      type,
      created_at: new Date().toISOString(),
    };

    // Optimistic insert
    set((state) => ({
      dependencies: [...state.dependencies, newDep],
    }));

    toast.success('Dependency created', type === 'blocks' ? 'Task blocked' : 'Task related');

    if (!isSupabaseConfigured) return true;

    try {
      const { data, error } = await supabase
        .from('dependencies')
        .insert([{
          id: newDep.id,
          project_id: newDep.project_id,
          source_task_id: newDep.source_task_id,
          target_task_id: newDep.target_task_id,
          type: newDep.type,
        }])
        .select()
        .single();

      if (error) throw error;
      set((state) => ({
        dependencies: state.dependencies.map((d) => (d.id === newDep.id ? (data as Dependency) : d)),
      }));
      return true;
    } catch (err: any) {
      toast.error('Failed to create dependency', err.message);
      // rollback
      set({ dependencies });
      return false;
    }
  },

  deleteDependency: async (id) => {
    const { dependencies } = get();
    set((state) => ({
      dependencies: state.dependencies.filter((d) => d.id !== id),
    }));

    toast.info('Dependency removed');

    if (!isSupabaseConfigured) return;

    try {
      const { error } = await supabase.from('dependencies').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      toast.error('Failed to remove dependency', err.message);
      set({ dependencies });
    }
  },

  updateDependencyType: async (id, type) => {
    const { dependencies } = get();
    const dep = dependencies.find((d) => d.id === id);
    if (!dep) return;

    // If changing to 'blocks', ensure no cycle is formed
    if (type === 'blocks') {
      const otherDeps = dependencies.filter((d) => d.id !== id);
      if (wouldCreateCycle(otherDeps, dep.source_task_id, dep.target_task_id)) {
        toast.error('Cannot change to blocking: cycle would be formed');
        return;
      }
    }

    set((state) => ({
      dependencies: state.dependencies.map((d) => (d.id === id ? { ...d, type } : d)),
    }));

    if (!isSupabaseConfigured) return;

    try {
      await supabase.from('dependencies').update({ type }).eq('id', id);
    } catch (err: any) {
      toast.error('Failed to update dependency', err.message);
      set({ dependencies });
    }
  },

  createGroup: async (groupData) => {
    const { currentProject, groups } = get();
    if (!currentProject) return null;

    const newGroup: Group = {
      id: generateId(),
      project_id: currentProject.id,
      label: groupData.label || (groupData.kind === 'epic' ? 'New Epic' : 'Sprint 1'),
      color: groupData.color || (groupData.kind === 'epic' ? '#8b5cf6' : '#6366f1'),
      pos_x: groupData.pos_x ?? 150,
      pos_y: groupData.pos_y ?? 150,
      width: groupData.width ?? 380,
      height: groupData.height ?? 280,
      kind: groupData.kind || 'sprint',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    set({ groups: [...groups, newGroup] });

    if (!isSupabaseConfigured) return newGroup;

    try {
      const { data, error } = await supabase
        .from('groups')
        .insert([{
          id: newGroup.id,
          project_id: newGroup.project_id,
          label: newGroup.label,
          color: newGroup.color,
          pos_x: newGroup.pos_x,
          pos_y: newGroup.pos_y,
          width: newGroup.width,
          height: newGroup.height,
          kind: newGroup.kind,
        }])
        .select()
        .single();

      if (error) throw error;
      set((state) => ({
        groups: state.groups.map((g) => (g.id === newGroup.id ? (data as Group) : g)),
      }));
      return data as Group;
    } catch (err: any) {
      toast.error('Failed to save group', err.message);
      set({ groups });
      return null;
    }
  },

  updateGroup: async (id, updates) => {
    set((state) => ({
      groups: state.groups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
    }));

    if (!isSupabaseConfigured) return;

    try {
      await supabase
        .from('groups')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (err: any) {
      console.warn('Failed to update group:', err.message);
    }
  },

  deleteGroup: async (id) => {
    const { groups } = get();
    set((state) => ({
      groups: state.groups.filter((g) => g.id !== id),
    }));

    toast.info('Group container removed');

    if (!isSupabaseConfigured) return;

    try {
      await supabase.from('groups').delete().eq('id', id);
    } catch (err: any) {
      toast.error('Failed to delete group', err.message);
      set({ groups });
    }
  },

  uploadAttachment: async (taskId, file) => {
    const { tasks } = get();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return null;

    if (!isSupabaseConfigured) {
      // Local fallback mock URL using Object URL or data URL
      const mockAttachment = {
        id: generateId(),
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        type: file.type,
        created_at: new Date().toISOString(),
      };
      const newAttachments = [...(task.attachments || []), mockAttachment];
      await get().updateTask(taskId, { attachments: newAttachments });
      toast.success('File attached');
      return mockAttachment.url;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${task.project_id}/${taskId}/${generateId()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      const newAttachment = {
        id: generateId(),
        name: file.name,
        url: publicUrlData.publicUrl,
        size: file.size,
        type: file.type,
        created_at: new Date().toISOString(),
      };

      const newAttachments = [...(task.attachments || []), newAttachment];
      await get().updateTask(taskId, { attachments: newAttachments });
      toast.success('File uploaded');
      return publicUrlData.publicUrl;
    } catch (err: any) {
      toast.error('Upload failed', err.message);
      return null;
    }
  },

  deleteAttachment: async (taskId, attachmentId) => {
    const { tasks } = get();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newAttachments = (task.attachments || []).filter((a) => a.id !== attachmentId);
    await get().updateTask(taskId, { attachments: newAttachments });
    toast.info('Attachment removed');
  },

  broadcastCursor: (x, y) => {
    const now = Date.now();
    if (now - lastBroadcastTime < 35) return; // Throttled to ~30-40ms
    lastBroadcastTime = now;

    const { realtimeChannel } = get();
    const { user, profile } = useAuthStore.getState();
    if (!realtimeChannel || !user) return;

    realtimeChannel.send({
      type: 'broadcast',
      event: 'cursor',
      payload: {
        userId: user.id,
        userName: profile?.display_name || user.email?.split('@')[0] || 'Contributor',
        color: profile?.cursor_color || '#6366f1',
        x,
        y,
      },
    });
  },

  broadcastCardDrag: (taskId, x, y) => {
    const { realtimeChannel } = get();
    const { user } = useAuthStore.getState();
    if (!realtimeChannel || !user) return;

    realtimeChannel.send({
      type: 'broadcast',
      event: 'card_drag',
      payload: {
        userId: user.id,
        taskId,
        x,
        y,
      },
    });
  },

  broadcastCardDragEnd: (taskId) => {
    const { realtimeChannel } = get();
    if (!realtimeChannel) return;

    realtimeChannel.send({
      type: 'broadcast',
      event: 'card_drag_end',
      payload: { taskId },
    });
  },

  undo: async () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return;

    const action = undoStack[undoStack.length - 1];
    await action.undo();

    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, action],
    });
    toast.info('Undone');
  },

  redo: async () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return;

    const action = redoStack[redoStack.length - 1];
    await action.redo();

    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, action],
    });
    toast.info('Redone');
  },

  leaveCurrentProject: () => {
    const { realtimeChannel } = get();
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
    }
    set({
      currentProject: null,
      tasks: [],
      dependencies: [],
      groups: [],
      members: [],
      onlinePresences: {},
      remoteCursors: {},
      remoteCardDrags: {},
      realtimeChannel: null,
      undoStack: [],
      redoStack: [],
    });
  },
}));
