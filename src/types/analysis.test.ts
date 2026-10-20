import { describe, expect, it } from "vitest";
import { generateDemoData } from "@/lib/demoData";
import { sanitizeParsedForCloudSave } from "@/types/analysis";

function privateDemoData() {
  const parsed = generateDemoData();
  const thread = parsed.messages?.threads[0];
  if (!thread || !parsed.network || !parsed.security || !parsed.insights) {
    throw new Error("Demo data is missing required privacy-test fixtures.");
  }

  parsed.filePaths = ["private/archive/path.json"];
  thread.sourcePath = "messages/inbox/alice/message_1.json";
  thread.threadPath = "messages/inbox/alice";
  thread.firstMessagePreview = "A private first message";
  thread.aiSummarySample = {
    createdAt: "2026-01-01T00:00:00.000Z",
    realNamesAvailable: true,
    messages: [
      {
        senderLabel: "Alice",
        senderName: "Alice",
        text: "A private stored sample",
      },
    ],
  };

  parsed.network.blockedMeta = {
    includedInExport: true,
    sourcePath: "connections/blocked_profiles.json",
  };

  const privateEvent = {
    ...parsed.security.events?.[0],
    id: "private-event",
    type: "login" as const,
    label: "Private login",
    severity: "high" as const,
    sourcePath: "security/login_activity.json",
  };
  parsed.security.events = [privateEvent];
  parsed.security.suspiciousLoginAnalysis = {
    securityScore: 25,
    eventsReviewed: 1,
    worthReviewingCount: 1,
    flaggedEvents: [
      {
        event: { ...privateEvent },
        reason: "Private reason",
        severity: "high",
      },
    ],
    suggestions: [],
  };

  const secretSearch = {
    query: "secret_person",
    count: 4,
    lastSearchedAt: 1_700_000_000,
    type: "account" as const,
  };
  parsed.insights.searchWrapped = {
    totalSearches: 4,
    topAccounts: [secretSearch],
    topTerms: [{ ...secretSearch, query: "private topic", type: "term" }],
    repeatedSearches: [secretSearch],
    labels: ["Repeat Search"],
    privacyNote: "Private",
    filesParsed: ["searches/recent_searches.json"],
  };
  parsed.insights.accounts[0].searchCount = 4;
  parsed.insights.accounts[0].searchAttribution = "attributed";
  parsed.insights.yearbook = [
    {
      id: "search-card",
      superlative: "Most searched",
      winnerLabel: "Secret Person",
      caption: "Private search result",
      category: "Search",
      confidence: "high",
    },
    {
      id: "dm-card",
      superlative: "Most messaged",
      winnerLabel: "Alice",
      caption: "DM result",
      category: "DMs",
      confidence: "high",
    },
  ];
  parsed.insights.dataExplorer.files = [
    {
      path: "private/archive/path.json",
      category: "Search",
      folder: "private",
      contributed: true,
    },
  ];
  parsed.insights.dataExplorer.dmThreadDebug = [
    {
      threadId: thread.id,
      title: thread.threadName,
      sourcePath: thread.sourcePath,
      participantCount: 2,
      isGroup: false,
      totalMessages: thread.messageCount,
      senderCounts: thread.messagesBySender,
      contributesToDirectLeaderboard: true,
      contributesToGroupLeaderboard: false,
      nameConfidence: "high",
      isUnknownAccount: false,
    },
  ];
  parsed.insights.dataExplorer.identityResolution = {
    totalCanonicalPeople: 1,
    networkOnlyPeople: 0,
    directDmMatchedPeople: 1,
    possibleDmMatches: 0,
    unmatchedDmThreads: 0,
    topMatches: [],
    topUnmatched: [],
  };
  parsed.insights.dataExplorer.coreAnalytics = {
    directDmThreadCount: 1,
    groupDmThreadCount: 0,
    topDirectDmThreads: [],
    topDmPeople: [],
    topLinkedInMostInteracted: [],
    topRealOnes: [],
  };

  return { parsed, threadId: thread.id };
}

describe("sanitizeParsedForCloudSave", () => {
  it("removes raw paths, searches, message text, previews, names, and AI samples by default", () => {
    const { parsed, threadId } = privateDemoData();

    const saved = sanitizeParsedForCloudSave(parsed, false, false, false);
    const thread = saved.messages?.threads.find((item) => item.id === threadId);

    expect("filePaths" in saved).toBe(false);
    expect(saved.network?.blockedMeta).toEqual({ includedInExport: true });
    expect(saved.security?.events?.[0].sourcePath).toBeUndefined();
    expect(
      saved.security?.suspiciousLoginAnalysis?.flaggedEvents[0].event.sourcePath
    ).toBeUndefined();
    expect(saved.insights?.searchWrapped).toMatchObject({
      topAccounts: [],
      topTerms: [],
      repeatedSearches: [],
      filesParsed: [],
    });
    expect(saved.insights?.accounts[0].searchCount).toBeUndefined();
    expect(saved.insights?.accounts[0].searchAttribution).toBeUndefined();
    expect(saved.insights?.yearbook?.map((card) => card.category)).toEqual([
      "DMs",
    ]);
    expect(saved.insights?.dataExplorer.files).toEqual([]);
    expect(saved.insights?.dataExplorer.dmThreadDebug).toBeUndefined();
    expect(saved.insights?.dataExplorer.identityResolution).toBeUndefined();
    expect(saved.insights?.dataExplorer.coreAnalytics).toBeUndefined();
    expect(thread).toMatchObject({
      threadName: "Direct message",
      title: "Direct message",
    });
    expect(thread?.sourcePath).toBeUndefined();
    expect(thread?.threadPath).toBeUndefined();
    expect(thread?.firstMessagePreview).toBeUndefined();
    expect(thread?.textMessages).toBeUndefined();
    expect(thread?.aiSummarySample).toBeUndefined();
    expect(thread?.participants.every((name) => name.startsWith("Person"))).toBe(
      true
    );
  });

  it("persists only a sanitized AI sample when explicitly opted in", () => {
    const { parsed, threadId } = privateDemoData();

    const saved = sanitizeParsedForCloudSave(parsed, true, true, true);
    const thread = saved.messages?.threads.find((item) => item.id === threadId);

    expect(thread?.firstMessagePreview).toBe("A private first message");
    expect(thread?.aiSummarySample?.messages.length).toBeGreaterThan(0);
    expect(thread?.textMessages).toBeUndefined();
    expect(thread?.sourcePath).toBeUndefined();
    expect(thread?.threadPath).toBeUndefined();
    expect(saved.insights?.searchWrapped?.topAccounts).toEqual([]);
  });
});
