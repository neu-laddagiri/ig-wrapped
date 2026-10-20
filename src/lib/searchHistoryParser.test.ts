import { describe, expect, it } from "vitest";
import { parseSearchHistory } from "@/lib/searchHistoryParser";

describe("parseSearchHistory", () => {
  it("does not double-count the same timestamped event at parent and child levels", () => {
    const files = new Map<string, string>([
      [
        "your_instagram_activity/searches/recent_searches.json",
        JSON.stringify({
          recent_searches: [
            {
              title: "Alice",
              timestamp: 1_700_000_000,
              string_list_data: [
                { value: "alice", timestamp: 1_700_000_000 },
              ],
            },
            {
              title: "ALICE",
              timestamp: 1_700_000_100,
              string_list_data: [
                { value: "alice", timestamp: 1_700_000_100 },
              ],
            },
          ],
        }),
      ],
    ]);

    const result = parseSearchHistory(files);

    expect(result).not.toBeNull();
    expect(result?.totalSearches).toBe(2);
    expect(result?.topAccounts[0]).toMatchObject({
      query: "alice",
      count: 2,
      type: "account",
      lastSearchedAt: 1_700_000_100,
    });
  });

  it("keeps repeated untimed searches as separate events", () => {
    const files = new Map<string, string>([
      [
        "logged_information/searches/search_history.json",
        JSON.stringify({
          searches: [{ value: "alice" }, { value: "alice" }],
        }),
      ],
    ]);

    const result = parseSearchHistory(files);

    expect(result?.totalSearches).toBe(2);
    expect(result?.topAccounts[0]).toMatchObject({ query: "alice", count: 2 });
  });
});
