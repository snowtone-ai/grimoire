/**
 * The observation journal's record list (決定事項ログ M-11 / M-12).
 *
 * Unlike the item catalog, this is not a collection to complete: an unseen
 * record stays visible as a silhouette, and no total or percentage is ever
 * shown. Records are added by simply spending time on the Grimo screen — never
 * by a quota, a streak, or a reason to come back.
 *
 * Stages follow J (four per lineage) and the dog/water lineage's visual spec in
 * L-2. Gestures are limited to E-4's upper-body set, which is what the first
 * rig will actually be able to play.
 */
export type CreatureRecordKind = 'gesture' | 'stage'

export interface CreatureRecordDefinition {
  readonly id: string
  readonly kind: CreatureRecordKind
  readonly name: string
  /** Field-journal note shown once the record has been observed. */
  readonly note: string
}

export const CREATURE_RECORDS: readonly CreatureRecordDefinition[] = Object.freeze([
  Object.freeze({
    id: 'stage-egg',
    kind: 'stage',
    name: '卵',
    note: '氷とも水晶ともつかない半透明の殻。中で淡い水色がゆっくり揺れている。ときおり殻が小さく動く。',
  }),
  Object.freeze({
    id: 'stage-hatchling',
    kind: 'stage',
    name: '幼体',
    note: 'まん丸でやわらかい。耳と尻尾の先だけがヒレのような形をしていて、歩くと足元にごく小さな波紋が立つ。',
  }),
  Object.freeze({
    id: 'stage-juvenile',
    kind: 'stage',
    name: '子供',
    note: '丸みを残したまま背が伸びはじめる。背から尻尾へ、水色のグラデーションが少しずつ定着していく。',
  }),
  Object.freeze({
    id: 'stage-adult',
    kind: 'stage',
    name: '成体',
    note: '面長でしなやかな体躯。全身が水色から青へ流れるように染まり、尻尾はやや垂れて落ち着いている。',
  }),
  Object.freeze({
    id: 'gesture-breath',
    kind: 'gesture',
    name: '呼吸',
    note: '何もしていない時の、ゆっくりとした上下。見ていると、こちらの息もつられて遅くなる。',
  }),
  Object.freeze({
    id: 'gesture-ear-flick',
    kind: 'gesture',
    name: '耳をふるわせる',
    note: '触れた指から逃げるように、片方の耳だけが短く跳ねる。すぐ元の位置へ戻る。',
  }),
  Object.freeze({
    id: 'gesture-gaze',
    kind: 'gesture',
    name: '視線を巡らせる',
    note: '呼ばれてもいないのに、ふと遠くを見る。何を見ているのかは分からない。',
  }),
  Object.freeze({
    id: 'gesture-yawn',
    kind: 'gesture',
    name: 'あくび',
    note: '前触れなく大きく口を開け、そのまま何事もなかったように戻る。',
  }),
  Object.freeze({
    id: 'gesture-blink',
    kind: 'gesture',
    name: 'まばたき',
    note: '一定の間隔ではなく、時々二度続けて閉じる。そこだけ生き物の時間が流れている。',
  }),
])

export const CREATURE_RECORDS_BY_ID: ReadonlyMap<string, CreatureRecordDefinition> =
  new Map(CREATURE_RECORDS.map((record) => [record.id, record]))
