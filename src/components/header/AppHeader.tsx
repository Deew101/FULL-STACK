import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useThemeStore } from '../../store/useThemeStore';
import { toast } from '../../store/useToastStore';
import {
  ArrowLeft,
  Share2,
  Sun,
  Moon,
  LogOut,
  Layers,
} from 'lucide-react';

export const AppHeader: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuthStore();
  const { currentProject, onlinePresences } = useProjectStore();
  const { isDark, toggleTheme } = useThemeStore();

  const handleCopyInvite = () => {
    if (!currentProject) return;
    const origin = window.location.origin;
    const base = import.meta.env.BASE_URL;
    const url = `${origin}${base}#/projects?join=${currentProject.invite_code}`;
    navigator.clipboard.writeText(url);
    toast.success('Invite link copied!', 'Share this URL with your collaborators.');
  };

  const onlineList = Object.values(onlinePresences);

  return (
    <header className="h-16 px-5 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left Section: Back, Project Title, Invite Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/projects')}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Back to Projects"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
            <Layers className="w-4 h-4" />
          </div>

          <div>
            <h2 className="font-bold text-sm leading-tight text-slate-900 dark:text-white max-w-[200px] sm:max-w-xs truncate">
              {currentProject?.name || 'Loading Board...'}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">
                Code: {currentProject?.invite_code || '...'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleCopyInvite}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
          title="Copy project shareable join link"
        >
          <Share2 className="w-3.5 h-3.5 text-brand-500" />
          <span>Share</span>
        </button>
      </div>

      {/* Center: Realtime Multiplayer Presence */}
      <div className="flex items-center gap-2">
        <div className="flex items-center -space-x-2">
          {onlineList.map((presence) => (
            <div
              key={presence.user_id}
              className="relative group cursor-pointer"
              title={`${presence.display_name} (Online)`}
            >
              {presence.avatar_url ? (
                <img
                  src={presence.avatar_url}
                  alt={presence.display_name}
                  className="w-7 h-7 rounded-full object-cover border-2 border-white dark:border-slate-900 shadow-sm"
                  style={{ outline: `2px solid ${presence.cursor_color || '#6366f1'}` }}
                />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white dark:border-slate-900 shadow-sm"
                  style={{ backgroundColor: presence.cursor_color || '#6366f1' }}
                >
                  {presence.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Online Green Indicator */}
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900" />
            </div>
          ))}
        </div>

        {onlineList.length > 0 && (
          <span className="text-xs font-medium text-slate-400 hidden md:inline">
            {onlineList.length} active
          </span>
        )}
      </div>

      {/* Right Section: Theme Toggle, Profile Menu */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="Toggle Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Profile"
              className="w-7 h-7 rounded-full object-cover border border-slate-300 dark:border-slate-700"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
              style={{ backgroundColor: profile?.cursor_color || '#6366f1' }}
            >
              {profile?.display_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}

          <button
            onClick={() => signOut()}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
