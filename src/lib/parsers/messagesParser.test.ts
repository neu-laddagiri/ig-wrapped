import { describe, expect, it } from "vitest";
import { parseMessages } from "@/lib/parsers/messagesParser";

describe("parseMessages", () => {
  it("merges numbered message shards and preserves link-type totals", () => {
    const files = new Map<string, string>([
      [
        "messages/inbox/alice_123/message_1.json",
        JSON.stringify({
          title: "Alice",
          thread_path: "inbox/alice_123",
          participants: [{ name: "Alice" }, { name: "You" }],
          messages: [
            {
              sender_name: "Alice",
              timestamp_ms: 1_704_067_200_000,
              content: "Look at https://www.instagram.com/reel/reel-one/",
            },
          ],
        }),
      ],
      [
        "messages/inbox/alice_123/message_2.json",
        JSON.stringify({
          thread_path: "inbox/alice_123",
          participants: [{ name: "You" }, { name: "Alice" }],
          messages: [
            {
              sender_name: "You",
              timestamp_ms: 1_704_153_600_000,
              share: {
                link: "https://www.instagram.com/p/post-one/",
              },
            },
          ],
        }),
      ],
    ]);

    const result = parseMessages(files);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      totalThreads: 1,
      totalMessages: 2,
      inboxThreads: 1,
      messageRequestThreads: 0,
    });

    const thread = result?.threads[0];
    expect(thread).toMatchObject({
      messageCount: 2,
      firstMessageTimestamp: 1_704_067_200,
      lastMessageTimestamp: 1_704_153_600,
      firstMessageSender: "Alice",
      lastMessageSender: "You",
      instagramReelLinks: 1,
      instagramPostLinks: 1,
      estimatedInstagramLinks: 2,
      messagesBySender: { Alice: 1, You: 1 },
      reelsLinksBySender: { Alice: 1 },
      postLinksBySender: { You: 1 },
    });
    expect(thread?.participants).toEqual(["Alice", "You"]);
    expect(thread?.textMessages).toHaveLength(2);
  });
});
