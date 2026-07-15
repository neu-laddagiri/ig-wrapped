import { describe, expect, it } from "vitest";
import { parseFollowersFollowing } from "@/lib/parsers/followersFollowingParser";

function account(value: string, timestamp: number, href = "javascript:alert(1)") {
  return {
    title: value,
    string_list_data: [{ value, timestamp, href }],
  };
}

describe("parseFollowersFollowing", () => {
  it("merges numbered shards, keeps the newest record, and derives safe links", () => {
    const files = new Map<string, string>([
      [
        "connections/followers_and_following/followers_1.json",
        JSON.stringify([account("Alice", 100)]),
      ],
      [
        "connections/followers_and_following/followers_2.json",
        JSON.stringify([account("alice", 300), account("Bob", 200)]),
      ],
      [
        "connections/followers_and_following/following.json",
        JSON.stringify([account("ALICE", 250), account("Carol", 150)]),
      ],
    ]);

    const { network, errors } = parseFollowersFollowing(files);

    expect(errors).toEqual([]);
    expect(network).not.toBeNull();
    expect(network).toMatchObject({
      totalFollowers: 2,
      totalFollowing: 2,
      followBackRatio: 0.5,
    });
    expect(network?.mutuals.map((item) => item.username)).toEqual(["alice"]);
    expect(network?.dontFollowMeBack.map((item) => item.username)).toEqual([
      "carol",
    ]);
    expect(network?.iDontFollowBack.map((item) => item.username)).toEqual([
      "bob",
    ]);

    const alice = network?.followers.find((item) => item.username === "alice");
    expect(alice).toMatchObject({
      timestamp: 300,
      href: "https://www.instagram.com/alice/",
    });
  });
});
