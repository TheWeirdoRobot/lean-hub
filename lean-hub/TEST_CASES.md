# LEAN Hub — Test Cases

## Automated Tests (Playwright)

### auth.spec.js — Authentication

| # | Test | Expected outcome |
|---|------|-----------------|
| A1 | Load login page | Page renders with email/password inputs and "Sign in to your workspace" heading |
| A2 | Wrong password | Error banner appears; URL stays at `/login` |
| A3 | Sign up with new email | Supabase sends confirmation email; "Check your email" success screen appears |
| A4 | Log in with valid credentials | Redirected to `/` (Dashboard) |
| A5 | Log out | Redirected to `/login` |
| A6 | Password show/hide toggle | Input `type` toggles between `password` and `text` |

### tasks.spec.js — Task Management

| # | Test | Expected outcome |
|---|------|-----------------|
| T1 | Create task with all fields | Task card appears on board with correct title |
| T2 | New task lands in correct column | Card appears under the column matching the chosen status |
| T3 | Drag card to different column | Card moves; status updates in Supabase |
| T4 | Edit task title | Updated title visible on board without page reload |
| T5 | Delete task | Card removed from board; no error shown |
| T6 | Deleted task absent from Gantt | Navigating to `/gantt` does not show the deleted task |

### gantt.spec.js — Gantt Chart

| # | Test | Expected outcome |
|---|------|-----------------|
| G1 | Page loads without JS errors | `h1` shows "Gantt Chart"; no `pageerror` events fired |
| G2 | Task with dates appears as bar | Task title is visible as a bar label in the SVG timeline |
| G3 | Task without dates is absent | Task title is not present anywhere on the Gantt page |
| G4 | Hard refresh does not 404 | Reloading `/gantt` renders the page (vercel.json rewrite active) |

### dashboard.spec.js — Dashboard

| # | Test | Expected outcome |
|---|------|-----------------|
| D1 | Stat counters are numeric | Each of the four stat cards contains a digit |
| D2 | Phase breakdown is visible | All five phase names rendered; progress bars present |
| D3 | Recent activity item is clickable | Clicking a task row navigates to `/tasks` and opens that task's modal |
| D4 | "View all" navigates to Tasks | URL becomes `/tasks`; Tasks page heading visible |

### files.spec.js — File Management

| # | Test | Expected outcome |
|---|------|-----------------|
| F1 | Upload button present | `input[type="file"]` or "Upload" button is attached to DOM |
| F2 | Upload a small file | Temp `.txt` file uploaded; file name appears in list |

---

## Manual Edge Cases

These scenarios are difficult or impractical to automate reliably and should be verified by hand before each release.

### Concurrency
- **Two users edit the same task simultaneously** — last writer wins; Supabase does not merge changes. Expected: the second save silently overwrites the first. Verify by opening the same task in two browser windows and saving different titles.

### File Upload
- **50 MB file upload** — exceeds Supabase Storage free-tier limits (~50 MB object limit). Expected: Supabase returns an error; verify the upload error banner appears and the app does not crash.
- **Zero-byte file** — uploading an empty file. Expected: file record created with `file_size: 0`; download link works.

### Input Validation
- **Task title with 200+ characters** — the input has no `maxLength`. Expected: title is saved in full; the kanban card truncates the text with CSS `text-overflow: ellipsis`.
- **Special characters in title** (`!@#$%^&*()<>`) — Expected: title saved literally; no XSS or display breakage.
- **SQL-injection-style title** (`'; DROP TABLE tasks; --`) — Supabase JS client uses parameterised queries; this should be safe. Verify the title is stored and displayed as a plain string.

### Navigation
- **Browser back/forward between pages** — React Router handles this client-side. Verify state is not corrupted after navigating back to Tasks from Gantt.
- **Direct URL access to protected route while logged out** — `ProtectedRoute` should redirect to `/login`. Verify `/tasks`, `/gantt`, `/files` all redirect unauthenticated users.
- **Hard refresh on any route** — `vercel.json` rewrites ensure the SPA is served; no 404. Verify on staging after deploy.

### Session & Auth
- **Session expiry while editing a task** — Supabase tokens expire after 1 hour (or as configured). Expected: the save or delete call returns a 401/403; the error banner in `TaskModal` should display the error message. Verify by manually expiring the token in DevTools.
- **Multiple tabs — log out in one tab** — Other tabs are still mounted. Expected: next API call fails; user sees an error or is redirected. Currently no cross-tab session invalidation listener is implemented.

### Network & Performance
- **Slow 3G network** — Use Chrome DevTools network throttling. Verify loading spinners appear and the app does not render empty states prematurely.
- **Supabase temporarily unreachable** — Simulate by disabling network in DevTools after login. Expected: error messages appear rather than silent failures or infinite spinners.

---

## Known Limitations

| Area | Limitation |
|------|-----------|
| Real-time comments | Relies on Supabase Realtime. In CI (no WebSocket keepalive), the subscription may not fire; tests use explicit `fetchComments()` as a fallback. |
| Drag & drop in CI | `@hello-pangea/dnd` pointer-event drag is sensitive to timing. The T3 drag test uses `waitForTimeout` delays; flakiness may occur on slow CI runners. |
| File upload tests | `files.spec.js` uploads to the real Supabase Storage bucket. Test files must be cleaned up manually if the test run is interrupted. |
| Sign-up test creates real users | A3 registers a real (unconfirmed) user in Supabase each run. Use Supabase's "Disable email confirmations" in dev or clean up via the Auth admin panel periodically. |
| No test database isolation | All tests run against the live Supabase project. Tasks created by tests accumulate unless explicitly deleted. Each test that creates data should delete it in cleanup. |
