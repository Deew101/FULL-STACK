# Spatial Board

> A real-time collaborative project workspace combining Jira-style structured tasks with a Miro-style infinite 2D canvas.

Built with **React 18**, **TypeScript**, **Tailwind CSS**, **Zustand**, and **Supabase** (Postgres, Row Level Security, Realtime Broadcast & Presence, Storage). Engineered as a pure Single-Page Application (SPA) designed specifically for zero-config deployment to **GitHub Pages**.

---

## Features

- **Infinite 2D Spatial Canvas (Owned Mechanics)**:
  - Custom container transform math (`translate` + `scale`).
  - Smooth pan via space+drag, middle-click, or empty canvas drag.
  - Zoom toward cursor (clamped 0.1x – 3.0x) with zoom % indicator and 1-click view reset.
  - Scaled dotted background grid synchronized with canvas coordinates.
- **Task Nodes**:
  - Double-click or press `N` to spawn tasks at precise world coordinates.
  - Card status colors (To Do: gray, In Progress: emerald, Blocked: rose, Done: blue).
  - Assignee avatar badges, subtask completion counter, attachment indicators.
  - Real-time dragging with optimistic updates and rollback on error.
  - Multi-select via `Shift`-click and marquee box selection; bulk delete with `Del` or `Backspace`.
  - Full Undo / Redo history stack (`Ctrl/Cmd + Z` / `Ctrl/Cmd + Y`).
- **Jira-Style Slide-Over Detail Panel**:
  - Edit title, status, and assignees (loaded dynamically from project members).
  - Rich-text description powered by Tiptap (headings, lists, inline code, quotes, bold, italic).
  - Subtask checklist with completion progress bar.
  - File attachments stored in Supabase Storage (`attachments` bucket) with public download links.
  - Visible live autosave indicator ("Saving..." / "Saved").
- **SVG Dependency Graph**:
  - Drag from bottom handle of a blocker task to top handle of a blocked task.
  - Curved cubic bezier arrows that dynamically follow moving nodes.
  - Clickable edge badges to toggle dependency type (`blocks` vs `relates_to`) or delete the edge.
  - **Cycle Prevention**: Topological DFS graph search prevents circular dependencies.
  - **Blocker Validation**: Attempting to move a task to "Done" when blocking tasks are incomplete triggers a CSS shake animation and toast alert detailing active blockers.
- **Sprints & Epics (Groups)**:
  - Colored, resizable bounding boxes to encapsulate sprint milestones or epic themes.
  - Draggable header, custom labels, color swatches, and bottom-right resize handles.
- **Live Multiplayer**:
  - Ephemeral user cursors with name pills broadcasted in real-time (~35ms throttle).
  - Live card movement during drags before writing to Postgres on drop.
  - Supabase Realtime Presence displaying online collaborators with colored borders in the header.
  - Supabase `postgres_changes` subscription keeping board state instantly synchronized across clients.
- **Authentication & Security**:
  - Email/Password sign up and sign in.
  - Google OAuth with PKCE flow and proper HashRouter redirect handling.
  - Row Level Security (RLS) on all tables; project membership verification.
  - Automatic user profile provisioning via Postgres triggers.
  - Shareable 6-character project invite links.
  - Built-in Guest / Demo mode for instant zero-config evaluation.

---

## Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 18, Vite 6, TypeScript 5 (Strict mode) |
| **Styling** | Tailwind CSS 3, Lucide React icons |
| **Routing** | React Router DOM 6 (`HashRouter` for GitHub Pages deep link compatibility) |
| **State Management** | Zustand 5 |
| **Rich Text Editor** | Tiptap StarterKit |
| **Backend & Realtime** | Supabase (Postgres, Auth PKCE, Realtime Broadcast/Presence, Storage) |
| **CI / CD** | GitHub Actions (`actions/deploy-pages`) |

---

## Step-by-Step Setup Guide

### 1. Create a Supabase Project

1. Log in to [supabase.com](https://supabase.com/) and click **New Project**.
2. Set a **Name** (e.g., `spatial-board`) and a secure **Database Password**.
3. Choose your closest region and click **Create new project**.

### 2. Run Database Migrations

1. In the Supabase Dashboard, go to the **SQL Editor** tab on the left sidebar.
2. Click **New Query**.
3. Open the file [`supabase/migrations/001_init.sql`](./supabase/migrations/001_init.sql) from this repository, copy its entire contents, and paste it into the SQL Editor.
4. Click **Run**. This will create:
   - `profiles`, `projects`, `project_members`, `tasks`, `dependencies`, and `groups` tables.
   - Row Level Security (RLS) policies on every table.
   - The `on_auth_user_created` trigger for automatic profile generation.
   - The `join_project_by_code` stored procedure for invite links.
   - The `attachments` storage bucket with access policies.
   - Enables Realtime publication on `tasks`, `dependencies`, `groups`, and `project_members`.

### 3. Configure Google OAuth (Optional but Recommended)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a Google Cloud project, then go to **APIs & Services > Credentials**.
3. Configure the **OAuth consent screen** (User Type: External, fill in App name and email).
4. Click **Create Credentials > OAuth client ID**:
   - Application type: **Web application**.
   - Under **Authorized redirect URIs**, add your Supabase Auth callback URL:
     ```
     https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback
     ```
5. Copy the generated **Client ID** and **Client Secret**.
6. In your Supabase Dashboard, navigate to **Authentication > Providers > Google**:
   - Turn **Google Enabled** ON.
   - Paste the **Client ID** and **Client Secret**.
   - Click **Save**.

### 4. Configure Supabase Auth Redirect URLs

1. In the Supabase Dashboard, go to **Authentication > URL Configuration**.
2. In **Site URL**, set:
   - For GitHub Pages: `https://<YOUR-GITHUB-USERNAME>.github.io/<YOUR-REPO-NAME>/`
   - For local development: `http://localhost:5173/`
3. Under **Redirect URLs**, add:
   - `http://localhost:5173/**`
   - `https://<YOUR-GITHUB-USERNAME>.github.io/<YOUR-REPO-NAME>/**`
4. Click **Save**.

### 5. Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/<YOUR-GITHUB-USERNAME>/<YOUR-REPO-NAME>.git
   cd <YOUR-REPO-NAME>
   ```
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://<YOUR-PROJECT-REF>.supabase.co
   VITE_SUPABASE_ANON_KEY=<YOUR-ANON-KEY>
   VITE_BASE_PATH=/
   ```
   *(Find your URL and Anon Key in Supabase Dashboard > Project Settings > API)*.
4. Install dependencies and start the local development server:
   ```bash
   npm install
   npm run dev
   ```
5. Open `http://localhost:5173` in your browser.

---

## Deployment to GitHub Pages

### 1. Add GitHub Repository Secrets

1. Go to your repository on GitHub.
2. Navigate to **Settings > Secrets and variables > Actions**.
3. Under **Repository secrets**, click **New repository secret** and add:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key

### 2. Enable GitHub Pages Deployment via GitHub Actions

1. In your GitHub repository, click **Settings > Pages** on the left menu.
2. Under **Build and deployment > Source**, select **GitHub Actions** (instead of "Deploy from a branch").

### 3. Push to GitHub

Push your code to the `main` branch:
```bash
git add .
git commit -m "feat: complete Spatial Board deployment ready for GitHub Pages"
git push origin main
```

The GitHub Actions workflow (`.github/workflows/deploy.yml`) will automatically trigger, build the SPA using Vite with base path `/<repo-name>/`, and deploy it to GitHub Pages.

---

## Keyboard Shortcuts & Navigation

| Key / Gesture | Action |
|---|---|
| `Space` + Drag / Middle Mouse | Pan Canvas |
| Scroll Wheel / Pinch | Zoom toward mouse cursor |
| Double Click empty canvas | Create new task at cursor position |
| `N` | Create new task at viewport center |
| `Shift` + Click | Multi-select tasks |
| `Shift` + Drag | Marquee selection box |
| `Delete` / `Backspace` | Delete selected tasks |
| `Escape` | Clear selection & close side detail panel |
| `Ctrl / Cmd + Z` | Undo |
| `Ctrl / Cmd + Y` (or `Shift + Z`) | Redo |
