import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  MAX_ZIP_BYTES,
  parseInstagramZip,
  type ParseProgress,
} from "@/lib/zipParser";

async function zipFile(entries: Record<string, string>): Promise<File> {
  const zip = new JSZip();
  Object.entries(entries).forEach(([path, content]) => zip.file(path, content));
  const bytes = await zip.generateAsync({ type: "arraybuffer" });
  return new File([bytes], "instagram-export.zip", {
    type: "application/zip",
  });
}

describe("parseInstagramZip", () => {
  it("rejects an empty archive", async () => {
    await expect(parseInstagramZip(await zipFile({}))).rejects.toThrow(
      "This ZIP is empty"
    );
  });

  it("rejects a ZIP that does not resemble an Instagram export", async () => {
    const file = await zipFile({ "notes/data.json": JSON.stringify({ ok: true }) });

    await expect(parseInstagramZip(file)).rejects.toThrow(
      "does not look like an Instagram data export"
    );
  });

  it("does not accept a broad folder-name decoy", async () => {
    const file = await zipFile({
      "connections/readme.txt": "not Instagram data",
      "random/data.json": JSON.stringify({ ok: true }),
    });

    await expect(parseInstagramZip(file)).rejects.toThrow(
      "does not look like an Instagram data export"
    );
  });

  it("parses a minimal anchored export and completes progress", async () => {
    const file = await zipFile({
      "connections/followers_and_following/followers_1.json": JSON.stringify([
        {
          string_list_data: [
            {
              value: "alice",
              href: "https://www.instagram.com/alice/",
              timestamp: 1_700_000_000,
            },
          ],
        },
      ]),
    });
    const progress: ParseProgress[] = [];

    const result = await parseInstagramZip(file, (update) => {
      progress.push(update);
    });

    expect(result.network?.totalFollowers).toBe(1);
    expect(result.network?.followers[0].username).toBe("alice");
    expect(progress[0]).toMatchObject({ percent: 5 });
    expect(progress.at(-1)).toEqual({ stage: "Done!", percent: 100 });
  });

  it("honors a signal that was canceled before parsing", async () => {
    const controller = new AbortController();
    controller.abort();
    const file = new File(["not-empty"], "export.zip");

    await expect(
      parseInstagramZip(file, undefined, controller.signal)
    ).rejects.toThrow("Parsing canceled");
  });

  it("rejects cleanly when canceled during parsing", async () => {
    const controller = new AbortController();
    const file = await zipFile({
      "connections/followers_and_following/followers_1.json": JSON.stringify([
        { string_list_data: [{ value: "alice", timestamp: 1_700_000_000 }] },
      ]),
      "connections/followers_and_following/followers_2.json": JSON.stringify([
        { string_list_data: [{ value: "bob", timestamp: 1_700_000_001 }] },
      ]),
    });

    await expect(
      parseInstagramZip(
        file,
        (update) => {
          if (update.stage.startsWith("Scanning files")) controller.abort();
        },
        controller.signal
      )
    ).rejects.toThrow("Parsing canceled");
  });

  it("rejects oversized files before reading them", async () => {
    const oversized = { size: MAX_ZIP_BYTES + 1 } as unknown as File;

    await expect(parseInstagramZip(oversized)).rejects.toThrow("over 512 MB");
  });
});
