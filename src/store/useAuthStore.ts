import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile } from '../types/database';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  initAuth: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  enableDemoUser: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  isLoading: true,

  initAuth: async () => {
    set({ isLoading: true });

    if (!isSupabaseConfigured) {
      // Check if demo user was active
      const cached = localStorage.getItem('spatial_demo_user');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          set({
            user: parsed.user,
            profile: parsed.profile,
            isLoading: false,
          });
          return;
        } catch {
          // ignore error
        }
      }
      set({ isLoading: false });
      return;
    }

    try {
      // Handle OAuth PKCE callback if code is in the query params
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        // Clean URL query params without reloading
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        set({ user: session.user, session });
        await fetchProfile(session.user);
      } else {
        set({ user: null, session: null, profile: null });
      }
    } catch (err) {
      console.warn('Auth init error:', err);
    } finally {
      set({ isLoading: false });
    }

    // Set up Supabase auth listener
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        set({ user: session.user, session, isLoading: false });
        await fetchProfile(session.user);
      } else {
        set({ user: null, session: null, profile: null, isLoading: false });
      }
    });

    async function fetchProfile(user: User) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          set({ profile: data as Profile });
        } else {
          // If trigger didn't catch or row not found, ensure fallback profile
          const fallbackProfile: Profile = {
            id: user.id,
            display_name:
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email?.split('@')[0] ||
              'User',
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
            cursor_color: '#6366f1',
          };
          set({ profile: fallbackProfile });
        }
      } catch (err) {
        console.warn('Failed to fetch profile:', err);
      }
    }
  },

  signInWithEmail: async (email, password) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, or use Continue as Demo Guest.') };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  },

  signUpWithEmail: async (email, password, displayName) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, or use Continue as Demo Guest.') };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName || email.split('@')[0],
        },
      },
    });
    return { error: error as Error | null };
  },

  signInWithGoogle: async () => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase is not configured. Please configure Supabase project credentials in your .env file.') };
    }
    // Correct redirect URL for GitHub Pages / SPA
    const baseUrl = window.location.origin + import.meta.env.BASE_URL;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: baseUrl,
      },
    });
    return { error: error as Error | null };
  },

  signOut: async () => {
    localStorage.removeItem('spatial_demo_user');
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    set({ user: null, session: null, profile: null });
  },

  updateProfile: async (updates) => {
    const { user, profile } = get();
    if (!user || !profile) return;

    const newProfile = { ...profile, ...updates };
    set({ profile: newProfile });

    if (isSupabaseConfigured) {
      await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
    } else {
      localStorage.setItem('spatial_demo_user', JSON.stringify({ user, profile: newProfile }));
    }
  },

  enableDemoUser: () => {
    const demoId = 'demo-user-' + Math.random().toString(36).substring(2, 7);
    const demoUser = {
      id: demoId,
      email: 'demo@spatialboard.app',
      app_metadata: {},
      user_metadata: { full_name: 'Alex Explorer' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as unknown as User;

    const demoProfile: Profile = {
      id: demoId,
      display_name: 'Alex Explorer',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face',
      cursor_color: '#6366f1',
    };

    localStorage.setItem('spatial_demo_user', JSON.stringify({ user: demoUser, profile: demoProfile }));
    set({ user: demoUser, profile: demoProfile, isLoading: false });
  },
}));
