# ProjectDocument schema (Plan B v2)

MultiCoder rooms currently store a **legacy single-file** ShareDB document. Plan B migrates to a **multi-file project** shape described here. Stage 0 adds types only; Stage 1 switches runtime behavior.

---

## ProjectDocument (v2)

```typescript
interface ProjectDocument {
  version: 2;
  entryPoint: string;              // path key in `files`, e.g. "main.js"
  files: Record<string, ProjectFile>;
}
```

| Field | Purpose |
|-------|---------|
| `version` | Always `2` for project docs. Detects legacy v1 docs during migration. |
| `entryPoint` | Which file Piston runs first (must exist in `files`). |
| `files` | Map of **relative path → file contents**. Keys use forward slashes, no leading `/`. |

### ProjectFile

```typescript
interface ProjectFile {
  content: string;
  language?: SupportedLanguage;   // omit → inherit room.language
}
```

- `content` — source text; ShareDB json0 OT operates on `['files', path, 'content']`.
- `language` — optional per-file override (e.g. `README.md` as markdown later).

### Path rules

- Allowed: `main.js`, `src/utils.js`, `lib/helper.py`
- Rejected: `../escape`, `/absolute`, empty string, paths over 256 chars
- Max files per room: `MAX_FILES_PER_ROOM` (see constants)
- Max bytes per file: `MAX_FILE_BYTES`

---

## Entry point convention

Default entry file per room language (when creating a new room):

| Room language | Default entry | Default path in `files` |
|---------------|---------------|-------------------------|
| `javascript` | `main.js` | `{ "main.js": { content: "", language: "javascript" } }` |
| `python` | `main.py` | `{ "main.py": { content: "", language: "python" } }` |
| `cpp` | `main.cpp` | `{ "main.cpp": { content: "", language: "cpp" } }` |

`entryPoint` must always match a key in `files`.

---

## Legacy RoomDocument (v1)

```typescript
interface LegacyRoomDocument {
  content: string;
  language: SupportedLanguage;
}
```

Detected when `version` is missing and `content` is a string at the document root.

### Migration (Stage 1.2)

On read, if doc is v1:

```typescript
{
  version: 2,
  entryPoint: languageToEntryPoint(doc.language),
  files: {
    [entryPoint]: { content: doc.content, language: doc.language },
  },
}
```

Persist the v2 shape back to ShareDB so all connected clients converge.

---

## Client-local vs shared state

| Field | Stored in ShareDB? |
|-------|-------------------|
| `files`, `entryPoint`, `version` | Yes — shared, real-time |
| `activeFile` (open tab) | No (v1) — each user's UI state locally |
| `openTabs` | No (v1) — optional shared field later |

---

## Piston execution mapping (Stage 4)

When running a project:

1. Read `entryPoint` and all `files` from ShareDB.
2. Build Piston payload: `files[]` with **entry file first**, then others.
3. Piston file `name` uses basename only (no `/` in name) — map `src/utils.js` → `utils.js` or preserve flat names in v1 templates.

---

## Snapshot format (Stage 5)

Snapshot `content` column stores JSON:

```json
{
  "version": 2,
  "entryPoint": "main.js",
  "files": {
    "main.js": { "content": "...", "language": "javascript" }
  }
}
```

Legacy snapshots (plain string) remain readable via the same v1→v2 normalizer.
