// Runs the real migration in PGlite (PostgreSQL compiled to WebAssembly) with
// a minimal stand-in for Supabase's `auth` schema, then checks constraints,
// last-write-wins, deduplication and Row Level Security.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
let db: PGlite;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  if (user) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);
    await db.exec("set role authenticated");
  } else {
    await db.exec("set role anon");
  }
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  const migration = readFileSync("supabase/migrations/20261109000000_fitflow_schema.sql", "utf8");
  await db.exec(migration);
  await db.query(`insert into auth.users (id, email) values ($1, 'a@x'), ($2, 'b@x')`, [A, B]);
}, 60000);

describe("database schema", () => {
  it("lets a user write and read only their own rows (RLS)", async () => {
    await as(A, `insert into weight_logs (id, local_date, weight_kg, updated_at) values ('2026-11-10', '2026-11-10', 80, now())`);
    await as(B, `insert into weight_logs (id, local_date, weight_kg, updated_at) values ('2026-11-10', '2026-11-10', 90, now())`);
    const a = await as(A, `select user_id, weight_kg from weight_logs`);
    expect(a.rows).toEqual([{ user_id: A, weight_kg: "80.0" }]);
    const b = await as(B, `select weight_kg from weight_logs`);
    expect(b.rows).toEqual([{ weight_kg: "90.0" }]);
    // B cannot write rows for A
    await expect(
      as(B, `insert into weight_logs (user_id, id, local_date, weight_kg) values ($1, 'x', '2026-11-11', 70)`, [A]),
    ).rejects.toThrow(/row-level security/);
    // B cannot change A's rows (0 rows visible to update)
    await as(B, `update weight_logs set weight_kg = 1 where user_id = $1`, [A]);
    expect((await as(A, `select weight_kg from weight_logs`)).rows).toEqual([{ weight_kg: "80.0" }]);
  });

  it("denies anonymous access entirely", async () => {
    await expect(as(null, `select * from weight_logs`)).rejects.toThrow(/permission denied/);
    await expect(as(null, `select * from push_subscriptions`)).rejects.toThrow(/permission denied/);
  });

  it("keeps the newer row when an older offline edit arrives late (LWW)", async () => {
    const upsert = `insert into schedule_items (id, title, time_local, updated_at) values ('lunch', 'Lunch', $1, $2)
      on conflict (user_id, id) do update set time_local = excluded.time_local, updated_at = excluded.updated_at`;
    await as(A, upsert, ["13:00", "2026-11-10T02:00:00Z"]);
    await as(A, upsert, ["12:45", "2026-11-10T01:00:00Z"]); // stale
    expect((await as(A, `select time_local from schedule_items where id='lunch'`)).rows).toEqual([{ time_local: "13:00" }]);
    await as(A, upsert, ["12:15", "2026-11-10T03:00:00Z"]);
    expect((await as(A, `select time_local from schedule_items where id='lunch'`)).rows).toEqual([{ time_local: "12:15" }]);
  });

  it("rejects invalid times and out-of-range values", async () => {
    await expect(as(A, `insert into schedule_items (id, title, time_local) values ('bad', 'Bad', '25:00')`)).rejects.toThrow(/check/);
    await expect(as(A, `insert into weight_logs (id, local_date, weight_kg) values ('w', '2026-11-12', 5)`)).rejects.toThrow(/check/);
  });

  it("allows only one completion per item per day", async () => {
    await as(A, `insert into task_completions (id, local_date, item_id, status) values ('2026-11-10:lunch', '2026-11-10', 'lunch', 'completed')`);
    await expect(
      as(A, `insert into task_completions (id, local_date, item_id, status) values ('dup', '2026-11-10', 'lunch', 'skipped')`),
    ).rejects.toThrow(/duplicate key/);
  });

  it("stores push subscriptions privately and uniquely", async () => {
    await as(A, `insert into push_subscriptions (endpoint, p256dh, auth) values ('https://web.push.apple.com/a', 'p', 'k')`);
    expect((await as(B, `select * from push_subscriptions`)).rows).toHaveLength(0);
    expect((await as(A, `select endpoint from push_subscriptions`)).rows).toHaveLength(1);
    await expect(
      as(A, `insert into push_subscriptions (endpoint, p256dh, auth) values ('http://insecure', 'p', 'k')`),
    ).rejects.toThrow(/check/);
  });

  it("deduplicates notification occurrences and hides receipt tokens from users", async () => {
    const ins = `insert into notification_log (user_id, dedupe_key, kind, scheduled_for, receipt_token)
      values ($1, 'r:A:lunch:2026-11-10:12:30', 'reminder', now(), $2) on conflict (dedupe_key) do nothing returning id`;
    const first = await db.query(ins, [A, "t1".padEnd(40, "x")]);
    const second = await db.query(ins, [A, "t2".padEnd(40, "x")]);
    expect(first.rows).toHaveLength(1);
    expect(second.rows).toHaveLength(0);
    expect((await as(A, `select kind, status from notification_log`)).rows).toEqual([{ kind: "reminder", status: "sending" }]);
    await expect(as(A, `select receipt_token from notification_log`)).rejects.toThrow(/permission denied/);
    await expect(
      as(A, `insert into notification_log (user_id, dedupe_key, kind, scheduled_for) values ($1, 'fake', 'test', now())`, [A]),
    ).rejects.toThrow(/permission denied/);
  });

  it("deleting the account removes all personal data (cascade)", async () => {
    await db.query(`delete from auth.users where id = $1`, [A]);
    for (const t of ["weight_logs", "schedule_items", "task_completions", "push_subscriptions", "notification_log"]) {
      const r = await db.query<{ n: number }>(`select count(*)::int as n from ${t} where user_id = $1`, [A]);
      expect(r.rows[0].n).toBe(0);
    }
    const b = await db.query<{ n: number }>(`select count(*)::int as n from weight_logs where user_id = $1`, [B]);
    expect(b.rows[0].n).toBe(1);
  });
});
