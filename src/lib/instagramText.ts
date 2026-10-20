/**
 * Instagram/Meta JSON exports write every UTF-8 byte of non-ASCII text as its
 * own \u00XX escape, so "José 😂" arrives as "JosÃ© ð\u009f\u0098\u0082"
 * and JSON.parse turns it into mojibake ("JosÃ© ð").
 */

const utf8 = new TextDecoder("utf-8", { fatal: true });

function sequenceLength(lead: number): number {
  if (lead >= 0xc2 && lead <= 0xdf) return 2;
  if (lead >= 0xe0 && lead <= 0xef) return 3;
  if (lead >= 0xf0 && lead <= 0xf4) return 4;
  return 0;
}

/**
 * Decode a run of byte values as UTF-8, one character at a time. Bytes that
 * are not part of a valid sequence are handed to `keep` unchanged, so text
 * that was never mojibake (e.g. a lone "é") survives untouched.
 */
function decodeByteRun(
  bytes: number[],
  keep: (byte: number) => string
): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const len = sequenceLength(bytes[i]);
    if (len > 0 && i + len <= bytes.length) {
      const chunk = bytes.slice(i, i + len);
      if (chunk.slice(1).every((b) => b >= 0x80 && b <= 0xbf)) {
        try {
          out += utf8.decode(Uint8Array.from(chunk));
          i += len;
          continue;
        } catch {
          // overlong / surrogate sequence — fall through and keep the byte
        }
      }
    }
    out += keep(bytes[i]);
    i++;
  }
  return out;
}

const ESCAPED_BYTE_RUN = /(?:\\u00[89a-fA-F][0-9a-fA-F])+/g;

/**
 * Fix mojibake in raw export JSON text before it is parsed. Decoded characters
 * are all >= U+0080, so inserting them unescaped keeps the JSON valid.
 */
export function decodeInstagramJsonText(json: string): string {
  if (!json.includes("\\u00")) return json;
  return json.replace(ESCAPED_BYTE_RUN, (run: string, offset: number) => {
    // An odd number of preceding backslashes means "\u00…" is literal text.
    let slashes = 0;
    for (let i = offset - 1; i >= 0 && json[i] === "\\"; i--) slashes++;
    if (slashes % 2 === 1) return run;

    const bytes: number[] = [];
    for (let i = 0; i < run.length; i += 6) {
      bytes.push(parseInt(run.slice(i + 4, i + 6), 16));
    }
    return decodeByteRun(
      bytes,
      (b) => `\\u00${b.toString(16).padStart(2, "0")}`
    );
  });
}

const MOJIBAKE_RUN = /[\u0080-ÿ]{2,}/g;

/** Repair a string that was already parsed from an undecoded export. */
export function repairMojibakeString(value: string): string {
  if (!/[Â-ô][\u0080-¿]/.test(value)) return value;
  return value.replace(MOJIBAKE_RUN, (run) =>
    decodeByteRun(
      Array.from(run, (c) => c.charCodeAt(0)),
      (b) => String.fromCharCode(b)
    )
  );
}

/**
 * Deep-repair strings (and object keys, e.g. messagesBySender) in data saved
 * before export text was decoded at upload time.
 */
export function repairMojibakeDeep<T>(value: T): T {
  if (typeof value === "string") return repairMojibakeString(value) as T;
  if (Array.isArray(value)) return value.map(repairMojibakeDeep) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[repairMojibakeString(key)] = repairMojibakeDeep(v);
    }
    return out as T;
  }
  return value;
}
