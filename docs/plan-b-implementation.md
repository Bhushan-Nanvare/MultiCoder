# Plan B — Multi-File Project Collaboration

Staged implementation plan for evolving MultiCoder from **one file per room** to a **shared mini-project** (file tree, tabs, multi-file run). Work in order; commit after each **milestone** (marked with `COMMIT:`).

**Principles (from your engineering rules):**
- One focus per session — don't mix auth + realtime + execution in the same evening.
- No placeholders in committed code — each milestone must be runnable/testable.
- Routes → services → repos; zod on every boundary.

**Branch suggestion:** `feat/plan-b-multi-file` off `main`. Merge when a stage group is stable.

---

## Overview

```text
Stage 0  Foundation          execution works locally, doc schema designed
Stage 1  Backend data model  ProjectDocument replaces RoomDocument
Stage 2  Frontend two-file   switch files without a tree yet
Stage 3  File tree + tabs    create / rename / delete files
Stage 4  Multi-file run      Piston runs entry point + all files
Stage 5  Snapshots v2        save/restore entire project
Stage 6  Presence + cursors  who is here, remote selections
Stage 7  Templates           starter projects on room create
Stage 8  Permissions         read-only links, optional roles
```

Estimated total: **6–10 weeks** at ~2–4 hours per session, one milestone per session.

---

## Stage 0 — Foundation

*Do this before changing the document shape. Unblocks Run button demos and avoids losing work on restart.*

### Milestone 0.1 — Self-hosted code execution

**Goal:** `POST /api/execute` works locally again with real stdout/stderr.

**Tasks:**
- [x] Add `piston` service to `docker-compose.yml` (`engineerman/piston` or official image).
- [x] Add env var `PISTON_BASE_URL` (default `http://localhost:2000/api/v2` in dev).
- [x] Wire `PISTON_BASE_URL` in `backend/src/constants/index.ts` (read from config, not hardcoded URL).
- [x] Restore `PistonClient` to call real Piston API (multi-file-ready `files[]` payload shape in types, even if only one file sent for now).
- [x] Document in README: `docker compose up -d piston` before Run.

**Files:**
- `docker-compose.yml`
- `backend/src/config/index.ts` + `backend/.env.example`
- `backend/src/constants/index.ts`
- `backend/src/execution/pistonClient.ts`

**Verify:**
- Two terminals: backend + frontend.
- Create room, type `console.log("ok")`, Run → stdout shows `ok`.

**COMMIT:** `fix(execution): self-host Piston via docker-compose for local runs`

---

### Milestone 0.2 — Design doc + types (no behavior change)

**Goal:** Lock the target schema before migrating live docs.

**Tasks:**
- [x] Add `docs/project-document-schema.md` (short) describing:
  - `ProjectDocument` shape
  - `ProjectFile` shape (`path`, `content`, optional `language`)
  - `entryPoint` convention
  - Migration from legacy `{ content, language }`
- [x] Add TypeScript types only (backend + frontend), no runtime switch yet:
  ```typescript
  interface ProjectFile {
    content: string;
    language?: SupportedLanguage; // inherit from room if omitted
  }

  interface ProjectDocument {
    version: 2;
    entryPoint: string;
    files: Record<string, ProjectFile>;
    // activeFile is client-local in v1; optional shared field later
  }

  /** @deprecated Legacy single-file shape — removed after migration */
  interface LegacyRoomDocument {
    content: string;
    language: SupportedLanguage;
  }
  ```
- [x] Add constants: `DEFAULT_ENTRY_POINT` (`main.js` / per-language map), `MAX_FILES_PER_ROOM`, `MAX_FILE_BYTES`.

**Files:**
- `docs/project-document-schema.md` (new)
- `backend/src/realtime/types.ts`
- `frontend/src/types/room.ts`
- `backend/src/constants/index.ts`

**Verify:** `npm run build` passes in backend and frontend.

**COMMIT:** `docs: define ProjectDocument schema for multi-file rooms`

---

## Stage 1 — Backend data model

### Milestone 1.1 — Initialize v2 documents for new rooms

**Goal:** New rooms get `ProjectDocument` instead of `{ content, language }`.

**Tasks:**
- [x] Update `RealtimeDocumentService.initializeDocument()` to create:
  ```typescript
  {
    version: 2,
    entryPoint: languageToEntryPoint(language), // e.g. main.js
    files: {
      [entryPoint]: { content: '', language },
    },
  }
  ```
- [ ] Add helper `languageToEntryPoint(lang)` in `backend/src/realtime/documentHelpers.ts`.
- [x] Update `readDocument()` return type to `ProjectDocument`.
- [ ] Update backend tests/manual check: create room → ShareDB doc has `version: 2`.

**Files:**
- `backend/src/realtime/documentService.ts`
- `backend/src/realtime/documentHelpers.ts` (new)
- `backend/src/realtime/types.ts`

**Verify:** Create room via API; inspect doc via temporary debug route or server log on first fetch.

**COMMIT:** `feat(realtime): initialize new rooms with ProjectDocument v2`

---

### Milestone 1.2 — Legacy document migration on read

**Goal:** Existing rooms (v1 `{ content, language }`) still open; auto-upgrade on first backend read.

**Tasks:**
- [x] Add `normalizeDocument(raw: unknown): ProjectDocument` — detects v1 vs v2.
- [x] If v1: convert to v2 in memory; optionally submit OT op to persist upgrade (prefer persist so all clients converge).
- [x] `readDocument()` and snapshot save both use `normalizeDocument`.

**Files:**
- `backend/src/realtime/documentHelpers.ts`
- `backend/src/realtime/documentService.ts`

**Verify:** Manually seed a v1 doc (or use old deploy data); open room → content visible; doc becomes v2.

**COMMIT:** `feat(realtime): migrate legacy single-file docs to ProjectDocument v2`

---

### Milestone 1.3 — File operations service (backend)

**Goal:** Server-side validation for structural changes (add/rename/delete file), callable from future HTTP or ShareDB middleware.

**Tasks:**
- [x] Add `ProjectFileService` with methods:
  - `addFile(doc, path, content?)`
  - `renameFile(doc, oldPath, newPath)` — update `entryPoint` if needed
  - `deleteFile(doc, path)` — forbid deleting last file; forbid deleting `entryPoint` without reassigning
  - `listFiles(doc)`
- [ ] zod schemas for paths (no `..`, no leading `/`, max length).
- [ ] Unit-free manual test via small script or route behind dev flag (optional); otherwise test through Stage 3 UI.

**Files:**
- `backend/src/realtime/projectFileService.ts` (new)
- `backend/src/realtime/documentHelpers.ts`

**Verify:** Pure functions tested by importing in a one-off script or integration test.

**COMMIT:** `feat(realtime): add ProjectFileService for file tree mutations`

---

## Stage 2 — Frontend: two files, no tree

*Minimal UI change — prove multi-file sync before building the sidebar.*

### Milestone 2.1 — Bind Monaco to a file path

**Goal:** Editor syncs `files[activePath].content`, not root `content`.

**Tasks:**
- [x] Change `RoomDocument` → `ProjectDocument` in frontend types.
- [x] Update `monacoShareDbBinding.ts`:
  - Accept `{ doc, filePath }` instead of binding to `content`.
  - JSON0 path: `['files', filePath, 'content']`.
- [x] Add `normalizeProjectDocument()` on client (same rules as server) for v1 docs fetched before server migration.
- [x] `CollaborativeEditor` props: `roomId`, `filePath`, `language` (language from file or room).

**Files:**
- `frontend/src/realtime/monacoShareDbBinding.ts`
- `frontend/src/components/editor/CollaborativeEditor.tsx`
- `frontend/src/types/room.ts`

**Verify:** Open room in two tabs; edit → sync works exactly as before for the default file.

**COMMIT:** `feat(editor): bind Monaco to ProjectDocument file path`

---

### Milestone 2.2 — File switcher (dropdown)

**Goal:** Switch between files without a tree; seed exactly two files in new rooms.

**Tasks:**
- [x] Add `FileSwitcher` component — dropdown of `Object.keys(doc.files)`.
- [x] RoomPage state: `activeFilePath` (default `doc.entryPoint`).
- [x] On switch: dispose old Monaco binding, attach to new path (or remount editor with `key={activeFilePath}`).
- [x] Temporary **"Add second file"** button (dev-only or permanent until Stage 3):
  - Submits ShareDB op: insert `files['utils.js']` with `{ content: '', language }`.
  - Updates local `activeFilePath`.

**Files:**
- `frontend/src/components/editor/FileSwitcher.tsx` (new)
- `frontend/src/pages/RoomPage.tsx`

**Verify:**
- Tab A on `main.js`, Tab B on `utils.js` — simultaneous edits, no cross-talk.
- Switch file in one tab — other tab unaffected unless same file open.

**COMMIT:** `feat(ui): add file switcher for multi-file editing`

---

## Stage 3 — File tree + tabs

### Milestone 3.1 — File tree sidebar

**Goal:** VS Code–like sidebar; create / rename / delete files via ShareDB ops.

**Tasks:**
- [x] `FileTree` component — list `doc.files` keys, highlight `activeFilePath`.
- [x] **New file** — modal for path (`src/helper.js`); validate; OT insert.
- [x] **Rename** — inline or modal; OT rename = insert new key + delete old + fix `entryPoint` if needed.
- [x] **Delete** — confirm; OT delete key; switch active tab if deleted file was open.
- [x] Use shared path validation (port zod schema to frontend or duplicate minimal rules).

**Files:**
- `frontend/src/components/project/FileTree.tsx` (new)
- `frontend/src/components/project/NewFileModal.tsx` (new)
- `frontend/src/pages/RoomPage.tsx` — layout: sidebar | editor
- `frontend/src/realtime/projectOps.ts` (new) — helpers to build JSON0 ops

**Verify:** Alice creates `lib.js`; Bob sees it appear. Bob deletes `lib.js`; Alice's tab closes or falls back to entry.

**COMMIT:** `feat(ui): add file tree with create, rename, and delete`

---

### Milestone 3.2 — Tab bar

**Goal:** Open multiple files as tabs; close tab ≠ delete file.

**Tasks:**
- [x] `TabBar` — open tabs stored in React state (`openTabs: string[]`).
- [x] Click tab → set `activeFilePath`.
- [x] Close tab → remove from `openTabs` only.
- [x] Click file in tree → open or focus tab.

**Files:**
- `frontend/src/components/project/TabBar.tsx` (new)
- `frontend/src/pages/RoomPage.tsx`

**Verify:** Open 3 tabs, switch between them; close one; file still in tree.

**COMMIT:** `feat(ui): add editor tab bar for open files`

---

### Milestone 3.3 — Entry point picker

**Goal:** User chooses which file **Run** executes (before multi-file payload lands).

**Tasks:**
- [x] Small UI in toolbar: "Entry: [main.js ▼]".
- [x] Persist `entryPoint` on doc via ShareDB op (shared for whole room).
- [x] Default remains language-based `main.*`.

**Files:**
- `frontend/src/components/project/EntryPointPicker.tsx` (new)
- `frontend/src/components/editor/EditorToolbar.tsx`
- `frontend/src/pages/RoomPage.tsx`

**Verify:** Set entry to `utils.js`; Run executes that file's content (single-file mode).

**COMMIT:** `feat(ui): add shared entry point picker for project run`

---

## Stage 4 — Multi-file execution

### Milestone 4.1 — Execute API accepts project payload

**Goal:** Backend runs entry file with sibling files in sandbox.

**Tasks:**
- [x] Extend execute body zod schema:
  ```typescript
  {
    language: SupportedLanguage,
    entryPoint: string,
    files: Array<{ path: string, content: string }>,
    stdin?: string
  }
  ```
  Keep backward compat: `{ language, code }` → treat as single-file `{ entryPoint: 'main.*', files: [{ path, content: code }] }`.
- [x] `ExecutionService.executeProject()` — map paths to Piston `files: [{ name, content }]`, set `run` entry.
- [x] Enforce limits: max files, total bytes, max per file.

**Files:**
- `backend/src/execution/types.ts`
- `backend/src/execution/executionService.ts`
- `backend/src/execution/pistonClient.ts`
- `backend/src/http/routes/execute.ts`

**Verify:** curl POST with two files (main imports helper) → stdout correct.

**COMMIT:** `feat(execution): support multi-file project run via Piston`

---

### Milestone 4.2 — Frontend Run sends full project

**Goal:** Run button collects all files from ShareDB doc, not just active editor.

**Tasks:**
- [x] `CollaborativeEditor` or RoomPage exposes `getProject(): { entryPoint, files }` from live doc data.
- [x] `handleRun` calls `api.executeProject({ ... })`.
- [x] Show compile errors from `compileStderr` in OutputPanel (already partially there).

**Files:**
- `frontend/src/api/client.ts`
- `frontend/src/pages/RoomPage.tsx`
- `frontend/src/types/execution.ts`

**Verify:** `main.js` + `utils.js` with import/require pattern works in Piston (language-dependent).

**COMMIT:** `feat(ui): run entire project from entry point and all files`

---

### Milestone 4.3 — Run scope toggle (optional polish)

**Goal:** Run active file only vs run project.

**Tasks:**
- [x] Toolbar toggle: "Run file" | "Run project".
- [x] Run file → old single-file API path.

**COMMIT:** `feat(ui): add run file vs run project toggle`

---

## Stage 5 — Snapshots v2

### Milestone 5.1 — Persist full project in snapshots

**Goal:** History saves and restores all files + entry point.

**Tasks:**
- [x] Change snapshot `content` column to store JSON string of `{ entryPoint, files }` (or add `snapshotVersion` — prefer JSON in existing column to avoid migration if size OK).
- [x] If DB column stays string: `JSON.stringify({ version: 2, entryPoint, files })`.
- [x] `SnapshotService.saveCurrent()` reads full `ProjectDocument`.
- [x] Restore: apply bulk op or replace doc (prefer OT-friendly: set entire `files` object via composed ops; or `doc.fetch` + server-side restore endpoint that writes doc).

**Files:**
- `backend/src/snapshots/snapshotService.ts`
- `backend/src/snapshots/types.ts`
- `frontend/src/components/history/HistoryPanel.tsx`
- `frontend/src/types/snapshot.ts`

**Verify:** Save snapshot with 3 files; restore → all tabs/content match; other connected client updates.

**COMMIT:** `feat(snapshots): save and restore full multi-file project state`

---

### Milestone 5.2 — Snapshot preview (optional)

**Goal:** History list shows file count + entry point in summary.

**Tasks:**
- [x] Parse snapshot metadata on list; display `3 files · entry main.js`.

**COMMIT:** `feat(snapshots): show file count in history list`

---

## Stage 6 — Presence + cursors

*ShareDB backend already has `presence: true` — wire the frontend.*

### Milestone 6.1 — Who is in the room

**Goal:** Avatar strip in room header.

**Tasks:**
- [x] Subscribe to doc presence in RoomPage or `useRoomPresence` hook.
- [x] Publish local presence: `{ userId, displayName, avatarUrl, activeFile }`.
- [x] `PresenceBar` component in header.

**Files:**
- `frontend/src/realtime/useRoomPresence.ts` (new)
- `frontend/src/components/project/PresenceBar.tsx` (new)
- `frontend/src/pages/RoomPage.tsx`

**Verify:** Two browsers logged in as different users → both avatars visible; leave → removed.

**COMMIT:** `feat(realtime): show room presence with avatars`

---

### Milestone 6.2 — Remote cursors (per file)

**Goal:** See collaborators' selections in the same file.

**Tasks:**
- [x] Extend presence payload: `{ cursor: { line, column }, selection?: ... }`.
- [x] On Monaco cursor change (debounced), update presence.
- [x] Render remote cursors with Monaco decorations or `monaco-editor` content widgets; filter by `activeFile` match.
- [x] Assign stable color per `userId`.

**Files:**
- `frontend/src/realtime/remoteCursors.ts` (new)
- `frontend/src/components/editor/CollaborativeEditor.tsx`

**Verify:** Two users in same file → see each other's cursor move.

**COMMIT:** `feat(editor): show remote cursors and selections per file`

---

### Milestone 6.3 — Broadcast run output (optional)

**Goal:** Everyone sees the same Run result.

**Tasks:**
- [ ] After successful run, author writes `lastRun: { stdout, stderr, exitCode, triggeredBy, at }` to presence or a small ShareDB object field `meta.lastRun`.
- [ ] OutputPanel reads `meta.lastRun` if newer than local run.

**COMMIT:** `feat(execution): broadcast last run output to all room members`

---

## Stage 7 — Project templates

### Milestone 7.1 — Template definitions

**Goal:** Create room from a starter structure.

**Tasks:**
- [x] Add `backend/src/projects/templates/` — TS modules:
  - `javascript-starter` — `main.js` + `utils.js` (CommonJS; Run works)
  - `python-starter` — `main.py` + `utils.py`
  - `node-two-file` — `index.js` + `helper.js`
  - `cpp-starter` — `main.cpp` (Piston compiles the entry file only)
- [x] `GET /api/rooms/templates` (registered before `GET /:id`).
- [x] Extend `POST /api/rooms` body: optional `templateId` (overrides `language` to match the template).
- [x] `initializeDocument()` seeds files from a cloned template document.
- [x] Dashboard template picker (blank = empty project).

**Files:**
- `backend/src/projects/templates/*` (new)
- `backend/src/rooms/roomService.ts`
- `backend/src/realtime/documentService.ts`
- `frontend/src/pages/DashboardPage.tsx` — template picker on create

**Verify:** Create from template → tree populated; Run works.

**COMMIT:** `feat(rooms): add project templates for room creation`

---

## Stage 8 — Permissions (optional, post–v2)

### Milestone 8.1 — Read-only room links

**Goal:** Viewer can see sync but not edit.

**Tasks:**
- [ ] Room field: `visibility: 'private' | 'link-edit' | 'link-view'`.
- [ ] ShareDB middleware or client-side read-only Monaco (`readOnly: true`) when viewer.
- [ ] WS auth: allow anonymous read for `link-view` (ties to Plan D).

**COMMIT:** `feat(rooms): add read-only share links`

---

### Milestone 8.2 — Owner / editor roles

**Goal:** Only owner deletes room; editors can edit.

**Tasks:**
- [x] `RoomMember` table or simple `collaborators` JSON on room.
- [x] Enforce on snapshot delete, room delete, file delete.

**COMMIT:** `feat(auth): add room owner and editor roles`

---

## Stage 9 — ShareDB persistence (recommended before public deploy)

*Not strictly UI, but do before Stage 7 if deploying.*

### Milestone 9.1 — Persist OT ops to Postgres

**Goal:** Server restart does not wipe live projects.

**Tasks:**
- [ ] Evaluate `sharedb-postgres` vs Mongo; align with existing Postgres (Neon).
- [ ] Replace in-memory ShareDB adapter in `shareDbBackend.ts`.
- [ ] Migration guide in README.

**COMMIT:** `feat(realtime): persist ShareDB documents to Postgres`

---

## AI review & plagiarism (follow-up commits)

After Stage 2+, update these to be project-aware:

| Milestone | Change | Commit message |
|-----------|--------|----------------|
| 2.x | Review active file only (default) | `feat(review): review active file in multi-file room` |
| 4.x | Review entire project (concat or structured prompt) | `feat(review): add whole-project AI review mode` |
| 3.x | Plagiarism on active file vs all files | `feat(plagiarism): fingerprint all project files` |

---

## Commit checklist (quick reference)

| # | Milestone | Commit prefix |
|---|-----------|---------------|
| 0.1 | Piston local | `fix(execution)` |
| 0.2 | Schema types | `docs` / `feat(types)` |
| 1.1 | v2 init | `feat(realtime)` |
| 1.2 | v1 migration | `feat(realtime)` |
| 1.3 | File service | `feat(realtime)` |
| 2.1 | Monaco path bind | `feat(editor)` |
| 2.2 | File switcher | `feat(ui)` |
| 3.1 | File tree | `feat(ui)` |
| 3.2 | Tab bar | `feat(ui)` |
| 3.3 | Entry picker | `feat(ui)` |
| 4.1 | Execute API | `feat(execution)` |
| 4.2 | Run project | `feat(ui)` |
| 4.3 | Run toggle | `feat(ui)` |
| 5.1 | Snapshots v2 | `feat(snapshots)` |
| 5.2 | Snapshot preview | `feat(snapshots)` |
| 6.1 | Presence bar | `feat(realtime)` |
| 6.2 | Remote cursors | `feat(editor)` |
| 6.3 | Broadcast run | `feat(execution)` |
| 7.1 | Templates | `feat(rooms)` |
| 8.1 | Read-only links | `feat(rooms)` |
| 8.2 | Roles | `feat(auth)` |
| 9.1 | ShareDB Postgres | `feat(realtime)` |

---

## Session workflow

1. Pick **one milestone** from the table above.
2. Create branch or stay on `feat/plan-b-multi-file`.
3. Implement tasks; run backend + frontend locally.
4. Manual verify using **Verify** steps.
5. Commit with the suggested message (adjust if scope differs).
6. Update this doc — check off tasks `[x]`.
7. Stop. Next session: next milestone.

---

## Definition of done (full Plan B)

- [x] Room has **file tree** with create/rename/delete.
- [x] **Tabs** switch between open files.
- [x] **Real-time sync** per file; two users can edit different files simultaneously.
- [x] **Run project** executes entry point with all files in Piston.
- [x] **Snapshots** save/restore entire project; restore broadcasts.
- [ ] **Presence** shows who is online; **cursors** visible in shared files.
- [x] At least **one template** on room create.
- [ ] README updated with multi-file usage screenshots or GIF.

When all boxes checked → merge `feat/plan-b-multi-file` → tag `v2.0.0`.

---

## Risk register

| Risk | Mitigation |
|------|------------|
| JSON0 ops on nested paths get messy | Centralize op builders in `projectOps.ts`; never hand-roll paths in components |
| Large projects exceed ShareDB doc size | Enforce `MAX_FILES_PER_ROOM` + bytes; Stage 9b later: one doc per file |
| Piston language import semantics differ | Document supported patterns per language in README; template examples |
| Monaco remount on tab switch loses undo | Accept for v1; later: model cache per file |
| Snapshot column too small for big projects | Already 256KB limit — enforce in save; raise if needed |

---

*Last updated: 2026-08-11 — adjust checkboxes as milestones land.*
