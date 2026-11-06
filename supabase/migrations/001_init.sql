-- 001_init.sql: Schema, RLS policies, Triggers, and Realtime publication for Spatial Board

-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1. PROFILES TABLE
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  cursor_color text default '#6366f1',
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

-- Profiles RLS: Authenticated users can view all profiles; users can update only their own profile
create policy "Authenticated users can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Function and trigger to automatically create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger as $$
declare
  raw_name text;
  raw_avatar text;
  random_colors text[] := array['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#8b5cf6', '#ec4899'];
  picked_color text;
begin
  raw_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  raw_avatar := coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    ''
  );
  picked_color := random_colors[1 + floor(random() * array_length(random_colors, 1))::int];

  insert into public.profiles (id, display_name, avatar_url, cursor_color, updated_at)
  values (
    new.id,
    coalesce(raw_name, 'Explorer'),
    raw_avatar,
    picked_color,
    now()
  )
  on conflict (id) do update set
    display_name = coalesce(excluded.display_name, profiles.display_name),
    avatar_url = coalesce(nullif(excluded.avatar_url, ''), profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. PROJECTS TABLE
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  invite_code text unique default encode(gen_random_bytes(6), 'hex'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.projects enable row level security;


-- 3. PROJECT_MEMBERS TABLE
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique(project_id, user_id)
);

alter table public.project_members enable row level security;

-- Helper functions for RLS checks (security definer avoids recursion)
create or replace function public.is_project_member(p_id uuid, u_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_id and user_id = u_id
  );
$$ language sql security definer;

create or replace function public.is_project_editor_or_owner(p_id uuid, u_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_id and user_id = u_id and role in ('owner', 'editor')
  );
$$ language sql security definer;

create or replace function public.is_project_owner(p_id uuid, u_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_id and user_id = u_id and role = 'owner'
  );
$$ language sql security definer;


-- RLS for PROJECTS
create policy "Members can view their projects"
  on public.projects for select
  to authenticated
  using (
    public.is_project_member(id, auth.uid()) or
    created_by = auth.uid()
  );

create policy "Users can create projects"
  on public.projects for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Owners can update projects"
  on public.projects for update
  to authenticated
  using (public.is_project_owner(id, auth.uid()));

create policy "Owners can delete projects"
  on public.projects for delete
  to authenticated
  using (public.is_project_owner(id, auth.uid()));


-- RLS for PROJECT_MEMBERS
create policy "Members can view project membership"
  on public.project_members for select
  to authenticated
  using (
    public.is_project_member(project_id, auth.uid()) or
    user_id = auth.uid()
  );

create policy "Owners can insert members or users can join themselves"
  on public.project_members for insert
  to authenticated
  with check (
    public.is_project_owner(project_id, auth.uid()) or
    (user_id = auth.uid()) -- for initial creation or joining via invite
  );

create policy "Owners can update members"
  on public.project_members for update
  to authenticated
  using (public.is_project_owner(project_id, auth.uid()));

create policy "Owners can delete members or users can leave"
  on public.project_members for delete
  to authenticated
  using (
    public.is_project_owner(project_id, auth.uid()) or
    user_id = auth.uid()
  );


-- 4. TASKS TABLE
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text default '',
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  assignee_id uuid references public.profiles(id) on delete set null,
  pos_x double precision not null default 0,
  pos_y double precision not null default 0,
  subtasks jsonb default '[]'::jsonb,
  attachments jsonb default '[]'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.tasks enable row level security;

create policy "Members can view tasks"
  on public.tasks for select
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "Editors and owners can insert tasks"
  on public.tasks for insert
  to authenticated
  with check (public.is_project_editor_or_owner(project_id, auth.uid()));

create policy "Editors and owners can update tasks"
  on public.tasks for update
  to authenticated
  using (public.is_project_editor_or_owner(project_id, auth.uid()));

create policy "Editors and owners can delete tasks"
  on public.tasks for delete
  to authenticated
  using (public.is_project_editor_or_owner(project_id, auth.uid()));


-- 5. DEPENDENCIES TABLE
create table if not exists public.dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_task_id uuid not null references public.tasks(id) on delete cascade,
  target_task_id uuid not null references public.tasks(id) on delete cascade,
  type text not null default 'blocks' check (type in ('blocks', 'relates_to')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  unique (source_task_id, target_task_id),
  check (source_task_id != target_task_id)
);

alter table public.dependencies enable row level security;

create policy "Members can view dependencies"
  on public.dependencies for select
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "Editors and owners can insert dependencies"
  on public.dependencies for insert
  to authenticated
  with check (public.is_project_editor_or_owner(project_id, auth.uid()));

create policy "Editors and owners can update dependencies"
  on public.dependencies for update
  to authenticated
  using (public.is_project_editor_or_owner(project_id, auth.uid()));

create policy "Editors and owners can delete dependencies"
  on public.dependencies for delete
  to authenticated
  using (public.is_project_editor_or_owner(project_id, auth.uid()));


-- 6. GROUPS TABLE (Sprints / Epics)
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  color text not null default '#6366f1',
  pos_x double precision not null default 0,
  pos_y double precision not null default 0,
  width double precision not null default 340,
  height double precision not null default 260,
  kind text not null default 'sprint' check (kind in ('sprint', 'epic')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

alter table public.groups enable row level security;

create policy "Members can view groups"
  on public.groups for select
  to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create policy "Editors and owners can insert groups"
  on public.groups for insert
  to authenticated
  with check (public.is_project_editor_or_owner(project_id, auth.uid()));

create policy "Editors and owners can update groups"
  on public.groups for update
  to authenticated
  using (public.is_project_editor_or_owner(project_id, auth.uid()));

create policy "Editors and owners can delete groups"
  on public.groups for delete
  to authenticated
  using (public.is_project_editor_or_owner(project_id, auth.uid()));


-- 7. HELPER FUNCTION TO JOIN VIA INVITE CODE
create or replace function public.join_project_by_code(code text)
returns jsonb as $$
declare
  target_project record;
  membership record;
begin
  select * into target_project from public.projects where invite_code = code limit 1;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid invite code or project not found');
  end if;

  select * into membership from public.project_members
    where project_id = target_project.id and user_id = auth.uid() limit 1;

  if found then
    return jsonb_build_object('success', true, 'project_id', target_project.id, 'already_member', true);
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (target_project.id, auth.uid(), 'editor');

  return jsonb_build_object('success', true, 'project_id', target_project.id, 'already_member', false);
end;
$$ language plpgsql security definer;


-- 8. ENABLE REALTIME PUBLICATION
-- Enable publication on tables so Supabase client realtime postgres_changes can receive events
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.dependencies;
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.project_members;


-- 9. STORAGE BUCKET CONFIGURATION (for task attachments)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "Attachments are readable by authenticated users"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attachments');

create policy "Attachments can be uploaded by authenticated users"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'attachments');

create policy "Attachments can be deleted by authenticated users"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'attachments');
