import { NextResponse } from "next/server";

const MAX_BODY_CHUNKS = 2048;
const MAX_RATE_LIMIT_BUCKETS = 10_000;
const RATE_LIMIT_SWEEP_INTERVAL = 128;

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      error: string;
      status: 400 | 413 | 415;
    };

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const globalRateLimitState = globalThis as typeof globalThis & {
  __igWrappedAiRateLimitBuckets?: Map<string, RateLimitBucket>;
  __igWrappedAiRateLimitChecks?: number;
};

const rateLimitBuckets =
  globalRateLimitState.__igWrappedAiRateLimitBuckets ??
  new Map<string, RateLimitBucket>();
globalRateLimitState.__igWrappedAiRateLimitBuckets = rateLimitBuckets;

const AGGREGATE_METRIC_KEYS = new Set([
  "followers",
  "following",
  "mutuals",
  "followBackRatioPct",
  "likedPosts",
  "comments",
  "savedPosts",
  "storyViews",
  "dmThreads",
  "dmMessages",
  "oneOnOneThreads",
  "groupChats",
  "mostActiveEra",
  "contentPersonality",
  "passiveRatioPct",
  "adsViewed",
  "adsClicked",
  "adResistance",
  "privacyCreepScore",
  "avgCleanupScore",
  "avgRealOnesScore",
  "securityHealthScore",
  "securityWorthReviewing",
  "searchTotal",
  "instagramPersonality",
  "exportQuality",
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function jsonNoStore<T>(
  body: T,
  init: ResponseInit = {}
): NextResponse<T> {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("X-Content-Type-Options", "nosniff");

  return NextResponse.json(body, { ...init, headers });
}

async function readStreamBytes(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false }> {
  if (!stream) return { ok: false };

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes || chunks.length >= MAX_BODY_CHUNKS) {
        await reader.cancel().catch(() => undefined);
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export async function readBoundedJson(
  request: Request,
  maxBytes: number
): Promise<BoundedJsonResult> {
  const contentType =
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ??
    "";
  if (contentType !== "application/json" && !contentType.endsWith("+json")) {
    return {
      ok: false,
      error: "Content-Type must be application/json.",
      status: 415,
    };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    if (!/^\d+$/.test(contentLength.trim())) {
      return { ok: false, error: "Invalid Content-Length.", status: 400 };
    }
    const declaredBytes = Number(contentLength.trim());
    if (!Number.isSafeInteger(declaredBytes)) {
      return { ok: false, error: "Invalid Content-Length.", status: 400 };
    }
    if (declaredBytes > maxBytes) {
      return {
        ok: false,
        error: "Request body is too large.",
        status: 413,
      };
    }
  }

  if (!request.body) {
    return { ok: false, error: "Request body is required.", status: 400 };
  }

  const body = await readStreamBytes(request.body, maxBytes);
  if (!body.ok) {
    return {
      ok: false,
      error: "Request body is too large.",
      status: 413,
    };
  }

  const text = decodeUtf8(body.bytes);
  if (text === null) {
    return { ok: false, error: "Request body must be valid UTF-8.", status: 400 };
  }

  try {
    return { ok: true, value: JSON.parse(text) as JsonValue };
  } catch {
    return { ok: false, error: "Invalid JSON body.", status: 400 };
  }
}

export async function readBoundedResponseText(
  response: Response,
  maxBytes: number
): Promise<string | null> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
  }

  const body = await readStreamBytes(response.body, maxBytes);
  if (!body.ok) return null;
  return decodeUtf8(body.bytes);
}

export async function readBoundedResponseJson(
  response: Response,
  maxBytes: number
): Promise<unknown | null> {
  const text = await readBoundedResponseText(response, maxBytes);
  if (text === null) return null;
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return null;
  }
}

export function extractChatCompletionContent(data: unknown): string | null {
  if (!isRecord(data) || !Array.isArray(data.choices)) return null;
  const first = data.choices[0];
  if (!isRecord(first) || !isRecord(first.message)) return null;
  const content = first.message.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

function normalizedOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return false;

  const originHeader = request.headers.get("origin");
  if (!originHeader) return true;

  const origin = normalizedOrigin(originHeader);
  if (!origin || originHeader === "null") return false;

  const allowedOrigins = new Set<string>();
  const requestOrigin = normalizedOrigin(request.url);
  if (requestOrigin) allowedOrigins.add(requestOrigin);

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : new URL(request.url).protocol.replace(":", "");

  if (host) {
    const forwardedOrigin = normalizedOrigin(`${protocol}://${host}`);
    if (forwardedOrigin) allowedOrigins.add(forwardedOrigin);
  }

  return allowedOrigins.has(origin);
}

function clientIp(request: Request): string {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0],
  ];
  const candidate = candidates.find((value) => value?.trim())?.trim();
  if (!candidate) return "unknown";
  const safe = candidate.replace(/[^a-fA-F0-9:.%-]/g, "").slice(0, 64);
  return safe || "unknown";
}

function sweepRateLimitBuckets(now: number): void {
  globalRateLimitState.__igWrappedAiRateLimitChecks =
    (globalRateLimitState.__igWrappedAiRateLimitChecks ?? 0) + 1;
  const checks = globalRateLimitState.__igWrappedAiRateLimitChecks;

  if (
    checks % RATE_LIMIT_SWEEP_INTERVAL !== 0 &&
    rateLimitBuckets.size <= MAX_RATE_LIMIT_BUCKETS
  ) {
    return;
  }

  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }

  if (rateLimitBuckets.size <= MAX_RATE_LIMIT_BUCKETS) return;
  for (const key of rateLimitBuckets.keys()) {
    rateLimitBuckets.delete(key);
    if (rateLimitBuckets.size <= MAX_RATE_LIMIT_BUCKETS) break;
  }
}

export function checkRateLimit(
  request: Request,
  scope: string,
  options: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  sweepRateLimitBuckets(now);

  const key = `${scope}:${clientIp(request)}`;
  let bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + options.windowMs };
    rateLimitBuckets.set(key, bucket);
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.resetAt - now) / 1000)
  );
  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSeconds,
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds,
  };
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }
  return headers;
}

export function sanitizeInlineText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeMultilineText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, maxLength);
}

export function redactSensitiveText(value: string, maxLength: number): string {
  const sanitized = sanitizeMultilineText(
    value,
    Math.min(value.length, Math.max(maxLength, maxLength * 4))
  );
  return sanitized
    .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi, "[email]")
    .replace(/https?:\/\/[^\s<>"']+/gi, "[link]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]")
    .replace(
      /(?:^|\s)(?:\+?\d[\d().\s-]{7,}\d)(?=$|\s|[,.!?;:])/g,
      (match) => `${match.startsWith(" ") ? " " : ""}[phone]`
    )
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[number]")
    .slice(0, maxLength);
}

export function sanitizeAggregateMetrics(
  value: unknown,
  options: { includeSearchCount: boolean }
):
  | { ok: true; metrics: Record<string, string | number | null> }
  | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "Missing metrics." };

  const entries = Object.entries(value);
  if (entries.length > AGGREGATE_METRIC_KEYS.size) {
    return { ok: false, error: "Too many metrics." };
  }

  const metrics: Record<string, string | number | null> = {};
  for (const [key, raw] of entries) {
    if (!AGGREGATE_METRIC_KEYS.has(key)) {
      return { ok: false, error: `Unsupported metric: ${key.slice(0, 40)}` };
    }
    if (key === "searchTotal" && !options.includeSearchCount) continue;

    if (raw === null) {
      metrics[key] = null;
      continue;
    }
    if (typeof raw === "number") {
      if (!Number.isFinite(raw) || raw < 0 || raw > 1_000_000_000_000) {
        return { ok: false, error: `Invalid metric value for ${key}.` };
      }
      metrics[key] = raw;
      continue;
    }
    if (typeof raw === "string") {
      if (raw.length > 240) {
        return { ok: false, error: `Metric ${key} is too long.` };
      }
      metrics[key] = sanitizeInlineText(redactSensitiveText(raw, 160), 160);
      continue;
    }
    return { ok: false, error: `Invalid metric type for ${key}.` };
  }
  return { ok: true, metrics };
}

export class AiProviderTimeoutError extends Error {
  constructor() {
    super("AI provider request timed out.");
    this.name = "AiProviderTimeoutError";
  }
}

export async function fetchWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  consumeResponse: (response: Response) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  let timedOut = false;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) controller.abort(upstreamSignal.reason);
  else upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });

  const timer = setTimeout(() => {
    if (controller.signal.aborted) return;
    timedOut = true;
    controller.abort(new AiProviderTimeoutError());
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    return await consumeResponse(response);
  } catch (error) {
    if (timedOut) throw new AiProviderTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
}

export function safeRetryAfterSeconds(value: string | null): number {
  if (!value) return 60;
  if (/^\d+$/.test(value.trim())) {
    return Math.max(1, Math.min(3600, Number(value.trim())));
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) return 60;
  return Math.max(1, Math.min(3600, Math.ceil((date - Date.now()) / 1000)));
}
