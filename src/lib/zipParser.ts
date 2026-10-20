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
import {
  decodeInstagramJsonText,
  repairMojibakeString,
} from "@/lib/instagramText";

export type ParseProgress = {
  stage: string;
  percent: number;
};

/** macOS adds __MACOSX/ and "._name" resource-fork shadows when zipping. */
function isZipJunk(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return (
    normalized.startsWith("__MACOSX/") ||
    normalized.includes("/__MACOSX/") ||
    /(^|\/)\._/.test(normalized) ||
    /(^|\/)\.DS_Store$/.test(normalized)
  );
}

/** Let React paint the latest progress text between synchronous stages. */
const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0));

function attempt<T>(errors: string[], message: string, fn: () => T): T | null {
  try {
    return fn();
  } catch (err) {
    console.error(message, err);
    errors.push(message);
    return null;
  }
}

async function collectZipFiles(
  zip: JSZip,
  onProgress?: (p: ParseProgress) => void
): Promise<{ paths: string[]; jsonMap: Map<string, string> }> {
  const paths: string[] = [];
  const jsonMap = new Map<string, string>();

  const entries = Object.entries(zip.files).filter(
    ([path, f]) => !f.dir && !isZipJunk(path)
  );
  const total = entries.length;

  for (let i = 0; i < entries.length; i++) {
    const [path, file] = entries[i];
    paths.push(path);

    if (path.toLowerCase().endsWith(".json")) {
      try {
        const content = await file.async("text");
        // Exports escape mojibake as \u00XX; re-saved files may carry it raw.
        jsonMap.set(
          path,
          repairMojibakeString(decodeInstagramJsonText(content))
        );
      } catch {
        // skip unreadable json
      }
    }

    if (onProgress && (i % 10 === 0 || i === total - 1)) {
      onProgress({
        stage: `Scanning files (${i + 1}/${total})…`,
        percent: Math.round(((i + 1) / total) * 60),
      });
    }
  }

  return { paths, jsonMap };
}

export async function parseInstagramZip(
  file: File,
  onProgress?: (p: ParseProgress) => void
): Promise<ParsedExportData> {
  onProgress?.({ stage: "Reading ZIP file…", percent: 5 });

  let zip: JSZip;
  try {
    const buffer = await file.arrayBuffer();
    zip = await JSZip.loadAsync(buffer);
  } catch {
    const gb = file.size / 1024 ** 3;
    throw new Error(
      gb >= 1.5
        ? `This ZIP is ${gb.toFixed(1)} GB — too large to open in the browser. Request a new export with Media quality: Low, or deselect photos/videos, then upload that ZIP.`
        : "Could not read this file. Please upload a valid Instagram data export ZIP."
    );
  }

  const { paths, jsonMap } = await collectZipFiles(zip, onProgress);

  onProgress?.({ stage: "Analyzing data coverage…", percent: 65 });
  const { coverage, totalFiles, jsonFiles, mediaFiles } =
    parseDataCoverage(paths);

  if (jsonFiles === 0) {
    const htmlFiles = paths.filter((p) =>
      p.toLowerCase().endsWith(".html")
    ).length;
    throw new Error(
      htmlFiles > 0
        ? "This export is in HTML format. IG Wrapped needs JSON — request a new export from Instagram and choose Format: JSON."
        : "This ZIP doesn't contain any Instagram export data. Upload the ZIP Instagram sent you (Format: JSON)."
    );
  }
  if (!coverage.some((c) => c.detected)) {
    throw new Error(
      "This ZIP doesn't look like an Instagram data export. Upload the ZIP Instagram sent you (Format: JSON)."
    );
  }

  const errors: string[] = [];

  onProgress?.({ stage: "Parsing network data…", percent: 72 });
  await yieldToBrowser();
  const networkResult = attempt(errors, "Failed to parse followers/following files.", () =>
    parseFollowersFollowing(jsonMap)
  );
  const network = networkResult?.network ?? null;
  errors.push(...(networkResult?.errors ?? []));

  onProgress?.({ stage: "Parsing activity insights…", percent: 78 });
  await yieldToBrowser();
  const wrappedInsights = attempt(errors, "Failed to parse some activity files.", () =>
    parseWrappedInsights(jsonMap)
  );
  const wrapped =
    wrappedInsights && hasWrappedData(wrappedInsights) ? wrappedInsights : null;

  onProgress?.({ stage: "Parsing messages…", percent: 82 });
  await yieldToBrowser();
  const messages = attempt(errors, "Failed to parse some message files.", () =>
    parseMessages(jsonMap)
  );

  onProgress?.({ stage: "Parsing ads & privacy…", percent: 86 });
  await yieldToBrowser();
  const ads = attempt(errors, "Failed to parse some ads files.", () =>
    parseAdsPrivacy(jsonMap)
  );

  onProgress?.({ stage: "Parsing security data…", percent: 89 });
  await yieldToBrowser();
  const security = attempt(errors, "Failed to parse some security files.", () =>
    parseSecurity(jsonMap)
  );

  onProgress?.({ stage: "Building your timeline…", percent: 92 });
  await yieldToBrowser();
  const mostActiveEra = attempt(errors, "Failed to build the activity timeline.", () =>
    computeMostActiveEra({
      files: jsonMap,
      messages,
      network,
      ads,
    })
  );

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

  onProgress?.({ stage: "Matching accounts across your export…", percent: 95 });
  await yieldToBrowser();
  // On failure the dashboard falls back to resolveInsightsBundle at render time.
  const insights = attempt(errors, "Some insights could not be computed.", () =>
    computeInsightsBundle(baseParsed, jsonMap, [])
  );

  onProgress?.({ stage: "Done!", percent: 100 });

  return {
    ...baseParsed,
    insights,
  };
}
