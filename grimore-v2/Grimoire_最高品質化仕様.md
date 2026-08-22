# Grimoire 最高品質化仕様

> 文書状態: **実装前の品質仕様 / Decision Candidates**
> 対象: `背景世界 / 生物 / UI chrome / データストア`、UI デザインシステム、3D/VFX、マイクロインタラクション、音響
> 基準日: 2026-08-19
> 上位資料: `Grimoire_決定事項ログ.md`。本書は上位資料の確定事項を変更しない。

## 0. 読み方と適用規則

### 0.1 ラベル

- **[外部仕様/事実]**: 標準、公式文書、一次資料、または参照実装で確認できる内容。
- **[採用判断]**: 上位資料の確定事項を実装可能な形にした、本プロジェクトの判断。
- **[初期調整値]**: 実機・アセットで調整するための出発値。外部標準が保証する最適値ではない。
- **[Decision Candidate]**: 未決定事項への候補。採用しても `Grimoire_決定事項ログ.md` の確定事項を自動更新しない。

本書の「MUST / SHOULD / MAY」はそれぞれ必須、原則、任意を示す。外部資料に具体値がない場合、数値を外部事実のように扱わず、必ず **[初期調整値]** として分離する。

### 0.2 品質の守備範囲

最高品質とは、装飾量ではなく、次の同時成立と定義する。

1. 保存に失敗した操作から報酬・成長・演出が発生しない。
2. 背景と生物が独立しつつ、光だけは同じ世界に見える。
3. Pixel 7a を下限実機として 60 秒の鑑賞中に操作と可読性を失わない。
4. Things 3 的な情報の静けさを共通基盤に、金属・石材と自然史の二表現を重ねる。
5. 音、光、触覚は一つの原因に一つの応答として同期し、どれを無効にしても意味が失われない。

### 0.3 要求カバレッジ

| 要求 | 本書の仕様位置 | 検証 ID |
|---|---|---|
| 4 モジュール境界、一方向契約 | 1.1–1.5 | ARC-01–06 |
| IndexedDB transaction / migration / outbox | 1.6–1.9 | DAT-01–08 |
| Pixel 7a / Xiaomi 14T Pro 自動縮退 | 2 | PERF-01–09 |
| Things 3 的 UI | 3.1–3.3 | UI-01, MOT-01–04 |
| Elden 金属・石材 / MHW 自然史の二層 token | 3.4–3.6 | UI-02–05 |
| WCAG 2.2 AA | 3.5, 3.7 | A11Y-01–08 |
| god rays / fog / particles / ACES / shared light | 4.1–4.7 | VFX-01–10 |
| VRM / Live2D spring bone 部位別 | 4.8 | PHY-01–06 |
| press / rebound / glow | 5 | MOT-01–07 |
| adaptive BGM / SFX 同期、EQ / fade / polyphony | 6 | AUD-01–09 |
| 主要項目の 3 案比較 | 1.3, 2.2, 3.3, 4.2, 4.8, 5.2, 6.2 | DC-01–08 |

### 0.4 外部標準と初期キャリブレーションの境界

| 領域 | 外部標準 / 一次資料が規定・説明するもの | 本製品でだけ有効な初期キャリブレーション |
|---|---|---|
| IndexedDB | transaction の atomicity、abort rollback、commit 後 `complete`、`versionchange` | table/index 名、outbox lifecycle、10 秒を超えた演出縮退 |
| Accessibility | WCAG 2.2 AA の contrast 4.5:1 / 3:1、24 CSS px target minimum と例外 | 48 px target、palette hex、2 px focus ring |
| God rays / fog | radial sampling と `exposure/weight/decay/density` の意味、depth/scattering の参照実装 | samples 40/26、density .96/.90、解析的3-band depth/height fog、全 VFX budget |
| Tone mapping | linear workflow、出力色空間、tone map を重複させないこと | ACES exposure .72、area 補正範囲 .64–.80 |
| VRM / Live2D | VRM property の範囲と意味、Live2D physics の input/output 構造 | 耳/尻尾/毛先の係数、settle time、angle 上限 |
| Motion | spring の `stiffness/damping/mass` と velocity continuity | scale .972、y 2 px、各 spring、420 ms halo |
| Audio | Web Audio node/scheduling、BS.1770/R128 の測定法 | -23/-27 LUFS-I authoring target、EQ、duck、fade、polyphony |
| Performance | renderer counter と端末の公称 display spec | 60 fps 目標、calls/triangles 閾値、hysteresis、DPR cap |

表の右列は、一次資料で「最適」と認定された値ではない。Acceptance Matrix を通過し、decision log へ採用記録されるまで変更可能な仮説である。

---

## 1. システム / アーキテクチャ

### 1.1 現状課題

- 上位資料は「背景世界 / 生物 / UI chrome / データストア」の独立と、背景から生物へ共有する最小の光契約を定めているが、import 方向、書込み権限、契約の失効条件がコード化されていない。
- `taskCreated` / `taskCompletedFirstTime` は「保存成功後」に発行する必要がある。単なる React state 更新、Dexie `liveQuery()`、`onsuccess` をドメインイベントと見なすと、複数タブ・再試行・クラッシュで報酬の重複または欠落が起きうる。
- 「モジュール横断書込みは単一 transaction」と「イベントを受けて報酬を確定」の間に、イベント永続化、冪等性、再送の仕様が必要である。
- 旧 `TaskManagerDB` 移行は、ユーザー起点、先行 snapshot、失敗時 rollback、旧 DB 非削除までは確定している。版番号、重複防止、検証、別タブ競合を埋める必要がある。

### 1.2 外部調査

- **[外部仕様/事実]** Redux の公式 Style Guide は、action を「状態の setter」より意味のあるイベントとしてモデル化し、一つの操作を連続 setter に分割して不正な中間状態を作らないことを推奨する。Redux の基礎資料も一方向データフローを定義する。
  https://redux.js.org/style-guide/
  https://redux.js.org/tutorials/fundamentals/part-2-concepts-data-flow
- **[外部仕様/事実]** IndexedDB transaction は atomic で、abort 時は transaction 内の変更が rollback される。`complete` は transaction が正常に commit された後に発火し、schema 変更は `versionchange` transaction で行われる。
  https://www.w3.org/TR/IndexedDB/
- **[外部仕様/事実]** Dexie transaction の promise scope 内では、transaction 対象外の非同期処理を待たず、対象 table を明示する必要がある。Dexie の `storagemutated` は write transaction の commit 後に通知され、`liveQuery()` は query の再評価用途である。どちらも本アプリ固有の「初回完了」という意味までは保証しない。
  https://dexie.org/docs/Transaction/Transaction
  https://dexie.org/docs/Dexie/Dexie.transaction%28%29
  https://dexie.org/docs/Dexie/Dexie.on.storagemutated
  https://dexie.org/docs/liveQuery%28%29

### 1.3 主要判断: 書込みとイベントの 3 案

| 案 | 方式 | 長所 | 破綻点 | 推奨 |
|---|---|---|---|---|
| A | 各画面が table を直接更新し、`liveQuery` をイベント代用 | 最短 | 所有権が崩れ、「初回」「保存後」を表現できない | 不採用 |
| B | 保存後にメモリ EventEmitter だけで通知 | 単純、低遅延 | commit 直後の reload / crash で通知を失う | 不採用 |
| C | command → 単一 transaction で台帳と outbox を記録 → commit 後 dispatch、consumer 冪等化 | 一貫性、再送、監査性 | 実装量は増える | **推奨** |

**[Decision Candidate / 推奨]** C を採用候補とする。これはネットワークをまたぐ「厳密な exactly-once」を主張しない。`eventId` と consumer ごとの一意制約により、端末内で同じ論理イベントの効果を一度にする。

### 1.4 4 モジュールの所有権と import 方向

```text
User input
   │
   ▼
[UI chrome] ──Command──▶ [Data store / use cases] ──commit──▶ IndexedDB
   ▲                              │                         │
   │ Projection                   └──committed Outbox───────┘
   │                                      │
   ├────────────── read snapshots ◀───────┤
   │                                      ▼
   │                            [Creature] (reward/growth cue)
   │                                      ▲
   └── EnvironmentSnapshot ◀── [Background world]
                                      │
                                      └── light/tone only ──▶ Creature, UI
```

| モジュール | 唯一の所有物 | 公開するもの | 禁止 |
|---|---|---|---|
| Background world | area scene、camera、fog、VFX、quality governor、環境光 | immutable `EnvironmentSnapshot` / `QualitySnapshot` | 生物 node の操作、タスク読取、報酬書込み |
| Creature | model instance、idle / reaction、material adaptation、growth 表現 | `CreatureRenderState`、演出完了通知 | 背景 graph の変更、task text の受領、DB 直接書込み |
| UI chrome | nav、sheet、選択日、focus、短命な gesture 状態 | serializable `Command` | repository import、Three scene graph の直接操作、短命 state の永続化 |
| Data store | task / reward / growth / settings の正本、transaction、migration、outbox | use case、read projection、committed event | DOM / Audio / WebGL API の import |

**[採用判断]** 永続データの業務上の owner は task / reward / growth / settings 各 domain policy とし、物理的な IndexedDB 書込みは Data store adapter だけが行う。これにより上位資料 H-3 の「各モジュールが唯一の所有者」と、一括 transaction を両立する。

許可する依存は次だけとする。

```text
ui-chrome -> application-contracts
background-world -> rendering-contracts
creature -> rendering-contracts + committed-event-contracts
data-store -> domain-contracts + application-contracts
bootstrap -> all four (wiring only)
```

`background-world -> creature`、`creature -> background-world`、`ui-chrome -> data-store/adapter` の import は lint で fail させる。共有 package は型、pure function、token に限定し、mutable singleton を置かない。

### 1.5 状態契約

```ts
type Vec3Tuple = readonly [x: number, y: number, z: number];
type QualityTier = "full" | "reduced";

/** area1-coral 試作が現在公開している互換入力。consumer は直接依存しない。 */
export interface PrototypeEnvironmentV2 {
  readonly version: 2;
  readonly areaId: string;
  readonly quality: Readonly<{ tier: QualityTier }>;
  readonly light: Readonly<{
    direction: Readonly<{ x: number; y: number; z: number }>;
    color: number;                  // packed sRGB hex
    intensity: number;
    temperatureK: number;
  }>;
  readonly ambient: Readonly<{
    sky: number;                    // packed sRGB hex
    ground: number;                 // packed sRGB hex
    intensity: number;
  }>;
  readonly tone: Readonly<{ mapping: string; exposure: number }>;
}

/** 製品 bootstrap 以後の唯一の consumer-facing 契約。V2 と shape が違うため V3。 */
export interface EnvironmentSnapshotV3 {
  readonly schema: 3;
  readonly revision: number;          // 背景側が単調増加
  readonly areaId: string;
  readonly keyLight: {
    readonly directionWorld: Vec3Tuple; // normalized、背景から生物へ
    readonly colorLinear: Vec3Tuple;    // linear-sRGB、各成分 0..4
    readonly intensity: number;         // Three.js light intensity
    readonly temperatureK: number;      // 表示/補助用、2500..10000
  };
  readonly ambient: {
    readonly skyLinear: Vec3Tuple;
    readonly groundLinear: Vec3Tuple;
    readonly intensity: number;
  };
  readonly exposure: number;
  readonly toneMap: "aces-filmic";
  readonly qualityTier: QualityTier;
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function finiteRange(name: string, value: number, min: number, max: number): number {
  finite(name, value);
  if (value < min || value > max) throw new RangeError(`${name} is out of range`);
  return value;
}

function packedSrgb(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffff) {
    throw new RangeError(`${name} must be a packed 24-bit sRGB value`);
  }
  return value;
}

function frozenTuple(
  name: string,
  value: readonly number[],
  min: number,
  max: number,
): Vec3Tuple {
  if (value.length !== 3) throw new TypeError(`${name} must contain three components`);
  const copy: [number, number, number] = [
    finiteRange(`${name}[0]`, value[0], min, max),
    finiteRange(`${name}[1]`, value[1], min, max),
    finiteRange(`${name}[2]`, value[2], min, max),
  ];
  return Object.freeze(copy);
}

function normalizedDirection(source: PrototypeEnvironmentV2["light"]["direction"]): Vec3Tuple {
  const x = finite("light.direction.x", source.x);
  const y = finite("light.direction.y", source.y);
  const z = finite("light.direction.z", source.z);
  const length = Math.hypot(x, y, z);
  if (length <= 1e-8) throw new RangeError("light.direction must be non-zero");
  return frozenTuple("keyLight.directionWorld", [x / length, y / length, z / length], -1, 1);
}

export function adaptPrototypeEnvironmentV2(
  source: PrototypeEnvironmentV2,
  revision: number,
  srgbHexToLinearTuple: (hex: number) => Vec3Tuple,
): Readonly<EnvironmentSnapshotV3> {
  if (source.version !== 2 || source.tone.mapping !== "aces") {
    throw new Error("unsupported environment contract");
  }
  if (!Number.isSafeInteger(revision) || revision < 0) throw new RangeError("invalid revision");
  if (source.areaId.length === 0 || source.areaId.length > 128) throw new RangeError("invalid areaId");
  if (source.quality.tier !== "full" && source.quality.tier !== "reduced") {
    throw new RangeError("invalid quality tier");
  }

  const colorLinear = frozenTuple(
    "keyLight.colorLinear",
    srgbHexToLinearTuple(packedSrgb("light.color", source.light.color)),
    0,
    4,
  );
  const skyLinear = frozenTuple(
    "ambient.skyLinear",
    srgbHexToLinearTuple(packedSrgb("ambient.sky", source.ambient.sky)),
    0,
    4,
  );
  const groundLinear = frozenTuple(
    "ambient.groundLinear",
    srgbHexToLinearTuple(packedSrgb("ambient.ground", source.ambient.ground)),
    0,
    4,
  );

  return Object.freeze({
    schema: 3,
    revision,
    areaId: source.areaId,
    keyLight: Object.freeze({
      directionWorld: normalizedDirection(source.light.direction),
      colorLinear,
      intensity: finiteRange("light.intensity", source.light.intensity, 0, 100),
      temperatureK: finiteRange("light.temperatureK", source.light.temperatureK, 2500, 10000),
    }),
    ambient: Object.freeze({
      skyLinear,
      groundLinear,
      intensity: finiteRange("ambient.intensity", source.ambient.intensity, 0, 100),
    }),
    exposure: finiteRange("tone.exposure", source.tone.exposure, 0, 4),
    toneMap: "aces-filmic",
    qualityTier: source.quality.tier,
  });
}

export type CommittedDomainEvent =
  | Readonly<{
      type: "taskCreated";
      schema: 1;
      eventId: string;
      taskId: string;
      committedAt: string;
    }>
  | Readonly<{
      type: "taskCompletedFirstTime";
      schema: 1;
      eventId: string;
      taskId: string;
      committedAt: string;
      aggregate: Readonly<{ completionCountDelta: 1 }>;
    }>;
```

**[採用判断]** Creature が受ける payload に `title`、`description`、calendar body を入れてはならない。生物は `completionCountDelta` と確定済み reward/growth projection だけを読む。環境契約は light / tone / quality に限定し、背景と生物の物理的相互作用は作らない。area1-coral の `version: 2` は試作互換入力として bootstrap だけが読み、そこで packed sRGB を linear tuple に変換して `schema: 3` を公開する。V2 と V3 を同一版として扱わない。

契約更新規則:

- snapshot は `Object.freeze` 相当の readonly value とし、consumer が変更しない。
- breaking change は `schema` を増やし、bootstrap adapter で一世代だけ変換する。
- `revision` が古い snapshot は破棄する。area transition 中も最終選択 area の revision だけを commit する。
- UI の nav、sheet、選択日、hover、press state は永続 store に置かない。

### 1.6 IndexedDB schema と一括 transaction

```ts
import Dexie, { type EntityTable } from "dexie";

interface TaskRow {
  id: string;
  title: string;
  status: "open" | "completed";
  createdAt: string;
  completedAt?: string;
  firstCompletedAt?: string; // 一度入ったら unset しない
  legacySourceKey?: string;
  migrationSource?: string;
  migrationRunId?: string;   // native taskは未設定。active migration projectionだけを読む
}
interface LedgerRow {
  id: string;                // task:{taskId}:{created|completed}:v1
  taskId: string;
  kind: "created" | "completed";
  itemId: string;
  committedAt: string;
}
interface GrowthRow { id: string; eventId: string; delta: number; committedAt: string }
interface CommandReceipt {
  commandId: string;
  kind: "createTask";
  payloadHash: string;
  result: Readonly<{ taskId: string; eventId: string }>;
  committedAt: string;
}
interface OutboxRow {
  eventId: string;
  type: CommittedDomainEvent["type"];
  schema: number;
  payload: CommittedDomainEvent;
  state: "pending" | "processing" | "published";
  createdAt: string;
  publishedAt?: string;
  attempts: number;
  leaseOwner?: string;
  leaseExpiresAt?: string;
}
interface ConsumptionRow {
  id: string;
  consumer: string;
  eventId: string;
  state: "processing" | "acknowledged";
  leaseOwner?: string;
  leaseExpiresAt?: string;
  acknowledgedAt?: string;
}
interface MigrationRun {
  id: string;
  source: string;
  status: "running" | "staged" | "verified" | "active" | "failed" | "superseded";
  sourceHash: string;
  count: number;
}
interface MigrationStage { id: string; runId: string; legacySourceKey: string; task: TaskRow }
interface BackupRow { id: string; source: string; createdAt: string; sha256: string; json: string }

class GrimoireDB extends Dexie {
  tasks!: EntityTable<TaskRow, "id">;
  commandReceipts!: EntityTable<CommandReceipt, "commandId">;
  rewardLedger!: EntityTable<LedgerRow, "id">;
  growthLedger!: EntityTable<GrowthRow, "id">;
  outbox!: EntityTable<OutboxRow, "eventId">;
  consumption!: EntityTable<ConsumptionRow, "id">;
  migrationRuns!: EntityTable<MigrationRun, "id">;
  migrationStage!: EntityTable<MigrationStage, "id">;
  backups!: EntityTable<BackupRow, "id">;

  constructor() {
    super("GrimoireDB");
    this.version(1).stores({
      tasks: "id,status,createdAt,firstCompletedAt,migrationRunId,&[migrationSource+legacySourceKey]",
      commandReceipts: "commandId,kind,committedAt",
      rewardLedger: "id,taskId,kind,committedAt",
      growthLedger: "id,&eventId,committedAt",
      outbox: "eventId,state,createdAt,leaseExpiresAt",
      consumption: "id,&[consumer+eventId],state,leaseExpiresAt",
      migrationRuns: "id,&[source+sourceHash],status",
      migrationStage: "id,&[runId+legacySourceKey],runId",
      backups: "id,source,createdAt,sha256"
    });
  }
}
```

作成 use case も task と outbox を同一 transaction で確定する。

```ts
type CreateTaskCommand = {
  commandId: string; // dispatch前に一度だけ生成し、曖昧commit後のretryでも再利用する
  payloadHash: string; // canonical {id,title} のSHA-256。transaction開始前に算出する
  id: string;
  title: string;
};

async function createTask(input: CreateTaskCommand) {
  let result!: CommandReceipt["result"];
  await db.transaction("rw", [db.commandReceipts, db.tasks, db.outbox], async () => {
    const prior = await db.commandReceipts.get(input.commandId);
    if (prior) {
      if (prior.kind !== "createTask" || prior.payloadHash !== input.payloadHash) {
        throw new Error("COMMAND_ID_REUSED_WITH_DIFFERENT_PAYLOAD");
      }
      result = prior.result; // crash-after-commit retryは同じ確定結果を返す
      return;
    }

    const now = new Date().toISOString();
    const task: TaskRow = {
      id: input.id, title: input.title, status: "open", createdAt: now
    };
    const committedEvent: Extract<CommittedDomainEvent, { type: "taskCreated" }> = {
      type: "taskCreated", schema: 1,
      eventId: `task:${task.id}:created:v1`, taskId: task.id, committedAt: now
    };
    await db.tasks.add(task);
    await db.outbox.add({
      eventId: committedEvent.eventId, type: committedEvent.type, schema: 1,
      payload: committedEvent, state: "pending", createdAt: now, attempts: 0
    });
    result = Object.freeze({ taskId: task.id, eventId: committedEvent.eventId });
    await db.commandReceipts.add({
      commandId: input.commandId,
      kind: "createTask",
      payloadHash: input.payloadHash,
      result,
      committedAt: now,
    });
  });
  void outboxPump.kick(); // retryでreceiptを読んだ場合もpending回収を促す
  return result;
}
```

`commandId`と`payloadHash`はUI dispatch境界で一度作り、通信断・tab crash・応答消失後も
同じ組を再利用する。receipt、task、outboxは同一transactionなので「commitしたが呼出側が
結果を受け取れなかった」境界でも2件目を作らない。別payloadによる同じ`commandId`の再利用は
成功扱いにせず明示的に拒否する。

完了 use case の全書込みを一つにまとめる。

```ts
async function setTaskCompleted(taskId: string, completed: boolean) {
  let committedEvent: CommittedDomainEvent | undefined;

  await db.transaction(
    "rw",
    [db.tasks, db.rewardLedger, db.growthLedger, db.outbox],
    async () => {
      const task = await db.tasks.get(taskId);
      if (!task) throw new Error("TASK_NOT_FOUND");

      const now = new Date().toISOString();
      const first = completed && task.firstCompletedAt === undefined;
      await db.tasks.update(taskId, {
        status: completed ? "completed" : "open",
        completedAt: completed ? now : undefined,
        ...(first ? { firstCompletedAt: now } : {})
      });

      if (!first) return;
      const eventId = `task:${taskId}:completed:v1`;
      const itemId = drawRewardFromStableWeights(eventId); // pure、外部 I/O 禁止
      await db.rewardLedger.add({ id: eventId, taskId, kind: "completed", itemId, committedAt: now });
      await db.growthLedger.add({ id: eventId, eventId, delta: 1, committedAt: now });
      committedEvent = {
        type: "taskCompletedFirstTime", schema: 1, eventId, taskId,
        committedAt: now, aggregate: { completionCountDelta: 1 }
      };
      await db.outbox.add({
        eventId, type: committedEvent.type, schema: 1, payload: committedEvent,
        state: "pending", createdAt: now, attempts: 0
      });
    }
  );

  // ここへ到達した時点で transaction は commit 済み。演出は optimistic に出さない。
  if (committedEvent) void outboxPump.kick();
}
```

**[採用判断]** reward 抽選は `eventId` を seed にした pure function とし、transaction 内で network、timer、Web Audio、Three.js を呼ばない。未完了へ戻しても `firstCompletedAt` と ledger は削除せず、再完了は `first=false` になる。タスク削除も ledger/growth を cascade delete しない。

### 1.7 Durable outbox と consumer 冪等性

```ts
async function claimConsumer(
  consumer: "creature-reaction" | "audio-reward" | "ui-reward",
  event: CommittedDomainEvent,
  owner: string,
  now: Date
) {
  const id = `${consumer}:${event.eventId}`;
  return db.transaction("rw", db.consumption, async () => {
    const row = await db.consumption.get(id);
    if (row?.state === "acknowledged") return false;
    if (row?.state === "processing"
      && Date.parse(row.leaseExpiresAt ?? "") > now.getTime()
      && row.leaseOwner !== owner) return false;
    await db.consumption.put({
      id, consumer, eventId: event.eventId, state: "processing", leaseOwner: owner,
      leaseExpiresAt: new Date(now.getTime() + 15_000).toISOString()
    });
    return true;
  });
}

async function acknowledgeConsumer(consumer: string, eventId: string, owner: string) {
  const id = `${consumer}:${eventId}`;
  await db.transaction("rw", db.consumption, async () => {
    const row = await db.consumption.get(id);
    if (row?.state !== "processing" || row.leaseOwner !== owner) return;
    await db.consumption.update(id, {
      state: "acknowledged", acknowledgedAt: new Date().toISOString(),
      leaseOwner: undefined, leaseExpiresAt: undefined
    });
  });
}
```

**[採用判断]** outbox pump は `pending` または lease期限切れの`processing`を`createdAt,eventId`順に読み、短い`rw` transactionで`leaseOwner`と15秒の`leaseExpiresAt`を付けて一件だけclaimする。consumerも上記inbox/ack leaseをclaimしてからdispatchし、全consumerが`acknowledged`になった場合だけ別transactionで`published`にする。lease更新・解放はowner一致を条件とし、複数tabが同じ有効leaseを実行しない。`BroadcastChannel("grimoire-events-v1")`はcommit後の低遅延通知にだけ使い、正本や排他制御にしない。起動時・`visibilitychange`復帰時にもpending/期限切れleaseを再走査する。

**注意:** 音や一回限りのanimation自体はside effect後・ack前のcrash境界で厳密exactly-onceにできない。獲得状態はunique ledgerで一度、提示は**at-least-once + idempotent session key + durable consumer ack**と明記する。leaseは同時実行を抑えるがcrash後の再実行をなくす保証ではない。再起動後10秒を超えた古いreward eventはfull animationを再生せず、collection badgeの静かな更新へ縮退する。`committedAt`はこのstaleness判定と監査にだけ使い、過去の壁時刻を演出scheduleに流用しない。consumer claim成功時にpresentation orchestratorが試行ごとの`presentationId`と新しいmonotonic `presentationAt = performance.now() + 50 ms`を作り、visual / audio / creatureの3 consumerへ同じenvelopeを渡す。audioはそのlookahead差分を`AudioContext.currentTime`へ変換し、visual / creatureは同じ`presentationAt`をrender clockで解決する。

### 1.8 migration / versionchange

**[Decision Candidate / 推奨手順]** 旧 `TaskManagerDB` の移行は次の state machine にする。

```json
{
  "migrationId": "taskmanagerdb-to-grimoire-v1",
  "phases": [
    "idle",
    "legacy-detected",
    "user-confirmed",
    "snapshot-exported",
    "validated",
    "staging",
    "staged",
    "verified",
    "activating",
    "active"
  ],
  "rollbackBoundary": "each IndexedDB transaction; unverified rows remain staging-only",
  "deleteLegacyDatabase": false
}
```

1. 読取専用で旧 DB を検出し、件数と対象項目を表示する。自動開始しない。
2. ユーザーの「移行してバックアップを保存」を起点に、canonical JSON（key を辞書順、UTF-8）と SHA-256 を生成する。downloadable Blob を端末へ保存できたことを確認し、新 DB の `backups` にも複製する。旧 DB は残す。
3. task ID、title、timestamp、status を正規化する。不正 row は理由付き quarantine list に入れ、黙って推測しない。旧 streak / plant / drop は snapshot にだけ残し、v2 の reward/growth へ変換しない。
4. `[source+sourceHash]`を先に検索する。既存runが`active`なら同じ結果を返して終了し、`running/staged/verified`なら同じ`runId`の最後のdurable phaseから再開する。`failed`はユーザーが「再試行」を選んだ場合だけ同じ`runId`のstagingを一つのtransactionで作り直す。同じsnapshotに新しい`runId`を発行しない。初回だけrunを作り、`migrationStage + migrationRuns(status="staged")`を一つの`rw` transactionで書く。`tasks`正本にはまだ触れない。`[runId+legacySourceKey]`と`[source+sourceHash]`のunique indexで再実行を冪等化する。
5. staging commit後、入力件数 = staged + quarantined、全`legacySourceKey`一意、timestamp round-trip、sourceHash一致を検証する。失敗時はrunを`failed`にし、active taskは0、旧DB・snapshot・stagingを調査可能なまま維持する。
6. 検証成功時だけ`migrationRuns(status="verified")`を前提条件に、`migrationStage`の各rowで予約prefixを含む決定論的IDを再検証し、`tasks.bulkPut`で同じsource/keyの旧active rowを原子的に置換する（新規snapshotで消えた旧rowは残してもsuperseded run所属のためprojection外）。同じtransactionで各taskへ`migrationSource=source, migrationRunId=runId`を付け、同じsourceの旧active runを`superseded`、新runを`active`へflipする。このactivation transaction失敗時はtask置換もstatus flipも全rollbackする。read projectionはnative task（`migrationRunId`なし）とactive run所属taskだけを返す。
7. `blocked` / `versionchange` が発生した場合は別 tab を閉じる案内を出し、強制 delete や隠れた retry をしない。

旧DB snapshotの保存はmigration transactionの外側で先行させる。transaction scope内ではWeb Crypto、download、fetchをawaitしない。activation後も旧DBとsnapshotを少なくとも次回export成功まで保持し、自動削除しない。

移行taskのIDは`migration:${source}:${legacySourceKey}`を正規化して決定論的に生成し、native
createは予約prefix `migration:`を拒否する。旧データ内で正規化後のkeyが衝突した場合は
quarantineへ送り、native taskを上書きしない。

### 1.9 failure / observability

- `commandId`, `eventId`, `transactionName`, `durationMs`, `result` を構造化 log に残す。task text は log に含めない。
- quota / blocked / version / constraint / unknown を error code 化し、UI は保存失敗時に reward animation を出さず、入力内容を画面内 draft として保持する。
- export/import JSON は `schemaVersion`、`exportedAt`、各 collection の count と SHA-256 manifest を持つ。OAuth token / Google 認可情報は含めない。
- repository contract test は fake だけでなく実ブラウザ IndexedDB で走らせる。fake implementation の挙動だけで commit timing を保証しない。

---

## 2. 適応品質 / 実機パフォーマンス

### 2.1 現状課題と外部調査

上位資料の full / reduced 二段階、Pixel 7a 下限、世界画面最大約 60 秒、60 fps 目標は妥当だが、昇降格の窓、hysteresis、実測値の採取方法が未定義である。

- **[外部仕様/事実]** Three.js の `renderer.info.render` は call / triangle 等を提供する。multi-pass rendering では `autoReset=false` とし、frame の最後に手動 reset する。renderer は `outputColorSpace` と tone mapping exposure も管理する。
  https://threejs.org/docs/pages/WebGLRenderer.html
- **[外部仕様/事実]** `detect-gpu` は benchmark と fps をもとに tier を返すが、README は benchmark data の更新停止を 2025-12 と明記している。したがって将来端末の恒久的な真値にはできない。
  https://github.com/pmndrs/detect-gpu
- **[外部仕様/事実]** Pixel 7a は 1080×2400 OLED、最大 90 Hz、Tensor G2。Xiaomi 14T Pro は 2712×1220、最大 144 Hz。物理解像度や refresh rate が異なるため、端末名ではなく実 frame time を基準にする。
  https://support.google.com/pixelphone/answer/7158570?hl=en
  https://www.mi.com/jp/support/faq/details/KA-491244/
  https://www.mi.com/uk/support/faq/details/KA-507160/

### 2.2 主要判断: tier 判定の 3 案

| 案 | 方式 | 長所 | 弱点 | 推奨 |
|---|---|---|---|---|
| A | UA / 端末名 table | 安定 | 新端末、browser、thermal 状態を反映しない | 不採用 |
| B | `detect-gpu` の初回 tier のみ | 速い | benchmark 更新停止、実 scene と一致しない | 補助のみ |
| C | cold-start hint + scene 実測 + hysteresis | 現実の負荷に追従 | controller test が必要 | **推奨** |

### 2.3 正確な初期 budget

**[初期調整値]** 次は Grimoire scene の出発 budget であり Three.js 一般の保証値ではない。

```json
{
  "targetFps": 60,
  "sampleFrames": 120,
  "warmupMs": 4000,
  "ignoreAfterVisibilityMs": 1000,
  "minimumTierDwellMs": 15000,
  "metricContract": {
    "primarySceneDrawCalls": "sky+world primary render only",
    "primarySceneTriangles": "visible area.group world geometry; sky excluded",
    "totalDrawCalls": "diagnostic-only",
    "rendererTotalTriangles": "diagnostic-only",
    "triangleBudget": 150000,
    "triangleTolerance": 0.02,
    "triangleEffectiveCeiling": 153000
  },
  "fullToReduced": {
    "sustainMs": 2500,
    "p20FpsBelow": 48,
    "primarySceneDrawCallsAbove": 50,
    "primarySceneTrianglesAbove": 153000,
    "postPassesAbove": 10
  },
  "reducedToFull": {
    "sustainMs": 8000,
    "p20FpsAtLeast": 57,
    "primarySceneDrawCallsAtMost": 38,
    "primarySceneTrianglesAtMost": 100000,
    "postPassesAtMost": 8
  },
  "lockReducedAfterDowngrades": 2,
  "tiers": {
    "full": {
      "dprCap": 1.5,
      "renderScale": 1.0,
      "godRayResolutionScale": 0.42,
      "godRaySamples": 40,
      "bloomMips": 4,
      "particleCount": 1500,
      "fogMode": "analytic-material"
    },
    "reduced": {
      "dprCap": 1.15,
      "renderScale": 0.82,
      "godRayResolutionScale": 0.34,
      "godRaySamples": 26,
      "bloomMips": 3,
      "particleCount": 420,
      "fogMode": "analytic-material"
    }
  }
}
```

品質制御規則:

- `p20Fps` は background tab、shader compile、area load、context restore 後の warm-up を除いた frame time から算出する。
- `primarySceneDrawCalls`はsky + worldのprimary pass直後に採取した`renderer.info.render.calls`。`primarySceneTriangles`はframe境界で`area.group`を`traverseVisible`し、indexed/non-indexed geometryのtriangle数へ`InstancedMesh.count`を掛けたvisible world geometry counterで、skyとpost用full-screen geometryを含めない。全pass累積の`renderer.info.render.calls/triangles`は`totalDrawCalls` / `rendererTotalTriangles`として診断表示するが、自動縮退条件には使わない。
- triangle の設計基準は 150,000、T008 受入 tolerance は ±2%。上限は `150000 * (1 + 0.02) = 153000` なので、自動縮退は `primarySceneTriangles > 153000` のときだけ成立する。現在の試作実測 152,490 は基準比 +1.66% で tolerance 内であり、端末性能と無関係に triangle 条件だけで reduced へ落としてはならない。
- いずれか一つの downgrade 条件が継続すれば reduced。upgrade は全条件を満たした場合だけとする。
- 一 session で 2 回 downgrade したら reduced に固定し、oscillation を止める。ユーザーが手動で tier を選んだ場合は自動変更しない。
- `targetFps: 60` は最低品質の校正基準であり、render loop の固定 cap ではない。90/144 Hz 端末では native `requestAnimationFrame` / `setAnimationLoop` cadence を維持し、p20/p5 と 100 ms 超 stall、60 秒鑑賞の thermal drift を実測する。
- `renderer.info.autoReset = false` とし、frame開始時にreset、sky+world primary scene後にcallsをsnapshotし、全pass後にrenderer total calls/trianglesを採取する。`primarySceneTriangles`だけはrenderer counterの差分ではなく、品質tier変更時にvisible `area.group`から再計数する。post passはEffectComposer側で別計数する。
- WebGL context loss、shader compile failure、reduced でも p20 < 40 が 3 秒継続した場合は、上位資料で許容された video / poster fallback を表示する。

### 2.4 controller 擬似コード

```ts
const frameStart = readRenderCounters(renderer.info.render);
renderSkyAndWorldPrimary();
const afterPrimary = readRenderCounters(renderer.info.render);

renderCreatureAndPostProcessing();
const afterAllPasses = readRenderCounters(renderer.info.render);

const primarySceneCalls = afterPrimary.calls - frameStart.calls;
const primarySceneTriangles = countVisibleTriangles(area.group); // skyを除くworld geometry
const totalDrawCalls = afterAllPasses.calls - frameStart.calls; // 診断のみ
const rendererTotalTriangles = afterAllPasses.triangles - frameStart.triangles; // 診断のみ

const downgrade =
  m.p20Fps < 48 ||
  primarySceneCalls > 50 ||
  primarySceneTriangles > 153_000 ||
  m.postPasses > 10;
const recover =
  m.p20Fps >= 57 &&
  primarySceneCalls <= 38 &&
  primarySceneTriangles <= 100_000 &&
  m.postPasses <= 8;

if (tier === "full" && sustained(downgrade, 2500) && dwell(15_000)) setTier("reduced");
if (tier === "reduced" && sustained(recover, 8000) && dwell(15_000) && downgrades < 2) {
  setTier("full");
}

diagnostics.record({
  primarySceneCalls,
  primarySceneTriangles,
  totalDrawCalls,
  rendererTotalTriangles,
});
renderer.info.reset();
```

変更は frame 境界で atomically 適用する。resource を毎回 dispose/recreate せず、particle pool、render target、geometry LOD を事前準備または遅延一回生成して再利用する。

---

## 3. UI/UX と二層デザイン token

### 3.1 現状課題

- Things 3 を品質基準とする方針はあるが、コピー密度、情報の展開、focus、target size、motion hierarchy が実装値になっていない。
- Elden 的な金属・石材と MHW 的な自然史を別 skin にしすぎると、同じアプリに見えず、contrast も崩れる。逆に共通 token だけでは二つの感情が出ない。
- icon-only navigation と long-press label の確定方針は、支援技術の accessible name を long press に依存してはならない。見た目の決定は維持し、意味伝達を補強する必要がある。

### 3.2 外部調査

- **[外部仕様/事実]** Things は詳細を必要時に展開し、画面内の位置関係を保つ animation と、邪魔をしない構造を製品特徴として説明している。
  https://culturedcode.com/things/features/
  https://culturedcode.com/things/
- **[外部仕様/事実]** WCAG 2.2 AA は通常 text 4.5:1、大きな text 3:1、UI component / graphical object 3:1、target size は原則 24×24 CSS px 以上を求める。
  https://www.w3.org/TR/WCAG22/
  https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html
  https://www.w3.org/WAI/WCAG22/Techniques/general/G207
- **[外部仕様/事実]** Apple の motion guidance は、motion を目的に結びつけ、短く、操作を妨げず、Reduce Motion に応答させる。game control guidance は頻用 control の 44×44 pt 以上、視覚的/tactile な press state、指の下でも見える feedback を推奨する。
  https://developer.apple.com/design/human-interface-guidelines/motion
  https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria
  https://developer.apple.com/design/human-interface-guidelines/game-controls
- **[外部仕様/事実]** Capcom は Monster Hunter: World の表現を、密度のある生態系、自然で現実的な光、二次反射や光の透過まで含めた世界として説明している。Elden Ring の公式ページは本書では美術方向の参照にのみ使い、UI token の技術標準とは扱わない。
  https://www.capcom.co.jp/ir/english/interview/2017/vol02.html
  https://www.capcom.co.jp/ir/english/feature/2017_mh_crvoice.html
  https://www.bandainamcoent.com/games/elden-ring
- **[外部仕様/事実]** Monument Valley の制作側は、各 screen を一枚の art とし、instruction を最小化し、art / sound / text / animation の均衡を重視したと説明している。
  https://ustwo.com/blog/monument-valley-out-now/
  https://ustwo.com/work/monument-valley/

### 3.3 主要判断: 表現構造の 3 案

| 案 | 構造 | 長所 | リスク | 推奨 |
|---|---|---|---|---|
| A | 全画面を金属/石に統一 | 重厚 | Grimo catalog の生態観察が弱い | 不採用 |
| B | 画面ごとに完全別 design system | 強い差 | 学習、保守、a11y が分裂 | 不採用 |
| C | semantic foundation + 2 expression layers | 一貫性と差を両立 | token discipline が必要 | **推奨** |

**[採用判断]** 上位資料 R-2 に合わせ C。署名的要素は一つだけ、背景の `keyLight.colorLinear` を受ける「環境光の印章 / halo」とする。装飾枠、grain、glow を同時に主役化しない。

### 3.4 token の二段階解決

```ts
type SemanticTokens = {
  surfaceCanvas: string; surfaceRaised: string;
  textPrimary: string; textSecondary: string;
  borderStrong: string; accent: string; onAccent: string; focus: string; danger: string;
};
type Expression = "order" | "natural-history";

// 1. theme が可読性を決める。2. expression は意味を変えず材質・形・間隔を上書きする。
const tokens = resolveExpression(resolveTheme(base, colorScheme), expression);
```

```json
{
  "foundation": {
    "space": { "1": 4, "2": 8, "3": 12, "4": 16, "5": 24, "6": 32 },
    "radius": { "control": 12, "panel": 18, "sheet": 24, "pill": 999 },
    "typePx": { "caption": 12, "body": 15, "bodyStrong": 15, "title": 20, "display": 28 },
    "lineHeight": { "caption": 1.4, "body": 1.55, "title": 1.3, "display": 1.2 },
    "touchTargetMinPx": 48,
    "focusRing": { "widthPx": 2, "offsetPx": 2 }
  },
  "light": {
    "surfaceCanvas": "#F3F0E8",
    "surfaceRaised": "#FFFDF7",
    "textPrimary": "#20241F",
    "textSecondary": "#545B52",
    "borderStrong": "#686E65",
    "accent": "#6F5315",
    "onAccent": "#FFFFFF",
    "focus": "#0B5EA8",
    "danger": "#9B2C2C"
  },
  "dark": {
    "surfaceCanvas": "#101412",
    "surfaceRaised": "#1A1F1C",
    "textPrimary": "#F2EFE6",
    "textSecondary": "#B9B5AA",
    "borderStrong": "#92998F",
    "accent": "#D7B45A",
    "onAccent": "#20241F",
    "focus": "#75B7F0",
    "danger": "#FF8A80"
  },
  "expressions": {
    "order": {
      "material": ["brushed-brass", "oxidized-iron", "slate", "ash"],
      "radiusScale": 0.72,
      "titleTrackingEm": 0.055,
      "ruleWidthPx": 1,
      "ornamentOpacity": 0.16
    },
    "natural-history": {
      "material": ["vellum", "moss", "mineral", "specimen-ink"],
      "radiusScale": 1.0,
      "titleTrackingEm": 0.025,
      "ruleWidthPx": 1,
      "ornamentOpacity": 0.12
    }
  }
}
```

**[初期調整値]** typography は self-hosted WOFF2 の `Noto Sans JP` を本文、`Shippori Mincho` を display/title に限定する。本文で装飾 serif を多用しない。数値・日付は tabular numerals。font 未ロード時も layout shift を抑えるため size-adjust 済み fallback を設定する。

### 3.5 contrast の検算値

次は sRGB 相対輝度による初期 palette の実測比。AA の下限を token CI で守る。

| 組合せ | Contrast | 用途 |
|---|---:|---|
| `#20241F` / `#F3F0E8` | 13.83:1 | light primary text |
| `#545B52` / `#F3F0E8` | 6.16:1 | light secondary text |
| `#686E65` / `#F3F0E8` | 4.60:1 | light component boundary |
| `#6F5315` / `#F3F0E8` | 6.31:1 | light accent text/icon |
| `#FFFFFF` / `#6F5315` | 7.18:1 | light on-accent text/icon |
| `#F2EFE6` / `#101412` | 16.15:1 | dark primary text |
| `#B9B5AA` / `#101412` | 9.07:1 | dark secondary text |
| `#92998F` / `#101412` | 6.35:1 | dark component boundary |
| `#D7B45A` / `#101412` | 9.34:1 | dark accent text/icon |
| `#20241F` / `#D7B45A` | 7.92:1 | dark on-accent text/icon |

半透明 texture / video 上へ text を直接置かない。必ず semantic surface を背面に置き、最終 composited pixel で contrast test する。accent面の文字/iconは必ず同themeの`onAccent`を使う。token CIは`text* × surface*`、`accent × surface*`、`onAccent × accent`を検査する。`disabled` を除き、opacity を下げて 4.5:1 を割らない。

### 3.6 UI composition

- task list は情報を一段ずつ開く。row は title + status を常時表示し、date / note / reward detail は展開時にだけ表示する。展開しても scroll anchor を維持する。
- calendar 月表示は上位資料どおり一日 2 件 + overflow count、同一画面の detail region。source ではなく task category 色を使う。
- bottom nav は透明 icon-only を維持し、全 button に常時 `aria-label` と current state の `aria-current="page"` を付ける。long press tooltip は補助であり accessible name にしない。
- **[Decision Candidate]** 初回利用時だけ 3 秒の visible label onboarding を出す案を推奨するが、上位資料の icon-only 方針に関わるため確定しない。代替は settings で「ナビ名を常時表示」。
- empty state は説明文一文 + 一つの primary action まで。架空の rarity、streak anxiety、game-like failure を追加しない。
- light / dark / system の切替は view transition 中も semantic token を一括更新し、一 frame 内で混在させない。

### 3.7 accessibility contract

- pointer target は最低 48×48 CSS px。visual icon は 20–24 px でも hit area を広げる。
- keyboard focus は 2 px ring + 2 px offset。`:focus-visible` を消さない。sheet は focus trap、Escape close、close 後 trigger へ focus return。
- error / completion / reward は色、音、motion 単独で伝えず、text/status icon を併用する。
- `prefers-reduced-motion: reduce` では parallax、camera drift、spring bone、spatial rebound、particle burst を停止し、80 ms 以下の opacity/brightness change に置換する。音は自動 mute しない。
- screen reader announcement は保存 commit 後に一回だけ。optimistic state を live region に流さない。
- 200% text zoom、320 CSS px 幅、landscape、large font で horizontal page scroll を発生させない。

---

## 4. 3D / VFX / 生物物理

### 4.1 現状課題と外部調査

現在の方向は、固定ジオラマ、霧に沈む遠景、1–2 本の光芒、漂う粒子、背景と生物は別 layer である。課題は screen-space god rays の画面端 artifact、複数 pass の色空間、fog の二重適用、particle overdraw、別 layer の光同期である。

- **[外部仕様/事実]** GPU Gems の volumetric light scattering は、screen-space radial sampling を示し、`exposure` を全体強度、`weight` を sample 強度、`decay^i` を距離減衰、`density` を sample 間隔として説明する。低解像度 source は bandwidth を減らす一方、遮蔽と画面端 artifact の管理が必要である。
  https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process
- **[外部仕様/事実]** Three.js は god rays の公式 example を提供する。現行 `GodraysNode` の default density は 0.7 で、depth-aware な合成例もあるが WebGPU/TSL 系 API であり、WebGL 実装へ名前だけ移植して同等とみなさない。
  https://threejs.org/examples/webgl_postprocessing_godrays.html
  https://threejs.org/docs/pages/GodraysNode.html
- **[外部仕様/事実]** Three.js の公式 WebGPU examples は custom fog scattering と height fog を別例として示す。ただし、これらは raymarch を本製品の WebGL2 既定実装にする根拠ではない。
  https://threejs.org/examples/webgpu_custom_fog_scattering.html
  https://threejs.org/examples/webgpu_fog_height.html
- **[外部仕様/事実]** pmndrs `postprocessing` は compatible effect を一つの shader pass に merge し、linear workflow を前提にする。postprocessing 内で tone map する場合、renderer 側との二重 tone mapping を避ける必要がある。
  https://github.com/pmndrs/postprocessing
  https://github.com/pmndrs/postprocessing/wiki/Effect-Merging
- **[外部仕様/事実]** `InstancedMesh` は同一 geometry/material の object 群の draw call 削減用途である。`wawa-vfx` も instanced particle と billboard を採用する。
  https://threejs.org/docs/pages/InstancedMesh.html
  https://threejs.org/manual/en/optimize-lots-of-objects.html
  https://github.com/wass08/wawa-vfx
- Shadertoy は形状探索の visual R&D に使えるが、作品の値を端末 budget の根拠にはしない。
  https://www.shadertoy.com/view/XtBXDy
  https://www.shadertoy.com/view/ldlcRf

### 4.2 主要判断: 大気実装の 3 案

| 案 | 実装 | 品質 | Cost / risk | 推奨 |
|---|---|---|---|---|
| A | full-resolution raymarch volume | 最も立体的 | mobile fill-rate と透明 overdraw が重い | 不採用 |
| B | radial god rays + scene fog + instanced particles | 十分な奥行き、制御容易 | screen-space artifact | **推奨** |
| C | baked video loop | 安定した美観 | theme/light 同期、解像度、容量 | fallback |

**[採用判断]** B を live default、C を failure fallback とする。B の scene fog は area1-coral で検証済みの解析的な3-band distance + height fogを各 world material で一度だけ評価する。A と depth-reconstructed raymarch は **[Decision Candidate]** の desktop experiment に限定し、現行 contract、post-pass budget、full/reduced tier には含めない。

### 4.3 rendering / color pipeline

```ts
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // 最終 composite で一回だけ ACES
renderer.info.autoReset = false;

// 現行順序: sky + world（解析fog・instanced particlesをmaterial内で合成）
//         -> occlusion -> radial god rays -> bloom -> ACES composite -> sRGB output
renderSkyAndWorldToHdr({ analyticMaterialFog: true, instancedParticles: true });
capturePrimarySceneCounters();
renderOcclusionAndRadialGodRays();
renderBloom();
compositeAcesOnceToSrgbCanvas();
```

**[採用判断]** material/base color と light 計算は linear-sRGB、UI と最終 canvas 出力は sRGB。ACES は一度だけ適用する。背景 texture は color texture のみ `SRGBColorSpace`、normal / roughness / metalness / depth は `NoColorSpace` とする。

**[初期調整値]** 現在のarea1-coralで実装・tone照合済みのexposure `0.72`を基準にする。実HDR assetの18% grayとcreature skin/materialを同じchartで再測定し、`0.64–0.80`の範囲でareaごとに±0.08以内だけ補正する。areaが変わってもcreatureのrelative luminanceが15%を超えて跳ばない。

### 4.4 god rays / fog / bloom / particles の初期値

```json
{
  "godRays": {
    "algorithm": "radial-screen-space",
    "full": {
      "samples": 40,
      "resolutionScale": 0.42,
      "density": 0.96,
      "weight": 0.42,
      "decay": 0.962,
      "distanceAttenuation": 2.0,
      "exposure": 0.40,
      "intensity": 1.05,
      "clamp": 1.35
    },
    "reduced": {
      "samples": 26,
      "resolutionScale": 0.34,
      "density": 0.90,
      "weight": 0.38,
      "decay": 0.955,
      "distanceAttenuation": 2.2,
      "exposure": 0.34,
      "intensity": 0.82,
      "clamp": 1.10
    },
    "sunUvGuardBand": 0.12,
    "temporalJitterPx": 0.35
  },
  "fog": {
    "mode": "analytic-material-depth-height-three-band",
    "density": 0.0265,
    "power": 1.28,
    "distanceBands": { "near": 12, "mid": 34, "far": 115 },
    "colorSRGB": { "near": "#33536E", "mid": "#24507A", "far": "#1D4472" },
    "heightFalloff": 0.052,
    "heightOffset": 0.4,
    "floorBoost": 0.24,
    "inscatter": { "strength": 0.55, "power": 7.0, "colorSRGB": "#CBE8FF" },
    "noise": { "scrollSpeed": 0.035, "scale": 0.035, "amount": 0.20 }
  },
  "bloom": {
    "threshold": 1.15,
    "softKnee": 0.55,
    "intensity": 0.22,
    "radius": 0.78,
    "mips": { "full": 4, "reduced": 3 }
  },
  "particles": {
    "count": { "full": 1500, "reduced": 420 },
    "sizePx": [0.8, 2.6],
    "speedMps": [0.006, 0.024],
    "lifetimeSec": [12, 34],
    "opacity": [0.05, 0.22],
    "twinkleHz": [0.05, 0.18],
    "spawnVolumeM": [14, 7, 10],
    "maxScreenCoverage": 0.035,
    "blend": "premultiplied-alpha",
    "depthWrite": false
  }
}
```

**[初期調整値]** これらは GPU Gems/Three.js の意味論と area1-coral の実装・tone照合に基づく Grimoire 用開始値であり、一次資料の推奨値ではない。fog は camera depth と world height から解析的に濃度を求め、near/mid/far の3色を距離で補間する。全 world material と透明 particle で同じ関数を一度だけ呼び、独立した atmosphere pass や raymarch history bufferは持たない。scene scale または camera near/far が変わったら見かけを再校正する。

radial sample `i` の寄与は `weight * pow(decay, i) * pow(max(0, 1 - radialDistance), distanceAttenuation)` とする。つまり本実装の attenuation は `decay` と距離 exponent の積で明示し、Three.js `GodraysNode` の同名 property と自動的に同一実装だとはみなさない。

実装制約:

- light shaft emitter は最大 2。本物の shadow-casting light を増やさず emissive mask で形を作る。
- sun UV が viewport の guard band 外へ出たら god ray intensity を smoothstep で 0 にする。mobile で temporal history buffer は使わず、subpixel jitter と bilateral upsample を小さく使う。
- fog は各 world material で同じ解析関数を一度だけ評価する。god ray の遮蔽は専用 occlusion bufferを使い、fog の再合成や独立 atmosphere passを行わない。透明 particle にも同じ fog 関数を shader 内で一度だけ掛ける。
- particle は一つの instanced geometry / material、一つの atlas、bucket sort なし。近景粒子を画面中央へ過密化しない。
- bloom は emissive 1.15 以上だけ。text/UI chrome は composer 外に置き、bloom させない。

### 4.5 shared light contract

```ts
function applyEnvironmentToCreature(
  env: EnvironmentSnapshotV3,
  key: THREE.DirectionalLight,
  hemi: THREE.HemisphereLight,
  materials: readonly THREE.MeshStandardMaterial[]
) {
  key.position.fromArray(env.keyLight.directionWorld).multiplyScalar(-4);
  key.color.setRGB(...env.keyLight.colorLinear, THREE.LinearSRGBColorSpace);
  key.intensity = clamp(env.keyLight.intensity * 0.72, 0.45, 2.2);
  hemi.color.setRGB(...env.ambient.skyLinear, THREE.LinearSRGBColorSpace);
  hemi.groundColor.setRGB(...env.ambient.groundLinear, THREE.LinearSRGBColorSpace);
  hemi.intensity = clamp(env.ambient.intensity, 0.18, 0.52);
  for (const m of materials) {
    m.envMapIntensity = clamp(0.62 + env.exposure * 0.18, 0.68, 0.84);
    m.needsUpdate = false; // uniform/light changeで shader 再compile しない
  }
}
```

**[初期調整値]** 背景 key-light intensity の 72%、hemisphere 0.38、env-map 0.68–0.84 を生物側の開始値とする。共有するのは方向、linear color、相対 exposure、tone map ID だけ。shadow map、fog state、particle collision、背景 position は共有しない。UI halo は同じ light color を `OKLCH` で theme surface と混ぜ、contrast-safe な accent/border token 自体は置換しない。

### 4.6 R3F 実装境界

- R3F / drei は lifecycle と helper に使えるが、domain state を Three object へ置かない。
  https://github.com/pmndrs/react-three-fiber
  https://github.com/pmndrs/drei
- `useFrame` の subscription は Background 一つ、Creature 一つまでを原則とし、particle 個体ごとに React component / hook を作らない。
- canvas は一つ、scene/layer/camera pass を明示する。UI DOM overlay は別 compositing layer。
- resource は URL + variant key で cache し、area change 完了後に旧 resource を dispose。transition 中に毎 frame allocation しない。

### 4.7 area transition candidate

上位資料は area change 約 0.6 秒と reduced 即時を確定している一方、具体演出は未決定に残っている。次は上書きではなく候補である。

| 案 | full motion | reduced | 判断 |
|---|---|---|---|
| A | 600 ms cross-dissolve + fog veil、camera 固定 | 80 ms opacity | **推奨候補**。空間酔いが少ない |
| B | 600 ms lateral camera travel | 即時 | 固定カメラ方針と衝突、不採用 |
| C | portal burst + zoom | 80 ms flash | 主張が強く task flow を妨げる |

### 4.8 Spring Bone: VRM / Live2D 部位別 candidate

#### 調査

- **[外部仕様/事実]** VRM 1.0 SpringBone は joint ごとに `stiffness >= 0`、`dragForce` 0–1、`gravityPower`、normalized `gravityDir`、meter 単位の `hitRadius` を定義する。reference は Verlet integration を説明し、`center` は空間移動による余計な揺れの抑制に使える。
  https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_springBone-1.0/README.md
- **[外部仕様/事実]** three-vrm は VRM を Three.js 上で扱う reference library。VRM の推奨 update 順は expression / constraint / spring bone の依存を考慮する。
  https://github.com/pixiv/three-vrm/blob/dev/README.md?plain=1
  https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/README.md
- **[外部仕様/事実]** Live2D Cubism Physics は input、output、physics settings の組合せで揺れを設計し、高 fps では physics interpolation を扱う。VRM と同じ係数ではないため、数値の直接変換はしない。
  https://docs.live2d.com/en/cubism-editor-manual/physical-operation-setting/
  https://docs.live2d.com/4.2/en/cubism-editor-manual/physics-operation/
  https://docs.live2d.com/en/cubism-sdk-manual/compatibility-with-cubism-4-2/

#### 3 案

| 案 | 方針 | 見え方 | 推奨 |
|---|---|---|---|
| A | 全部位同一係数 | 均質、玩具的 | 不採用 |
| B | 耳 / 尻尾 / 毛先を別 profile、固定 step | 生物らしい位相差 | **推奨候補** |
| C | full rigid-body chain | 豊か | mobile cost、制御困難 |

#### 部位別初期値

```json
{
  "simulation": {
    "fixedHz": 60,
    "maxSubSteps": 2,
    "maxDeltaSec": 0.0333,
    "teleportResetDistanceM": 0.35,
    "sleepAngularVelocityRadSec": 0.012,
    "sleepAfterSec": 1.8
  },
  "vrmProfiles": {
    "ear": {
      "stiffness": 1.65,
      "dragForce": 0.38,
      "gravityPower": 0.08,
      "gravityDir": [0, -1, 0],
      "hitRadiusM": 0.012,
      "maxAngleDeg": 11
    },
    "tail": {
      "stiffness": 0.72,
      "dragForce": 0.24,
      "gravityPower": 0.22,
      "gravityDir": [0, -1, 0],
      "hitRadiusM": 0.028,
      "maxAngleDeg": 18
    },
    "hairTip": {
      "stiffness": 0.48,
      "dragForce": 0.46,
      "gravityPower": 0.12,
      "gravityDir": [0, -1, 0],
      "hitRadiusM": 0.008,
      "maxAngleDeg": 7
    }
  },
  "live2dResponseTargets": {
    "ear": { "settleMs": 420, "overshootPct": 6 },
    "tail": { "settleMs": 780, "overshootPct": 12 },
    "hairTip": { "settleMs": 520, "overshootPct": 5 }
  }
}
```

**[Decision Candidate / 初期調整値]** 値は VRM/Live2D の外部推奨ではなく、本アプリの model scale を 1 unit = 1 m とした calibration seed。実装時は profile 名から model の spring joint を明示 mapping し、missing bone を推測しない。VRM/Live2D の一致条件は係数一致ではなく、settle time / overshoot / max angle の見かけ一致とする。

- idle root motion の後に spring を fixed-step 更新し、render interpolation する。
- background frame drop の delta をそのまま入れず、`maxDeltaSec` と substep 上限を守る。
- reduced tier では physics Hz を 30、maxSubSteps 1。`prefers-reduced-motion` では spring と idle sway を停止し、rest pose へ 80 ms opacity なしで snap する。
- tap reaction は animation clip を先に再生し、spring は追随だけ。tail が UI button へ反応するなど背景/UI との物理連動を作らない。

---

## 5. マイクロインタラクション: press / rebound / glow

### 5.1 現状課題と調査

上位資料では tap reaction の library 構成と細部が未決定。押下が強すぎる `scale(0.96)` は小 icon をぶらし、すべてを spring にすると静かな Things 的感触を壊す。

- **[外部仕様/事実]** Motion の物理 spring は `stiffness / damping / mass` で設定し、既存 velocity を引き継げる。opacity のような値は tween を使い分けられる。
  https://motion.dev/docs/react-transitions
  https://motion.dev/docs/react
  https://motion.dev/docs/spring-value
- Apple の control/motion 指針は 3.2 の一次資料に従う。feedback は指の下で見え、brief で操作を block しないものとする。

### 5.2 主要判断: motion intensity の 3 案

| 案 | Press | 特色 | 判断 |
|---|---|---|---|
| A | scale 0.96 + 大きな overshoot | game 的 | task UI には強すぎる |
| B | scale 0.972 + y 2 px + 小 rebound | 触覚的で静か | **推奨候補** |
| C | 色変化のみ | 安全 | 通常時の手触り不足、reduced 用 |

### 5.3 exact Motion presets

```ts
export const motionPreset = {
  controlPress: {
    whileTap: { scale: 0.972, y: 2 },
    transition: { type: "spring", stiffness: 520, damping: 34, mass: 0.62 }
  },
  controlRelease: {
    animate: { scale: 1, y: 0 },
    transition: { type: "spring", stiffness: 420, damping: 24, mass: 0.72 }
  },
  navIndicator: {
    transition: { type: "spring", stiffness: 420, damping: 30, mass: 0.75 }
  },
  panel: {
    transition: { type: "spring", stiffness: 360, damping: 34, mass: 0.9 }
  },
  sheet: {
    transition: { type: "spring", stiffness: 300, damping: 32, mass: 1.0 }
  },
  glowFade: {
    duration: 0.42,
    ease: [0.16, 1, 0.3, 1]
  },
  reduced: {
    duration: 0.08,
    ease: "linear",
    spatialTransform: false
  }
} as const;
```

**[初期調整値]** press 開始は `pointerdown` と同じ animation frame。drag threshold 8 px を超えたら press を cancel。hold 420 ms で label tooltip を出すが、action は `pointerup` か keyboard `Enter/Space` で一回だけ実行する。double-tap を要求しない。

```tsx
const reduceMotion = useReducedMotion();
<motion.button
  aria-label={label}
  whileTap={reduceMotion ? { filter: "brightness(1.06)" } : { scale: 0.972, y: 2 }}
  transition={
    reduceMotion
      ? { duration: 0.08, ease: "linear" }
      : { type: "spring", stiffness: 520, damping: 34, mass: 0.62 }
  }
/>;
```

OS 設定は初回だけでなく実行中の変更にも追従する。reduced motion では Motion の JS transform も明示的に外し、CSS media query だけに依存しない。

### 5.4 glow と環境光同期

```css
.icon-control {
  --halo-rgb: 215 180 90; /* environment adapter が更新 */
  min-inline-size: 48px;
  min-block-size: 48px;
  border: 1px solid var(--border-strong);
  transform-origin: 50% 62%;
}
.icon-control[data-active="true"]::after {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: inherit;
  box-shadow:
    0 0 14px rgb(var(--halo-rgb) / .20),
    0 0 22px rgb(var(--halo-rgb) / .12);
  pointer-events: none;
  animation: halo-decay 420ms cubic-bezier(.16, 1, .3, 1) both;
}
@keyframes halo-decay {
  0%   { opacity: .34; transform: scale(.88); }
  52%  { opacity: .20; transform: scale(1.04); }
  100% { opacity: 0;   transform: scale(1.12); }
}
@media (prefers-reduced-motion: reduce) {
  .icon-control, .icon-control::after { animation-duration: 80ms; transform: none; }
}
```

**[採用判断]** halo は decorative で、状態の唯一の手掛かりにしない。linear light color を直接 CSS RGB にせず、sRGB へ変換後、lightness/chroma を theme ごとに clamp する。halo の最大 alpha .34、blur 22 px、視覚半径 28 px を開始値とする。focus ring は halo より前面に描画し、contrast 3:1 を維持する。

### 5.5 因果と連打抑止

| 原因 | 即時 feedback | commit 後 | 再実行防止 |
|---|---|---|---|
| task checkbox pointerdown | press + 20 ms cue | status、reward、growth | commandId in-flight disable |
| save success | rebound | live region + subtle halo | outbox eventId |
| save failure | control returns | inline error、reward 無し | draft 維持 |
| long press nav | press | tooltip only | 420 ms threshold / once |

button を固定 420 ms disable するのではなく、同じ command が in-flight の間だけ disable する。animation duration を業務処理の lock に使わない。

---

## 6. Acoustic / adaptive BGM / SFX

### 6.1 現状課題と外部調査

上位資料は静かな adaptive soundscape と visual/audio/haptic の一対一対応を確定しているが、bus、EQ、音量、crossfade、polyphony、autoplay / silent mode の境界が未定義である。

- **[外部仕様/事実]** Web Audio は `AudioNode` graph、sample-accurate scheduling、`GainNode`、`BiquadFilterNode`、`DynamicsCompressorNode` を定義する。
  https://www.w3.org/TR/webaudio-1.0/
- **[外部仕様/事実]** Apple は app 内で相対レベルを調整し、system volume を置換しないこと、不要音は silent 状態を尊重すること、essential information を音だけで伝えないことを示している。haptic は原因との明確な関係、強度の一致、過剰使用回避が重要である。
  https://developer.apple.com/design/human-interface-guidelines/playing-audio
  https://developer.apple.com/design/human-interface-guidelines/accessibility/
  https://developer.apple.com/design/human-interface-guidelines/playing-haptics
- **[外部仕様/事実]** EBU R128 / ITU-R BS.1770 は loudness / true-peak 測定の基準を提供する。R128 の -23 LUFS は broadcast programme の基準であり、短い UI cue の直接 target ではない。
  https://tech.ebu.ch/loudness
  https://tech.ebu.ch/fr/publications/r128
  https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/en

### 6.2 主要判断: adaptive 構成の 3 案

| 案 | 構成 | 長所 | リスク | 推奨 |
|---|---|---|---|---|
| A | area ごとに単一 loop を停止/再生 | 容量小 | seam、状態変化が粗い | 不採用 |
| B | 位相同期した 3 stem + equal-power crossfade | 滑らか、静かな変化 | asset 制作と同期管理 | **推奨候補** |
| C | generative synth 全面 | 容量最小 | timbre 品質、端末差、QA | 実験のみ |

### 6.3 graph と exact 初期値

```text
music stems ─▶ music EQ ─▶ music gain ─┐
ambience    ─▶ amb EQ   ─▶ amb gain   ├─▶ master compressor ─▶ true-peak limiter ─▶ master gain ─▶ destination
UI / reward ─▶ sfx EQ   ─▶ sfx gain   ┘                          (AudioWorklet, lookahead)
```

```json
{
  "authoring": {
    "musicStemLufsI": -23,
    "ambienceLufsI": -27,
    "uiCuePeakDbfsMax": -14,
    "rewardCuePeakDbfsMax": -12,
    "masterTruePeakDbtpMax": -1
  },
  "busesDb": { "music": -3, "ambience": -4, "sfx": -3 },
  "eq": {
    "music": [
      { "type": "highpass", "frequencyHz": 35, "Q": 0.71 },
      { "type": "peaking", "frequencyHz": 2400, "Q": 1.0, "gainDbDuringUi": -1.5 }
    ],
    "ambience": [
      { "type": "highpass", "frequencyHz": 60, "Q": 0.71 },
      { "type": "lowpass", "frequencyHz": 12000, "Q": 0.71 }
    ],
    "sfx": [
      { "type": "highpass", "frequencyHz": 120, "Q": 0.71 }
    ]
  },
  "compressor": {
    "thresholdDb": -10,
    "kneeDb": 6,
    "ratio": 3,
    "attackSec": 0.003,
    "releaseSec": 0.15
  },
  "limiter": {
    "ceilingDbtp": -1,
    "lookaheadMs": 5,
    "releaseMs": 80,
    "oversample": 4
  },
  "ducking": {
    "musicGainDb": -3,
    "attackMs": 20,
    "releaseMs": 250
  },
  "fadesMs": {
    "areaEqualPower": 1200,
    "homeSettings": 600,
    "resume": 250,
    "stopTail": 180
  },
  "polyphony": {
    "ui": 6,
    "creature": 4,
    "ambience": 2,
    "reward": 1,
    "sameCueMinimumIntervalMs": 50
  },
  "stems": {
    "idle": [0.32, 0.08, 0.00],
    "observe": [0.32, 0.18, 0.08],
    "bond": [0.30, 0.22, 0.18],
    "rewardReturnMs": 1400
  }
}
```

**[初期調整値]** LUFS / dB、limiterの5 ms lookahead / 80 ms release / 4× oversampleは QA の開始値であり、Web AudioやBS.1770が規定する製品必須値ではない。`DynamicsCompressorNode`単体をtrue-peak limiterとみなさず、本番のAudioWorklet limiterを通した最大polyphony最終mixをoffline renderし、BS.1770 meterで -1 dBTP以下を確認する。music stemは -23 ± 1 LUFS-I、ambienceは -27 ± 1 LUFS-I、short cueは個別peakとlistening testで検査し、最終mixのtrue-peakと混同しない。master gain を上げて system volume を代替しない。cheap phone speaker、wired headphone、Bluetooth、silent/off で確認する。

### 6.4 scheduling / equal-power fade

```ts
function equalPowerCrossfade(a: GainNode, b: GainNode, at: number, sec = 1.2) {
  const n = 32;
  const aCurve = new Float32Array(n);
  const bCurve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    aCurve[i] = Math.cos(t * Math.PI * 0.5);
    bCurve[i] = Math.sin(t * Math.PI * 0.5);
  }
  a.gain.cancelScheduledValues(at);
  b.gain.cancelScheduledValues(at);
  a.gain.setValueCurveAtTime(aCurve, at, sec);
  b.gain.setValueCurveAtTime(bCurve, at, sec);
}

function scheduleCue(buffer: AudioBuffer, when: number, destination: AudioNode) {
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(destination);
  source.start(Math.max(when, audioContext.currentTime + 0.006));
}
```

- 3 stem は同一 sample rate / bar length / zero-crossing loop point で authoring し、同じ `AudioContext.currentTime` から開始する。状態変更は individual source を restart せず gain を変える。
- `AudioContext.resume()` は最初の明示的 user gesture 後だけ。自動再生を前提にしない。resume 前の古い interaction cue は queue 再生せず破棄する。
- UI cue と visual press は同じ `pointerdown` timestamp を共有する。reward cue と creature reaction は optimistic click ではなく、consumer claim時にpresentation orchestratorが発行した同じ`presentationId` / `presentationAt`と50 ms lookaheadを共有する。`committedAt`はstaleness判定専用とする。
- polyphony 超過時は同 cue の最古・最小 gain voice を 20 ms fade-out して steal。reward voice は UI cue に奪わせない。
- screen hidden で BGM を 250 ms fade、復帰後 user preference が on のとき 250 ms で戻す。

### 6.5 視覚・音・触覚の一対一 matrix

| Event | Visual | SFX | Haptic | 条件 |
|---|---|---|---|---|
| control press | 2 px / 0.972 press | soft tick | light | input enabled |
| task save commit | status settle | paper/stone confirm | light | commit 成功後 |
| first completion | halo + creature reaction | reward one-shot | success pattern 1 回 | ledger 初回だけ |
| error | inline text + icon | low dry cue | error pattern 1 回 | 音/触覚 off 可 |
| area change | fog dissolve | 1.2 s equal-power ambience | なし | full motion only |

同一原因へ sparkle、click、chime、vibration を時間差で何度も足さない。audio off、silent、`vibrate` 非対応でも visual/text だけで意味が完結する。Reduce Motion は音量設定を変更しない。

---

## 7. Acceptance / Test Matrix

### 7.1 機能・整合性

| ID | Test | 合格条件 | 方法 |
|---|---|---|---|
| ARC-01 | forbidden imports | Background↔Creature、UI→DB adapter の直接 import 0 | ESLint boundaries + dependency graph |
| ARC-02 | snapshot immutability | consumer の mutation が typecheck / runtime dev guard で失敗 | unit |
| ARC-03 | task text isolation | creature event / log / telemetry に title/body 0 | schema test + payload snapshot |
| ARC-04 | short-lived UI state | nav/sheet/selected-day が IndexedDB export に含まれない | integration |
| ARC-05 | light-only coupling | creatureが読むscene fieldはV3 allow-list（keyLight 4 + ambient 3 + exposure/toneMap/qualityTier = 10）だけ | contract test |
| ARC-06 | schema incompatibility | unknown major schema は黙って解釈せず fallback | unit |
| ARC-07 | environment V2→V3 | 試作`version: 2`をbootstrap adapterだけが読み、normalized/linear変換済み`schema: 3`を公開。全nested tupleがcopy+freezeされmutation不能。zero/NaN direction、範囲外hex/intensity/temperature/exposureを拒否。V2直接consumer 0 | contract fixture + mutation/type/dependency test |
| DAT-01 | first completion once | complete→open→complete で reward/growth row 各 1 | real IndexedDB integration |
| DAT-02 | rollback | transaction 中の任意 table failure で task/reward/growth/outbox 全て未変更 | fault injection |
| DAT-03 | publish after commit | commit 前の visual/audio/creature side effect 0 | fake clock + integration |
| DAT-04 | crash after commit | 再起動で pending outbox を再送、ledger 重複 0 | browser reload E2E |
| DAT-05 | task delete | task 削除後も earned ledger/growth 維持 | integration |
| DAT-06 | migration idempotency | 同一snapshotを3回実行して同じrunId/resultを再利用しtask重複0。failed retryも同じrunId、native予約prefix/正規化key衝突は上書きせず拒否/quarantine | E2E |
| DAT-07 | migration failure | 50% row 時点で fault、migrated task 0、snapshot/legacy DB 維持 | fault injection |
| DAT-08 | multi-tab versionchange | tab を閉じる案内、data loss / forced delete 0 | 2-context E2E |
| DAT-09 | multi-tab outbox lease | 2 tab同時pumpで有効lease中の同一event/consumer実行は1、crash後は期限切れleaseを回収 | 2-context + fake clock E2E |
| DAT-10 | migration activation | 検証失敗時active task 0、activation fault時copy/statusともrollback、旧DB/snapshot維持 | real IndexedDB fault injection |
| DAT-11 | command crash-after-commit retry | createTask commit直後・応答前にcrashし、同じcommandId/payloadHashで再実行してtask/outbox/receipt各1、同じresult。payload不一致は拒否 | real IndexedDB + browser reload E2E |

### 7.2 Visual / performance / physics

**物理端末の共通手順。** 同一 release build を使い、端末名、OS build、Chrome version、選択refresh rate、battery残量、充電接続、室温、開始/終了thermal stateを記録する。充電器を外し、battery 40–80%、室温20–25°C、画面輝度50%、network idle、DevTools未接続で、端末・refresh設定ごとに60秒を5 run行う。各runの先頭4秒warmupは集計から除外し、p20/p5 FPS、100ms超frame stall数、tier transition時刻、primary calls/triangles、post-pass、context lossを保存する。初回をcold、後続をwarmとして結果を分け、平均だけで不合格runを隠さない。

| ID | Test | 合格条件 | 方法 |
|---|---|---|---|
| PERF-01 | Pixel 7a auto 60 s × 5 | forced tierなしでfull/reducedのいずれかへ自然settle。fullならp20 ≥ 55/p5 ≥ 48、reducedならp20 ≥ 48/p5 ≥ 42。primary scene calls ≤ tier budget、triangles ≤153,000、100ms超stall/context loss 0、tier change ≤1/run | Chrome物理端末、共通手順 |
| PERF-02 | Pixel 7a stress | FPS / primary calls / `primarySceneTriangles > 153,000` / post pass のいずれかが2.5 s継続後reduced、次の15 s cooldown中の反転0、reduced p20 ≥48/p5 ≥42へ回復 | scene / particle / post stress toggle、5 run |
| PERF-03 | Xiaomi 14T Pro auto 60 s × 5 | native refresh描画を維持し60 fps floor、p20 ≥57/p5 ≥55、100ms超stall/context loss 0、tier change ≤1/run | Chrome物理端末、60/144 Hz設定を別記録 |
| PERF-04 | hysteresis | 48–57 fps 境界で 60 s 中 tier change ≤ 1 | synthetic load |
| PERF-05 | manual tier | session 中の自動 tier change 0 | E2E |
| PERF-06 | background tab | hidden frames を sample へ混入しない | Playwright visibility |
| PERF-07 | reduced budget | primary scene calls ≤ 38、visible world geometry triangles ≤ 100k、passes ≤ 8。renderer total calls/trianglesは記録のみ | renderer counters + geometry traversal |
| PERF-08 | failure fallback | context loss、またはauto+reducedでwarmup/minimum sample後のp20 < 40が3.0 s継続するとrenderer停止、生成poster（任意video優先）を表示しHTML操作を維持。2.9 sでは未発火 | forced context loss + fake clock + browser E2E |
| PERF-09 | T008 triangle tolerance | visible `area.group` = 152,490でtriangle downgrade predicateが`false`。sky/全passの`rendererTotalTriangles`の大小は結果を変えない | controller unit + geometry traversal + T008 scene fixture |
| VFX-01 | single tone map | gray ramp / HDR chart に二重 ACES の shoulder なし | pixel-diff |
| VFX-02 | god ray edge | sun UV を全辺外へ移動して flash/band なし | capture grid |
| VFX-03 | fog depth | 前景 creature silhouette の fog 二重掛けなし | reference image diff |
| VFX-04 | particle overdraw | coverage ≤ 3.5%、1 instanced draw、UI 可読 | GPU capture |
| VFX-05 | bloom isolation | UI/text luminance が bloom on/off で不変 | pixel sample |
| VFX-06 | shared light | 背景/生物 key direction 差 ≤ 3°、white point ΔE00 ≤ 5 | render chart |
| PHY-01 | ear response | settle 420 ± 80 ms、overshoot ≤ 8%、angle ≤ 11° | recorded impulse |
| PHY-02 | tail response | settle 780 ± 120 ms、overshoot ≤ 15%、angle ≤ 18° | recorded impulse |
| PHY-03 | hair response | settle 520 ± 100 ms、overshoot ≤ 7%、angle ≤ 7° | recorded impulse |
| PHY-04 | frame spike | 100 ms spike 後 NaN / explosion / penetration 0 | injected delta |
| PHY-05 | reduced physics | 30 Hz で phase jump > 3° なし | frame analysis |
| PHY-06 | reduced motion | idle/spring 0、rest pose、音設定不変 | OS setting E2E |

**[初期調整値]** PERF-01–03 の p20/p5/stall/tier 閾値は出荷 gate 候補で、現時点の達成事実ではない。上記の物理端末共通手順を満たした各runへ個別に合否を付ける。

### 7.3 UI / accessibility / audio

| ID | Test | 合格条件 | 方法 |
|---|---|---|---|
| UI-01 | progressive disclosure | collapsed row に title/status、detail 展開で scroll anchor ±4 px | E2E |
| UI-02 | expression switch | semantic role / DOM order / accessible name 不変 | token snapshot |
| UI-03 | light token contrast | normal text ≥ 4.5:1、UI boundary ≥ 3:1 | axe + pixel sampling |
| UI-04 | dark token contrast | normal text ≥ 4.5:1、UI boundary ≥ 3:1 | axe + pixel sampling |
| UI-05 | composited surface | texture/video 上の全 text が最終 pixel で AA | screenshot sampler |
| UI-06 | on-accent contrast | light/darkとも`onAccent × accent`が4.5:1以上、他のtext tokenをaccent面へ流用0 | token CI + screenshot sampler |
| A11Y-01 | target size | interactive target 48×48 CSS px 以上 | DOM geometry test |
| A11Y-02 | keyboard | 全 flow が keyboard のみで完了、focus lost 0 | E2E |
| A11Y-03 | icon name | icon-only control の accessible name 空 0 | axe |
| A11Y-04 | sheet focus | open trap / Escape / return focus 全成立 | E2E |
| A11Y-05 | zoom/reflow | 320 CSS px / 200% で page 横 scroll 0 | browser matrix |
| A11Y-06 | non-color meaning | task/reward/error が grayscale でも識別可能 | visual review |
| A11Y-07 | announcement | commit 成功ごとに live message 1、失敗で reward message 0 | screen reader log |
| A11Y-08 | reduced motion | spatial transform/parallax/burst 0、80 ms 以下の代替 | computed animation audit |
| MOT-01 | press latency | pointerdown→visual first frame ≤ 50 ms | 240 fps capture |
| MOT-02 | press geometry | peak scale .972 ± .003、y 2 ± .5 px | frame analysis |
| MOT-03 | rebound | settle ≤ 380 ms、overshoot scale ≤ 1.012 | frame analysis |
| MOT-04 | cancelled drag | 8 px 超で action / cue / reward 0 | pointer E2E |
| MOT-05 | glow | max alpha ≤ .34、fade 420 ± 40 ms、focus ring 可視 | pixel/time analysis |
| MOT-06 | in-flight | 同一 command の重複 dispatch 0 | rapid 20 tap test |
| MOT-07 | save failure | press は戻る、draft 維持、halo/reward 0 | fault injection |
| AUD-01 | user gesture | gesture 前 `AudioContext` resume / audible output 0 | browser E2E |
| AUD-02 | sync | press visual と SFX onset 差 ≤ 30 ms、reward visual/SFX ≤ 45 ms。2 s遅延したoutbox replayでも過去schedule / 即時連打 0 | high-speed A/V capture + fake clock |
| AUD-03 | loudness / true peak | music stem -23 ± 1 LUFS-I、ambience -27 ± 1 LUFS-I、UI cue ≤ -14 dBFS peak、reward cue ≤ -12 dBFS peak。最大polyphony最終mix ≤ -1 dBTP | BS.1770 meter + 本番limiterを通すoffline render |
| AUD-04 | equal-power fade | area fade 中の合成 gain dip/peak ≤ 1.5 dB | offline render |
| AUD-05 | polyphony | bus ごとの上限超過 0、voice steal click 0 | stress render |
| AUD-06 | ducking | SFX 時 music -3 ± .5 dB、attack/release 許容 ±20% | offline render |
| AUD-07 | phase sync | 3 stem loop seam / drift 1 sample 超 0 | sample comparison |
| AUD-08 | silent/off | essential status 欠落 0、audio node leak 0 | E2E + graph inspect |
| AUD-09 | reduced motion | audio preference / bus gain が変更されない | setting E2E |

---

## 8. Decision Candidates と未決定リスク

本節は `Grimoire_決定事項ログ.md` の O 項目を上書きしない。採用時に別途 decision log へ人間が記録する。

| Candidate | 推奨候補 | まだ必要な証拠 / 決定者 |
|---|---|---|
| DC-01 transaction/event | durable outbox + consumer 冪等性 | 実ブラウザ crash / multi-tab test、engineering |
| DC-02 quality governor | runtime telemetry + hysteresis | Pixel 7a / Xiaomi 14T Pro 物理端末各 5 run |
| DC-03 nav naming | icon-only + aria-label + 初回 visible label | usability / screen-reader test、product/design |
| DC-04 area transition | 600 ms fog cross-dissolve | motion sickness / visual review、design |
| DC-05 spring profiles | ear/tail/hair 3 profile | 最終 VRM/Live2D rig と実寸、character art |
| DC-06 tap preset | scale .972 + y 2 px + restrained rebound | 240 fps capture と触感 review、design |
| DC-07 VFX live path | radial rays + fog + instanced particles | 実機 GPU capture と最終 scene asset |
| DC-08 adaptive audio | phase-locked 3 stem | final mastered assets、Bluetooth latency test、audio |
| DC-09 desktop raymarch fog | 現行では不採用、解析fogとのA/B実験だけ許可 | desktop GPU capture、post-pass budget、design/engineering |

残る主要リスク:

1. Spring の最適値は bone length、model scale、collider、animation amplitude に依存する。最終 rig 前には確定できない。
2. God rays/fog の値は camera near/far、world scale、HDR range に依存する。reference scene 固定後に再 calibration が必要。
3. Pixel 7a / Xiaomi 14T Pro の目標値は acceptance target であり、達成済みの測定結果ではない。thermal / browser version も記録する。
4. Web Audio の haptic 同期は browser / OS / Bluetooth で遅延差がある。`currentTime` で audio 内同期はできても actuator latency は端末別に測る必要がある。
5. icon-only UI の見た目は確定済みでも、初見理解は未検証。accessible name は必須とし、visible label の扱いだけを product decision に残す。
6. 旧 DB の実 schema と破損パターンが未確認なら、migration field map と quarantine rule は fixture 取得後に確定する。

## 9. 実装開始の Definition of Ready

- 本書の DC-01–09 について採用 / 却下 / 実験を decision log に記録した。
- 最終 VRM または Live2D rig、world unit、camera near/far、HDR reference frame が固定された。
- 旧 `TaskManagerDB` の匿名化 fixture を正常 / 欠損 / 重複 / 異常 timestamp の 4 種で用意した。
- Pixel 7a / Xiaomi 14T Pro の物理端末 test 手順と同一 production build を用意した。
- audio stem が同じ sample rate / loop length で export され、BS.1770 meter と Bluetooth test route を用意した。
- acceptance matrix の自動化範囲と、人間による visual/audio review の担当を決めた。

以上を満たすまで、各 **[初期調整値]** は「外部に裏付けられた確定値」ではなく、測定可能な仮説として扱う。

## 10. 出典 URL 索引

根拠は各主張の直後にも記載している。ここは追跡用の重複索引であり、外部事実と本製品の **[初期調整値]** を混同する根拠にはしない。

### Architecture / storage

- Redux Style Guide: https://redux.js.org/style-guide/
- Redux one-way data flow: https://redux.js.org/tutorials/fundamentals/part-2-concepts-data-flow
- W3C Indexed Database API 3.0: https://www.w3.org/TR/IndexedDB/
- Dexie Transaction: https://dexie.org/docs/Transaction/Transaction
- Dexie transaction method: https://dexie.org/docs/Dexie/Dexie.transaction%28%29
- Dexie `storagemutated`: https://dexie.org/docs/Dexie/Dexie.on.storagemutated
- Dexie `liveQuery`: https://dexie.org/docs/liveQuery%28%29

### Device / rendering / VFX

- Three.js WebGLRenderer: https://threejs.org/docs/pages/WebGLRenderer.html
- `detect-gpu`: https://github.com/pmndrs/detect-gpu
- Pixel 7a hardware: https://support.google.com/pixelphone/answer/7158570?hl=en
- Xiaomi 14T Pro display (JP): https://www.mi.com/jp/support/faq/details/KA-491244/
- Xiaomi 14T Pro refresh rate (UK): https://www.mi.com/uk/support/faq/details/KA-507160/
- GPU Gems 3, Chapter 13: https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process
- Three.js god rays example: https://threejs.org/examples/webgl_postprocessing_godrays.html
- Three.js GodraysNode: https://threejs.org/docs/pages/GodraysNode.html
- Three.js custom fog scattering example: https://threejs.org/examples/webgpu_custom_fog_scattering.html
- Three.js height fog example: https://threejs.org/examples/webgpu_fog_height.html
- pmndrs postprocessing: https://github.com/pmndrs/postprocessing
- Effect merging: https://github.com/pmndrs/postprocessing/wiki/Effect-Merging
- Three.js InstancedMesh: https://threejs.org/docs/pages/InstancedMesh.html
- Three.js object optimization manual: https://threejs.org/manual/en/optimize-lots-of-objects.html
- wawa-vfx: https://github.com/wass08/wawa-vfx
- React Three Fiber: https://github.com/pmndrs/react-three-fiber
- drei: https://github.com/pmndrs/drei
- Shadertoy visual study A: https://www.shadertoy.com/view/XtBXDy
- Shadertoy visual study B: https://www.shadertoy.com/view/ldlcRf

### Creature physics

- VRMC SpringBone 1.0: https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_springBone-1.0/README.md
- three-vrm: https://github.com/pixiv/three-vrm/blob/dev/README.md?plain=1
- VRMC_vrm 1.0: https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/README.md
- Live2D physical operation settings: https://docs.live2d.com/en/cubism-editor-manual/physical-operation-setting/
- Live2D physics operation: https://docs.live2d.com/4.2/en/cubism-editor-manual/physics-operation/
- Live2D Cubism 4.2 compatibility / interpolation: https://docs.live2d.com/en/cubism-sdk-manual/compatibility-with-cubism-4-2/

### UI / motion / accessibility / art direction

- Things features: https://culturedcode.com/things/features/
- Things product page: https://culturedcode.com/things/
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WCAG non-text contrast: https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html
- WCAG technique G207: https://www.w3.org/WAI/WCAG22/Techniques/general/G207
- Apple motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Apple Reduce Motion evaluation: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria
- Apple game controls: https://developer.apple.com/design/human-interface-guidelines/game-controls
- Motion transitions: https://motion.dev/docs/react-transitions
- Motion for React: https://motion.dev/docs/react
- Motion spring value: https://motion.dev/docs/spring-value
- Capcom developer interview: https://www.capcom.co.jp/ir/english/interview/2017/vol02.html
- Capcom Monster Hunter: World creator voice: https://www.capcom.co.jp/ir/english/feature/2017_mh_crvoice.html
- Elden Ring official: https://www.bandainamcoent.com/games/elden-ring
- Monument Valley launch retrospective: https://ustwo.com/blog/monument-valley-out-now/
- Monument Valley case study: https://ustwo.com/work/monument-valley/

### Audio

- W3C Web Audio API: https://www.w3.org/TR/webaudio-1.0/
- Apple playing audio: https://developer.apple.com/design/human-interface-guidelines/playing-audio
- Apple accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility/
- Apple playing haptics: https://developer.apple.com/design/human-interface-guidelines/playing-haptics
- EBU loudness: https://tech.ebu.ch/loudness
- EBU R128: https://tech.ebu.ch/fr/publications/r128
- ITU-R BS.1770-5: https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/en
