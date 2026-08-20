import type { EventId, IsoInstant, OccurrenceKey, TaskId } from "./primitives";

interface EventBase {
  readonly schemaVersion: 1;
  readonly eventId: EventId;
  readonly taskId: TaskId;
  readonly committedAt: IsoInstant;
}

export type CommittedDomainEvent =
  | (EventBase & Readonly<{ type: "taskCreated" }>)
  | (EventBase &
      Readonly<{
        type: "taskOccurrenceCompleted";
        occurrenceKey: OccurrenceKey;
      }>)
  | (EventBase &
      Readonly<{
        type: "taskCompletedFirstTime";
        occurrenceKey: OccurrenceKey;
        aggregate: Readonly<{ completionCountDelta: 1 }>;
      }>)
  | (EventBase &
      Readonly<{
        type: "taskOccurrenceReopened";
        occurrenceKey: OccurrenceKey;
      }>);
