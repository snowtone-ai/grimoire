import { describe, expect, it } from "vitest";
import {
  buildGmailExtractionPrompt,
  buildTaskParsePrompt,
  sanitizeGmailMessages,
} from "../../../../src/integrations/gemini/prompts";

describe("buildTaskParsePrompt", () => {
  it("embeds the voice text and today's date verbatim", () => {
    const prompt = buildTaskParsePrompt("明日 ES を出す", "2026-08-19");
    expect(prompt).toContain("2026-08-19");
    expect(prompt).toContain("明日 ES を出す");
  });
});

describe("sanitizeGmailMessages", () => {
  it("collapses whitespace and bounds each field's length so the prompt stays size-bounded", () => {
    const [sanitized] = sanitizeGmailMessages([
      { subject: "件名".repeat(200), from: "from".repeat(200), snippet: "本文".repeat(200) },
    ]);

    expect(sanitized).toBeDefined();
    expect(sanitized?.subject.length).toBeLessThanOrEqual(160);
    expect(sanitized?.from.length).toBeLessThanOrEqual(120);
    expect(sanitized?.snippet.length).toBeLessThanOrEqual(200);
  });

  it("assigns a stable index per message in input order", () => {
    const sanitized = sanitizeGmailMessages([
      { subject: "A", from: "a@example.com", snippet: "" },
      { subject: "B", from: "b@example.com", snippet: "" },
    ]);
    expect(sanitized.map((m) => m.index)).toEqual([0, 1]);
  });

  it("collapses internal newlines and repeated whitespace to single spaces", () => {
    const [sanitized] = sanitizeGmailMessages([
      { subject: "件名\n\n  本文", from: "a@example.com", snippet: "" },
    ]);
    expect(sanitized?.subject).toBe("件名 本文");
  });
});

describe("buildGmailExtractionPrompt", () => {
  it("embeds the sanitized message list as JSON", () => {
    const prompt = buildGmailExtractionPrompt([
      { subject: "ES締切", from: "hr@example.com", snippet: "8/20までに提出" },
    ]);
    expect(prompt).toContain('"subject": "ES締切"');
    expect(prompt).toContain('"from": "hr@example.com"');
  });

  it("returns valid instructions even for an empty message list", () => {
    const prompt = buildGmailExtractionPrompt([]);
    expect(prompt).toContain("[]");
  });
});
