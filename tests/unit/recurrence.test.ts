import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  makeOccurrenceKey,
  monthlyRecurrence,
  nextOccurrenceDate,
  occurrenceDates,
  yearlyRecurrence,
} from "../../src/domain/recurrence";
import {
  ianaTimeZone,
  localDate,
  localTime,
  seriesId,
} from "../../src/domain/primitives";
import { validateRecurrenceRule, type RecurrenceRule } from "../../src/domain/tasks";

describe("recurrence", () => {
  it("preserves local wall-clock keys through a DST boundary", () => {
    const dates = occurrenceDates(
      localDate("2026-03-07"),
      { frequency: "daily", interval: 1 },
      3,
    );
    const schedule = {
      localTime: localTime("09:00"),
      timeZone: ianaTimeZone("America/New_York"),
    };

    expect(dates).toEqual(["2026-03-07", "2026-03-08", "2026-03-09"]);
    expect(dates.map((date) => makeOccurrenceKey(seriesId("series-dst"), schedule, date))).toEqual([
      "series-dst@2026-03-07T09:00[America/New_York]",
      "series-dst@2026-03-08T09:00[America/New_York]",
      "series-dst@2026-03-09T09:00[America/New_York]",
    ]);
  });

  it("finds the anchored daily occurrence after an arbitrary date", () => {
    expect(
      nextOccurrenceDate(
        localDate("2026-01-01"),
        { frequency: "daily", interval: 2 },
        localDate("2026-01-02"),
      ),
    ).toBe("2026-01-03");
  });

  it("keeps every daily interval anchored for arbitrary query dates", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 31 }),
        fc.integer({ min: 0, max: 730 }),
        (interval, afterOffset) => {
          const start = localDate("2026-01-01");
          const queried = new Date(Date.UTC(2026, 0, 1 + afterOffset)).toISOString().slice(0, 10);
          const expectedOffset = (Math.floor(afterOffset / interval) + 1) * interval;
          const expected = new Date(Date.UTC(2026, 0, 1 + expectedOffset))
            .toISOString()
            .slice(0, 10);
          expect(
            nextOccurrenceDate(start, { frequency: "daily", interval }, localDate(queried)),
          ).toBe(expected);
        },
      ),
    );
  });

  it("defaults missing monthly dates to an explicit clamp policy", () => {
    const rule = monthlyRecurrence(31);

    expect(rule.invalidDatePolicy).toBe("clamp");
    expect(occurrenceDates(localDate("2026-01-31"), rule, 4)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("can explicitly skip months without the anchored day", () => {
    const rule = monthlyRecurrence(31, 1, "skip");

    expect(occurrenceDates(localDate("2026-01-31"), rule, 4)).toEqual([
      "2026-01-31",
      "2026-03-31",
      "2026-05-31",
      "2026-07-31",
    ]);
  });

  it("applies the same explicit policy to leap-day yearly recurrence", () => {
    expect(
      occurrenceDates(localDate("2024-02-29"), yearlyRecurrence(2, 29), 4),
    ).toEqual(["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28"]);
    expect(
      occurrenceDates(localDate("2024-02-29"), yearlyRecurrence(2, 29, 1, "skip"), 3),
    ).toEqual(["2024-02-29", "2028-02-29", "2032-02-29"]);
  });

  it.each(["monthly", "yearly"] as const)(
    "rejects an unknown %s invalid-date policy",
    (frequency) => {
      const rule = frequency === "monthly"
        ? { frequency, interval: 1, dayOfMonth: 31, invalidDatePolicy: "rollover" }
        : { frequency, interval: 1, month: 2, dayOfMonth: 29, invalidDatePolicy: "rollover" };

      expect(() => validateRecurrenceRule(rule as unknown as RecurrenceRule)).toThrow(
        /invalid-date policy/u,
      );
    },
  );

  it("keeps weekly cadence anchored while supporting several weekdays", () => {
    expect(
      occurrenceDates(
        localDate("2026-08-17"),
        { frequency: "weekly", interval: 2, weekdays: [1, 3] },
        6,
      ),
    ).toEqual([
      "2026-08-17",
      "2026-08-19",
      "2026-08-31",
      "2026-09-02",
      "2026-09-14",
      "2026-09-16",
    ]);
  });

  it("anchors weekly intervals to calendar weeks when a series starts midweek", () => {
    expect(
      occurrenceDates(
        localDate("2026-08-19"),
        { frequency: "weekly", interval: 2, weekdays: [1, 3] },
        4,
      ),
    ).toEqual(["2026-08-19", "2026-08-31", "2026-09-02", "2026-09-14"]);
  });
});
