import "fake-indexeddb/auto";
globalThis.window ??= globalThis;
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import Dexie from "dexie";
import { db, getDb } from "../../src/lib/db.ts";
import { createTask, importCalendarTasks } from "../../src/lib/taskDb.ts";
import { buildBackupJson, parseBackup, importBackup } from "../../src/lib/backup.ts";
import { calendarImportSourceKey, calendarEventToTaskData } from "../../src/lib/api/google-calendar.ts";
import { planCalendarComparisons, parseComparisonPairs, parseDuplicateMatches, buildCalendarDuplicatePrompt, plausiblePair } from "../../src/lib/domain/calendar-import.ts";
import { checkCalendarDuplicates } from "../../src/lib/api/calendar-duplicates.ts";

const task = (id = "event1", changes = {}) => ({ title: "アスター社 一次面接", dueDate: "2026-09-07", dueTime: "10:00", category: "job", recurrence: "none", completed: false, completedAt: null, importSourceKey: calendarImportSourceKey({ calendarId: "test@example.invalid", id }), ...changes });
beforeEach(async () => { await db.tasks.clear(); });

test("replay, concurrent imports and repeated response entries persist one occurrence", async () => {
  const results = await Promise.all([importCalendarTasks([task(), task()]), importCalendarTasks([task()])]);
  assert.equal(await db.tasks.count(), 1);
  assert.equal(results.reduce((n, r) => n + r.added, 0), 1);
  assert.equal(results.reduce((n, r) => n + r.skipped, 0), 2);
  const saved = await db.tasks.toCollection().first();
  await db.tasks.update(saved.id, { title: "編集済み", completed: true, dueDate: "2026-09-09" });
  assert.deepEqual(await importCalendarTasks([task()]), { added: 0, skipped: 1 });
  assert.equal((await db.tasks.get(saved.id)).title, "編集済み");
});

test("distinct occurrences and calendars survive; source key components cannot collide", async () => {
  const other = task("event1", { importSourceKey: calendarImportSourceKey({ calendarId: "other@example.invalid", id: "event1" }) });
  assert.deepEqual(await importCalendarTasks([task(), task("event2"), other]), { added: 3, skipped: 0 });
  assert.notEqual(calendarImportSourceKey({calendarId:"a:b",id:"c"}), calendarImportSourceKey({calendarId:"a",id:"b:c"}));
});

test("failed batch rolls back preceding writes and can retry without duplicates", async () => {
  const second = task("event2");
  // Simulate a real primary-key constraint failure on the second write.
  await db.tasks.add({ ...second, id: second.importSourceKey, importSourceKey: undefined, createdAt: "legacy" });
  await assert.rejects(importCalendarTasks([task(), second]));
  assert.equal(await db.tasks.count(), 1);
  assert.equal(await db.tasks.where("importSourceKey").equals(task().importSourceKey).count(), 0);
  await db.tasks.delete(second.importSourceKey);
  assert.deepEqual(await importCalendarTasks([task(), second]), { added: 2, skipped: 0 });
});

test("legacy content matching is advisory and deliberate separate import remains possible", async () => {
  const legacy = await createTask({ ...task(), importSourceKey: undefined });
  const plan = planCalendarComparisons([task()], [legacy]);
  assert.deepEqual(plan.hardDuplicates, [false]);
  assert.equal(plan.hints[0].kind, "existing");
  assert.deepEqual(await importCalendarTasks([task()]), { added: 1, skipped: 0 });
  assert.equal(await db.tasks.count(), 2);
});

test("same-batch content matches keep a representative; semantic pairs compare differing titles only within time window", () => {
  const plan = planCalendarComparisons([task(), task("two"), task("three",{title:"アスター 選考面談"}), task("four",{dueDate:"2026-09-08"})], []);
  assert.equal(plan.hints[0], null);
  assert.equal(plan.hints[1].kind, "candidate");
  assert.equal(plan.pairs.length, 2);
  assert.equal(plan.hints[3], null);
  assert.equal(plausiblePair(task(), task("two",{dueTime:"12:00"})), false);
});

test("bounded semantic contract strips unrelated fields and rejects malformed dates, IDs and injected output", () => {
  const raw = [{id:0,left:{...task(),secret:"never send"},right:task("two",{title:"アスター 選考面談"})}];
  const pairs = parseComparisonPairs(raw);
  assert.ok(pairs);
  assert.doesNotMatch(buildCalendarDuplicatePrompt(pairs), /never send|importSourceKey|example.invalid/);
  assert.deepEqual(parseDuplicateMatches({matches:[0]}, pairs), [0]);
  for(const value of [{matches:[1]}, {matches:[0,0]}, {matches:["0"]}, {}, null]) assert.throws(() => parseDuplicateMatches(value,pairs));
  assert.equal(parseComparisonPairs([{...raw[0],left:{...task(),dueDate:"2026-02-31"}}]),null);
  assert.equal(parseComparisonPairs(Array.from({length:101},(_,id)=>({...raw[0],id}))),null);
  const plan = planCalendarComparisons(Array.from({length:30},(_,i)=>task(String(i),{title:`予定${i}`})), []);
  assert.equal(plan.pairs.length,100);
  assert.ok(plan.omittedPairs > 0);
});

test("calendar date-only/local time conversion preserves valid inputs and rejects impossible dates", () => {
  assert.equal(calendarEventToTaskData({start:{date:"2026-09-07"}}).dueTime,null);
  assert.equal(calendarEventToTaskData({start:{dateTime:"2026-09-07T10:00:00+09:00"}}).dueDate,"2026-09-07");
  for(const start of [{date:"2026-02-31"},{dateTime:"2026-02-31T10:00:00+09:00"},{dateTime:"2026-09-07T10:00:00"}]) assert.throws(()=>calendarEventToTaskData({start}));
});

test("v3 upgrade preserves legacy tasks; v4 backups roundtrip with identity and v3 remains accepted", async () => {
  getDb().close();
  await Dexie.delete("TaskManagerDB");
  const old = new Dexie("TaskManagerDB");
  old.version(3).stores({tasks:"id, dueDate, category, completed, recurrence",streaks:"date",plantState:"++id",drops:"++id, taskId, dateKey, rarity, &[taskId+dateKey]"});
  await old.table("tasks").add({...task(), importSourceKey:undefined,id:"legacy",createdAt:"2026-09-01"});
  old.close();
  await getDb().open();
  assert.equal((await db.tasks.get("legacy")).title,task().title);
  await importCalendarTasks([task()]);
  const backup = parseBackup(await buildBackupJson()).payload;
  assert.equal(backup.version,4);
  await importBackup(backup);
  assert.equal(await db.tasks.count(),2);
  assert.equal(parseBackup(JSON.stringify({...backup,version:3})).payload.version,3);
});

test("AI outage and cancellation reject explicitly instead of reporting zero matches", async () => {
  const original = globalThis.fetch;
  const pairs = parseComparisonPairs([{id:0,left:task(),right:task()}]);
  try {
    globalThis.fetch = async () => Response.json({error:"rate_limit"},{status:429});
    await assert.rejects(checkCalendarDuplicates(pairs,new AbortController().signal));
    globalThis.fetch = async (_url, init) => { init.signal.throwIfAborted(); return Response.json({matches:[]}); };
    const controller = new AbortController();controller.abort();
    await assert.rejects(checkCalendarDuplicates(pairs,controller.signal));
  } finally {globalThis.fetch=original;}
});
