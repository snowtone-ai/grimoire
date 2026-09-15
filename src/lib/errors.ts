const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{20,}/g,
  /sk-[a-zA-Z0-9_-]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  /(password|token|secret|key|authorization)["':=\s]+["']?[^"'\s,}]{8,}/gi,
];

export class RateLimitError extends Error {
  constructor() {
    super("Gemini API rate limit reached");
    this.name = "RateLimitError";
  }
}

export function redactSecret(value: unknown): string {
  let text = value instanceof Error ? value.message : String(value);
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern, "[REDACTED]");
  }
  return text;
}
