export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type CommandId = Brand<string, "CommandId">;
export type EventId = Brand<string, "EventId">;
export type TaskId = Brand<string, "TaskId">;
export type SeriesId = Brand<string, "SeriesId">;
export type OccurrenceKey = Brand<string, "OccurrenceKey">;
export type IsoInstant = Brand<string, "IsoInstant">;
export type LocalDate = Brand<string, "LocalDate">;
export type LocalTime = Brand<string, "LocalTime">;
export type IanaTimeZone = Brand<string, "IanaTimeZone">;
export type PayloadHash = Brand<string, "PayloadHash">;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

function validatedId<Name extends string>(
  value: string,
  name: Name,
  maximumLength = 128,
): Brand<string, Name> {
  if (!ID_PATTERN.test(value) || value.length > maximumLength) {
    throw new RangeError(`${name} is invalid`);
  }
  return value as Brand<string, Name>;
}

export const commandId = (value: string): CommandId => validatedId(value, "CommandId");
export const eventId = (value: string): EventId => validatedId(value, "EventId", 256);
export const taskId = (value: string): TaskId => validatedId(value, "TaskId");
export const seriesId = (value: string): SeriesId => validatedId(value, "SeriesId");

export function isoInstant(value: string): IsoInstant {
  const timestamp = Date.parse(value);
  const normalized = value.endsWith("Z") && !value.includes(".")
    ? `${value.slice(0, -1)}.000Z`
    : value;
  if (
    !ISO_INSTANT_PATTERN.test(value) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== normalized
  ) {
    throw new RangeError("IsoInstant is invalid");
  }
  return value as IsoInstant;
}

export function localDate(value: string): LocalDate {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) throw new RangeError("LocalDate is invalid");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("LocalDate is invalid");
  }
  return value as LocalDate;
}

export function localTime(value: string): LocalTime {
  if (!LOCAL_TIME_PATTERN.test(value)) throw new RangeError("LocalTime is invalid");
  return value as LocalTime;
}

export function ianaTimeZone(value: string): IanaTimeZone {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
  } catch {
    throw new RangeError("IanaTimeZone is invalid");
  }
  return value as IanaTimeZone;
}

export function payloadHash(value: string): PayloadHash {
  if (!SHA256_PATTERN.test(value)) throw new RangeError("PayloadHash must be SHA-256 hex");
  return value as PayloadHash;
}

export function occurrenceKey(value: string): OccurrenceKey {
  if (value.length === 0 || value.length > 512) throw new RangeError("OccurrenceKey is invalid");
  return value as OccurrenceKey;
}
