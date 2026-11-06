export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

export type DependencyType = 'blocks' | 'relates_to';

export type GroupKind = 'sprint' | 'epic';

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  cursor_color: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
  profile?: Profile;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee_id: string | null;
  pos_x: number;
  pos_y: number;
  subtasks: Subtask[];
  attachments: TaskAttachment[];
  created_at: string;
  updated_at: string;
  assignee?: Profile;
}

export interface Dependency {
  id: string;
  project_id: string;
  source_task_id: string;
  target_task_id: string;
  type: DependencyType;
  created_at: string;
}

export interface Group {
  id: string;
  project_id: string;
  label: string;
  color: string;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  kind: GroupKind;
  created_at: string;
  updated_at: string;
}

export interface UserPresence {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  cursor_color: string;
  online_at: string;
}

export interface CursorPayload {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
}

export interface DragCardPayload {
  userId: string;
  taskId: string;
  x: number;
  y: number;
}
