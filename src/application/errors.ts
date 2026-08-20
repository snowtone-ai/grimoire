export type ApplicationErrorCode =
  | "COMMAND_HASH_INVALID"
  | "COMMAND_ID_REUSED_WITH_DIFFERENT_PAYLOAD"
  | "CONSTRAINT"
  | "CORRUPT_IMPORT"
  | "TASK_NOT_FOUND"
  | "UNKNOWN_SCHEMA";

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;

  constructor(code: ApplicationErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApplicationError";
    this.code = code;
  }
}
