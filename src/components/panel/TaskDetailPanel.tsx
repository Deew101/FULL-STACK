import React, { useEffect, useState, useRef } from 'react';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useProjectStore } from '../../store/useProjectStore';
import { TaskStatus, Subtask } from '../../types/database';
import { generateId } from '../../lib/utils';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  X,
  Trash2,
  Paperclip,
  Upload,
  Check,
  FileText,
  ExternalLink,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code,
  Heading2,
  Quote,
} from 'lucide-react';

export const TaskDetailPanel: React.FC = () => {
  const { activeDetailTaskId, setActiveDetailTaskId } = useCanvasStore();
  const { tasks, members, updateTask, uploadAttachment, deleteAttachment, isSaving } = useProjectStore();

  const task = tasks.find((t) => t.id === activeDetailTaskId);

  const [title, setTitle] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync title when active task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
    }
  }, [task?.id]);

  // Tiptap Rich Text Editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write a detailed description, notes, or acceptance criteria...',
      }),
    ],
    content: task?.description || '',
    onUpdate: ({ editor }) => {
      if (task) {
        updateTask(task.id, { description: editor.getHTML() }, false);
      }
    },
  });

  // Update editor content when active task switches
  useEffect(() => {
    if (editor && task && editor.getHTML() !== task.description) {
      editor.commands.setContent(task.description || '');
    }
  }, [task?.id, editor]);

  if (!task) return null;

  const handleTitleBlur = () => {
    if (title.trim() && title.trim() !== task.title) {
      updateTask(task.id, { title: title.trim() });
    }
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    await updateTask(task.id, { status: newStatus });
  };

  const handleAssigneeChange = (assigneeId: string) => {
    const val = assigneeId === 'unassigned' ? null : assigneeId;
    updateTask(task.id, { assignee_id: val });
  };

  // Subtasks checklist
  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const newSub: Subtask = {
      id: generateId(),
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    const currentSubs = task.subtasks || [];
    updateTask(task.id, { subtasks: [...currentSubs, newSub] });
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (subId: string) => {
    const currentSubs = task.subtasks || [];
    const updated = currentSubs.map((s) =>
      s.id === subId ? { ...s, completed: !s.completed } : s
    );
    updateTask(task.id, { subtasks: updated });
  };

  const handleDeleteSubtask = (subId: string) => {
    const currentSubs = task.subtasks || [];
    const updated = currentSubs.filter((s) => s.id !== subId);
    updateTask(task.id, { subtasks: updated });
  };

  // Attachments
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    for (let i = 0; i < files.length; i++) {
      await uploadAttachment(task.id, files[i]);
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const completedSubtasksCount = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubtasksCount = task.subtasks?.length || 0;
  const subtaskProgress =
    totalSubtasksCount > 0 ? Math.round((completedSubtasksCount / totalSubtasksCount) * 100) : 0;

  return (
    <aside className="fixed top-16 right-0 bottom-0 w-full sm:w-[460px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Panel Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* Autosave Status Indicator */}
          {isSaving ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Saving...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>Saved</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setActiveDetailTaskId(null)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Close panel (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Panel Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Title Input */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="Task Title"
            className="w-full text-xl font-bold bg-transparent border-0 border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-brand-500 focus:ring-0 text-slate-900 dark:text-white px-0 py-1 transition"
          />
        </div>

        {/* Metadata Controls: Status & Assignee */}
        <div className="grid grid-cols-2 gap-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
          {/* Status Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
              Status
            </label>
            <select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Assignee Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-400 mb-1">
              Assignee
            </label>
            <select
              value={task.assignee_id || 'unassigned'}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="unassigned">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profile?.display_name || 'Member'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description Rich Text Editor (Tiptap) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Description & Notes
          </label>

          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 transition">
            {/* Tiptap Toolbar */}
            {editor && (
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 ${
                    editor.isActive('bold') ? 'bg-slate-200 dark:bg-slate-700 text-brand-600 font-bold' : ''
                  }`}
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 ${
                    editor.isActive('italic') ? 'bg-slate-200 dark:bg-slate-700 text-brand-600' : ''
                  }`}
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 ${
                    editor.isActive('heading', { level: 2 }) ? 'bg-slate-200 dark:bg-slate-700 text-brand-600' : ''
                  }`}
                  title="Heading"
                >
                  <Heading2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 ${
                    editor.isActive('bulletList') ? 'bg-slate-200 dark:bg-slate-700 text-brand-600' : ''
                  }`}
                  title="Bullet List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 ${
                    editor.isActive('orderedList') ? 'bg-slate-200 dark:bg-slate-700 text-brand-600' : ''
                  }`}
                  title="Numbered List"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 ${
                    editor.isActive('blockquote') ? 'bg-slate-200 dark:bg-slate-700 text-brand-600' : ''
                  }`}
                  title="Quote"
                >
                  <Quote className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleCode().run()}
                  className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 ${
                    editor.isActive('code') ? 'bg-slate-200 dark:bg-slate-700 text-brand-600' : ''
                  }`}
                  title="Inline Code"
                >
                  <Code className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="p-4 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 min-h-[140px]">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Subtasks Checklist */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Subtasks ({completedSubtasksCount}/{totalSubtasksCount})
            </label>
            {totalSubtasksCount > 0 && (
              <span className="text-xs font-medium text-slate-500">{subtaskProgress}%</span>
            )}
          </div>

          {/* Progress bar */}
          {totalSubtasksCount > 0 && (
            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-300"
                style={{ width: `${subtaskProgress}%` }}
              />
            </div>
          )}

          {/* Subtasks list */}
          <div className="space-y-1.5 mb-3">
            {task.subtasks?.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition group text-sm"
              >
                <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sub.completed}
                    onChange={() => handleToggleSubtask(sub.id)}
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 dark:border-slate-700"
                  />
                  <span
                    className={`truncate text-sm ${
                      sub.completed
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {sub.title}
                  </span>
                </label>

                <button
                  onClick={() => handleDeleteSubtask(sub.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition"
                  title="Delete subtask"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Subtask Form */}
          <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Add a new checklist subtask..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={!newSubtaskTitle.trim()}
              className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-brand-600 hover:text-white text-xs font-medium text-slate-700 dark:text-slate-300 transition disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>

        {/* Attachments Section (Supabase Storage) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Attachments ({task.attachments?.length || 0})
            </label>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {task.attachments && task.attachments.length > 0 ? (
            <div className="space-y-2">
              {task.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 transition text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-brand-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        {att.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {Math.round(att.size / 1024)} KB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      title="Open attachment"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => deleteAttachment(task.id, att.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                      title="Delete attachment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center cursor-pointer hover:border-brand-500 transition"
            >
              <Paperclip className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-500">Drop files or click to upload</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
