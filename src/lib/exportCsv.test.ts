import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "@/lib/exportCsv";

describe("escapeCsvCell", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "  =2+2"])(
    "neutralizes spreadsheet formula payload %s",
    (value) => {
      expect(escapeCsvCell(value)).toContain(`'${value}`);
    }
  );

  it("escapes commas, quotes, and newlines using CSV quoting rules", () => {
    expect(escapeCsvCell('hello, "world"')).toBe('"hello, ""world"""');
    expect(escapeCsvCell("line one\nline two")).toBe(
      '"line one\nline two"'
    );
  });

  it("leaves ordinary values unchanged", () => {
    expect(escapeCsvCell("safe text")).toBe("safe text");
    expect(escapeCsvCell(42)).toBe("42");
  });
});
