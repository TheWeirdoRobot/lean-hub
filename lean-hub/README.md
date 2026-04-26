# LEAN Hub

**Project management web app for the LEAN Powered Wheelchair Basketball capstone team.**

LEAN is a hands-free powered wheelchair for wheelchair basketball, controlled entirely via torso lean through a pressure-sensing cushion. This hub tracks engineering milestones, task assignments, team progress, files, and timelines.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Auth | Supabase Auth |
| Database | Supabase Postgres + RLS |
| Storage | Supabase Storage |
| Drag & Drop | @hello-pangea/dnd |
| Gantt | gantt-task-react |
| Icons | lucide-react |

---

## Setup

### 1. Run the Supabase schema first

> **Required before first launch.** Open the [Supabase SQL Editor](https://supabase.com/dashboard) for your project and run the full contents of `supabase-schema.sql`.

This creates:
- `profiles` table + auto-create trigger on signup
- `tasks` table with status/priority/phase columns
- `comments` table with Realtime enabled
- `files` table
- `task-files` storage bucket with RLS policies

### 2. Install dependencies

```bash
cd lean-hub
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required because `gantt-task-react` declares a React 18 peer dep while this project uses React 19.

### 3. Environment variables

The `.env` file is pre-populated with your project's Supabase credentials. No changes needed.

### 4. Start dev server

```bash
npm run dev
```

App runs at `http://localhost:5173`.

---

## Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Stats, activity feed, phase breakdown, team quick-view |
| Tasks | `/tasks` | Kanban board with drag-and-drop, filtering, task creation |
| Gantt Chart | `/gantt` | Timeline view grouped by phase with LEAN project milestones |
| Team | `/team` | Member cards with task counts and completion bars |
| Files | `/files` | Upload/download files, associate with tasks, search |

### Task Detail Modal
- Inline editing (title, status, priority, phase, assignee, dates)
- Live comments via Supabase Realtime subscriptions
- File attachments per task (upload / download / delete)

---

## Project Phases & Milestones

| Phase | Timeline | Color |
|---|---|---|
| Research | May 1–10 | Blue |
| Design | May 11–30 | Purple |
| Fabrication | Jun 1 – Jul 5 | Orange |
| Testing | Jul 1 – Aug 5 | Green |
| Competition | Aug 6–20 | Yellow |

The Gantt page pre-populates these milestones if no tasks with dates exist in the database yet.

---

## Build for production

```bash
npm run build
```

Output in `dist/`. Deploy to Vercel, Netlify, or any static host — point all routes to `index.html`.
