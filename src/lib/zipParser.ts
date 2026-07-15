import JSZip from "jszip";
import type { ParsedExportData } from "@/types/instagram";
import { parseFollowersFollowing } from "@/lib/parsers/followersFollowingParser";
import { parseWrappedInsights, hasWrappedData } from "@/lib/parsers/wrappedParser";
import { parseMessages } from "@/lib/parsers/messagesParser";
import { parseAdsPrivacy } from "@/lib/parsers/adsParser";
import { parseSecurity } from "@/lib/parsers/securityParser";
import { parseDataCoverage } from "@/lib/parsers/dataCoverageParser";
import { computeMostActiveEra } from "@/lib/mostActiveEra";
import { computeInsightsBundle } from "@/lib/insightsEngine";

export type ParseProgress = {
  stage: string;
  percent: number;
};

export const MAX_ZIP_BYTES = 512 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 25_000;
const MAX_JSON_FILES = 10_000;
const MAX_SINGLE_JSON_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_JSON_BYTES = 128 * 1024 * 1024;

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Parsing canceled.");
  }
}

function declaredUncompressedBytes(file: JSZip.JSZipObject): number | null {
  const data = (
    file as unknown as { _data?: { uncompressedSize?: unknown } }
  )._data;
  return typeof data?.uncompressedSize === "number" &&
    Number.isSafeInteger(data.uncompressedSize) &&
    data.uncompressedSize >= 0
    ? data.uncompressedSize
    : null;
}

function looksLikeInstagramExport(jsonMap: Map<string, string>): boolean {
  const expectedJsonPaths = [
    /(?:^|\/)connections\/followers_and_following\/(?:followers_\d+|following|blocked_accounts|restricted_accounts|pending_follow_requests|recent_follow_requests|recently_unfollowed_profiles)\.json$/,
    /(?:^|\/)followers_and_following\/(?:followers_\d+|following|blocked_accounts|restricted_accounts|pending_follow_requests|recent_follow_requests|recently_unfollowed_profiles)\.json$/,
    /(?:^|\/)messages\/(?:inbox|message_requests)\/[^/]+\/message_\d+\.json$/,
    /(?:^|\/)your_instagram_activity\/.+\.json$/,
    /(?:^|\/)(?:security_and_login_information|logged_information|ads_information|personal_information)\/.+\.json$/,
  ];
  return [...jsonMap].some(([path, content]) => {
    const normalized = path.toLowerCase().replace(/\\/g, "/");
    if (!expectedJsonPaths.some((pattern) => pattern.test(normalized))) {
      return false;
    }
    try {
      const parsed: unknown = JSON.parse(content);
      return typeof parsed === "object" && parsed !== null;
    } catch {
      return false;
    }
  });
}

async function collectZipFiles(
  zip: JSZip,
  onProgress?: (p: ParseProgress) => void,
  signal?: AbortSignal
): Promise<{ paths: string[]; jsonMap: Map<string, string> }> {
  const paths: string[] = [];
  const jsonMap = new Map<string, string>();

  const entries = Object.entries(zip.files).filter(([, f]) => !f.dir);
  const total = entries.length;
  if (total === 0) {
    throw new Error("This ZIP is empty. Choose an Instagram JSON export.");
  }
  if (total > MAX_ARCHIVE_ENTRIES) {
    throw new Error(
      "This archive contains too many files to process safely. Export Instagram data as JSON without media and try again."
    );
  }

  let jsonFileCount = 0;
  let totalJsonBytes = 0;

  // JSZip exposes the central-directory size on loaded entries at runtime.
  // Check it before inflating so a highly compressed JSON bomb is rejected
  // before the browser allocates the decompressed string.
  for (const [path, file] of entries) {
    if (!path.toLowerCase().endsWith(".json")) continue;
    const declaredBytes = declaredUncompressedBytes(file);
    if (declaredBytes === null) continue;
    if (declaredBytes > MAX_SINGLE_JSON_BYTES) {
      throw new Error(
        `A JSON file in this export is too large to process safely (${path}).`
      );
    }
    totalJsonBytes += declaredBytes;
    if (totalJsonBytes > MAX_TOTAL_JSON_BYTES) {
      throw new Error(
        "The extracted JSON data is too large to process safely in this browser."
      );
    }
  }

  totalJsonBytes = 0;

  for (let i = 0; i < entries.length; i++) {
    assertNotAborted(signal);
    const [path, file] = entries[i];
    paths.push(path);

    if (path.toLowerCase().endsWith(".json")) {
      jsonFileCount += 1;
      if (jsonFileCount > MAX_JSON_FILES) {
        throw new Error(
          "This archive contains too many JSON files to process safely."
        );
      }
      try {
        const content = await file.async("text");
        assertNotAborted(signal);
        const contentBytes = new Blob([content]).size;
        if (contentBytes > MAX_SINGLE_JSON_BYTES) {
          throw new Error(
            `A JSON file in this export is too large to process safely (${path}).`
          );
        }
        totalJsonBytes += contentBytes;
        if (totalJsonBytes > MAX_TOTAL_JSON_BYTES) {
          throw new Error(
            "The extracted JSON data is too large to process safely in this browser."
          );
        }
        jsonMap.set(path, content);
      } catch (error) {
        if (error instanceof Error && error.message.includes("too large")) {
          throw error;
        }
        assertNotAborted(signal);
        // skip unreadable json
      }
    }

    if (onProgress && (i % 10 === 0 || i === total - 1)) {
      onProgress({
        stage: `Scanning files (${i + 1}/${total})…`,
        percent: 5 + Math.round(((i + 1) / total) * 55),
      });
    }
  }

  return { paths, jsonMap };
}

export async function parseInstagramZip(
  file: File,
  onProgress?: (p: ParseProgress) => void,
  signal?: AbortSignal
): Promise<ParsedExportData> {
  if (file.size === 0) {
    throw new Error("This ZIP is empty. Choose an Instagram JSON export.");
  }
  if (file.size > MAX_ZIP_BYTES) {
    throw new Error(
      "This ZIP is over 512 MB and may crash the browser. Export Instagram data as JSON without media and try again."
    );
  }
  assertNotAborted(signal);
  onProgress?.({ stage: "Reading ZIP file…", percent: 5 });

  let zip: JSZip;
  try {
    const buffer = await file.arrayBuffer();
    assertNotAborted(signal);
    zip = await JSZip.loadAsync(buffer);
  } catch (error) {
    if (error instanceof Error && error.message === "Parsing canceled.") {
      throw error;
    }
    throw new Error(
      "Could not read this file. Please upload a valid Instagram data export ZIP."
    );
  }

  const { paths, jsonMap } = await collectZipFiles(zip, onProgress, signal);
  if (jsonMap.size === 0) {
    throw new Error(
      "No readable JSON files were found. In Instagram, choose JSON as the export format."
    );
  }
  if (!looksLikeInstagramExport(jsonMap)) {
    throw new Error(
      "This ZIP does not look like an Instagram data export. Upload the ZIP downloaded from Accounts Center."
    );
  }

  onProgress?.({ stage: "Analyzing data coverage…", percent: 65 });
  const { coverage, totalFiles, jsonFiles, mediaFiles } =
    parseDataCoverage(paths);

  const errors: string[] = [];

  onProgress?.({ stage: "Parsing network data…", percent: 72 });
  const { network, errors: networkErrors } = parseFollowersFollowing(jsonMap);
  errors.push(...networkErrors);

  onProgress?.({ stage: "Parsing activity insights…", percent: 80 });
  const wrappedInsights = parseWrappedInsights(jsonMap);
  const wrapped = hasWrappedData(wrappedInsights) ? wrappedInsights : null;

  onProgress?.({ stage: "Parsing messages…", percent: 86 });
  let messages = null;
  try {
    messages = parseMessages(jsonMap);
  } catch {
    errors.push("Failed to parse some message files.");
  }

  onProgress?.({ stage: "Parsing ads & privacy…", percent: 92 });
  let ads = null;
  try {
    ads = parseAdsPrivacy(jsonMap);
  } catch {
    errors.push("Failed to parse some ads files.");
  }

  onProgress?.({ stage: "Parsing security data…", percent: 96 });
  let security = null;
  try {
    security = parseSecurity(jsonMap);
  } catch {
    errors.push("Failed to parse some security files.");
  }

  assertNotAborted(signal);
  onProgress?.({ stage: "Building your timeline…", percent: 97 });
  const mostActiveEra = computeMostActiveEra({
    files: jsonMap,
    messages,
    network,
    ads,
  });

  const baseParsed = {
    network,
    wrapped,
    messages,
    ads,
    security,
    mostActiveEra,
    coverage,
    totalFiles,
    jsonFiles,
    mediaFiles,
    filePaths: paths,
    errors,
    insights: null as import("@/types/insights").InsightsBundle | null,
  };

  assertNotAborted(signal);
  onProgress?.({ stage: "Finalizing insights…", percent: 99 });
  const insights = computeInsightsBundle(baseParsed, jsonMap, []);
  assertNotAborted(signal);
  onProgress?.({ stage: "Done!", percent: 100 });

  return {
    ...baseParsed,
    insights,
  };
}
