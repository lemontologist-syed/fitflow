// Pure state functions (no browser APIs) — used by the store and the tests.
import {
  defaultCycle,
  defaultFoods,
  defaultProfile,
  defaultReminderPrefs,
  defaultSchedule,
  defaultTemplates,
} from "./defaults";
import { TABLES, type AppState, type BaseRow, type DataState, type TableName, type Tables } from "./types";

export const STATE_VERSION = 1;

export function emptyState(): AppState {
  const data = Object.fromEntries(TABLES.map((t) => [t, {}])) as DataState;
  return {
    version: STATE_VERSION,
    data,
    sync: { dirty: {}, cursors: {}, lastSyncAt: null, lastSyncError: null, userId: null },
  };
}

/** Normalises persisted state (older versions, missing tables). */
export function migrateState(raw: unknown): AppState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<AppState>;
  for (const t of TABLES) {
    const rows = r.data?.[t];
    if (rows && typeof rows === "object") (base.data as Record<string, unknown>)[t] = rows;
  }
  if (r.sync) base.sync = { ...base.sync, ...r.sync, dirty: { ...(r.sync.dirty ?? {}) }, cursors: { ...(r.sync.cursors ?? {}) } };
  return base;
}

function addDirty(state: AppState, table: TableName, id: string): AppState["sync"] {
  const cur = state.sync.dirty[table] ?? [];
  if (cur.includes(id)) return state.sync;
  return { ...state.sync, dirty: { ...state.sync.dirty, [table]: [...cur, id] } };
}

/** Inserts default rows that are missing (never overwrites existing rows). */
export function seedState(state: AppState): AppState {
  let s = state;
  const seed = <T extends TableName>(table: T, rows: Tables[T][]) => {
    for (const row of rows) {
      if (s.data[table][row.id]) continue;
      s = {
        ...s,
        data: { ...s.data, [table]: { ...s.data[table], [row.id]: row } },
      };
      s = { ...s, sync: addDirty(s, table, row.id) };
    }
  };
  seed("profiles", [defaultProfile()]);
  seed("reminder_preferences", [defaultReminderPrefs()]);
  if (Object.keys(s.data.schedule_items).length === 0) seed("schedule_items", defaultSchedule());
  if (Object.keys(s.data.training_cycles).length === 0) seed("training_cycles", [defaultCycle()]);
  seed("foods", defaultFoods());
  seed("meal_templates", defaultTemplates());
  return s;
}

/** Local change: stamps updated_at, marks the row for upload. */
export function upsertRow<T extends TableName>(
  state: AppState,
  table: T,
  row: Omit<Tables[T], "updated_at"> & { updated_at?: string },
  now: Date,
): AppState {
  const prev = state.data[table][row.id] as BaseRow | undefined;
  // Guarantee a strictly increasing timestamp per row so LWW keeps our edit.
  let ts = now.toISOString();
  if (prev && prev.updated_at >= ts) ts = new Date(Date.parse(prev.updated_at) + 1).toISOString();
  const next = { ...(prev ?? {}), ...row, updated_at: ts } as Tables[T];
  return {
    ...state,
    data: { ...state.data, [table]: { ...state.data[table], [row.id]: next } },
    sync: addDirty(state, table, row.id),
  };
}

/** Local delete = tombstone, so the deletion also syncs. */
export function deleteRow(state: AppState, table: TableName, id: string, now: Date): AppState {
  const prev = state.data[table][id];
  if (!prev) return state;
  return upsertRow(state, table, { ...(prev as BaseRow), deleted: true } as never, now);
}

/** Rows to upload: dirty rows, without server-only columns. */
export function pendingUploads(state: AppState, userId: string): { [K in TableName]?: Record<string, unknown>[] } {
  const out: { [K in TableName]?: Record<string, unknown>[] } = {};
  for (const t of TABLES) {
    const ids = state.sync.dirty[t] ?? [];
    const rows = ids
      .map((id) => state.data[t][id] as BaseRow | undefined)
      .filter((r): r is BaseRow => !!r)
      .map((r) => {
        const { server_updated_at: _s, ...rest } = r as BaseRow & Record<string, unknown>;
        return { ...rest, user_id: userId, deleted: !!r.deleted };
      });
    if (rows.length) out[t] = rows;
  }
  return out;
}

/** After a successful upload: clear dirty flags of rows not changed since. */
export function markUploaded(state: AppState, table: TableName, rows: Array<{ id: string; updated_at: string }>): AppState {
  const uploaded = new Map(rows.map((r) => [r.id, r.updated_at]));
  const remaining = (state.sync.dirty[table] ?? []).filter((id) => {
    const at = uploaded.get(id);
    if (at === undefined) return true;
    const local = state.data[table][id] as BaseRow | undefined;
    return !!local && local.updated_at !== at;
  });
  return { ...state, sync: { ...state.sync, dirty: { ...state.sync.dirty, [table]: remaining } } };
}

/**
 * Merges rows pulled from the server. Last write wins on `updated_at`;
 * a newer unsynced local edit is kept (and uploaded on the next push).
 */
export function mergeRemote(state: AppState, table: TableName, remote: BaseRow[]): AppState {
  if (remote.length === 0) return state;
  const rows = { ...state.data[table] } as Record<string, BaseRow>;
  let dirty = state.sync.dirty[table] ?? [];
  let cursor = state.sync.cursors[table] ?? "";
  for (const r of remote) {
    if (r.server_updated_at && r.server_updated_at > cursor) cursor = r.server_updated_at;
    const local = rows[r.id];
    if (!local || r.updated_at >= local.updated_at) {
      const { user_id: _u, ...clean } = r as BaseRow & Record<string, unknown>;
      rows[r.id] = clean as BaseRow;
      if (local && r.updated_at >= local.updated_at) dirty = dirty.filter((id) => id !== r.id);
    }
  }
  return {
    ...state,
    data: { ...state.data, [table]: rows } as DataState,
    sync: {
      ...state.sync,
      dirty: { ...state.sync.dirty, [table]: dirty },
      cursors: { ...state.sync.cursors, [table]: cursor || undefined },
    },
  };
}

/** Marks every live row dirty (e.g. first sign-in, so the server gets a full copy). */
export function markAllDirty(state: AppState): AppState {
  const dirty: AppState["sync"]["dirty"] = {};
  for (const t of TABLES) dirty[t] = Object.keys(state.data[t]);
  return { ...state, sync: { ...state.sync, dirty, cursors: {} } };
}

export function liveList<T extends TableName>(state: AppState, table: T): Tables[T][] {
  return Object.values(state.data[table]).filter((r) => !(r as BaseRow).deleted) as Tables[T][];
}

export function countDirty(state: AppState): number {
  return TABLES.reduce((n, t) => n + (state.sync.dirty[t]?.length ?? 0), 0);
}
