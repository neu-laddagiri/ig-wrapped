import JSZip from "jszip";
import type { ParsedExportData } from "@/types/instagram";
import { parseFollowersFollowing } from "@/lib/parsers/followersFollowingParser";
import { parseWrappedInsights, hasWrappedData } from "@/lib/parsers/wrappedParser";
import { parseMessages } from "@/lib/parsers/messagesParser";
import { parseAdsPrivacy } from "@/lib/parsers/adsParser";
import { parseSecurity } from "@/lib/parsers/securityParser";
import { parseDataCoverage } from "@/lib/parsers/dataCoverageParser";

export type ParseProgress = {
  stage: string;
  percent: number;
};

async function collectZipFiles(
  zip: JSZip,
  onProgress?: (p: ParseProgress) => void
): Promise<{ paths: string[]; jsonMap: Map<string, string> }> {
  const paths: string[] = [];
  const jsonMap = new Map<string, string>();

  const entries = Object.entries(zip.files).filter(([, f]) => !f.dir);
  const total = entries.length;

  for (let i = 0; i < entries.length; i++) {
    const [path, file] = entries[i];
    paths.push(path);

    if (path.toLowerCase().endsWith(".json")) {
      try {
        const content = await file.async("text");
        jsonMap.set(path, content);
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
    throw new Error(
      "Could not read this file. Please upload a valid Instagram data export ZIP."
    );
  }

  const { paths, jsonMap } = await collectZipFiles(zip, onProgress);

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

  onProgress?.({ stage: "Done!", percent: 100 });

  return {
    network,
    wrapped,
    messages,
    ads,
    security,
    coverage,
    totalFiles,
    jsonFiles,
    mediaFiles,
    filePaths: paths,
    errors,
  };
}
