import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

/** Flip to true to require a Supabase session for every AI route. */
const AI_REQUIRE_SIGN_IN = false;

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const PROVIDER_TIMEOUT_MS = 25_000;
const MAX_TRACKED_CLIENTS = 5000;

export const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
export const MAX_METRICS = 40;
export const MAX_METRIC_STRING = 200;

/** Values copied verbatim from .env.local.example count as "not set". */
const PLACEHOLDER_VALUES = new Set([
  "your_ai_provider_key",
  "your_model_name",
  "optional_provider_base_url",
]);

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AiGuardOptions {
  route: string;
  maxBodyBytes?: number;
  perMinute: number;
  perHour: number;
  notConfiguredMessage?: string;
}

export type AiGuardResult =
  | { ok: true; config: AiConfig; body: unknown }
  | { ok: false; response: NextResponse };

export type ProviderResult =
  | { ok: true; content: string }
  | { ok: false; status: number; error: string };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Collapse whitespace so user-supplied values can't break prompt structure. */
export function cleanText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function jsonError(
  error: string,
  status: number,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json({ error }, { status, headers });
}

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || PLACEHOLDER_VALUES.has(value)) return undefined;
  return value;
}

export function getAiConfig(): AiConfig | null {
  const apiKey = envValue("AI_API_KEY");
  if (!apiKey) return null;

  const baseUrl = envValue("AI_BASE_URL") ?? DEFAULT_BASE_URL;
  try {
    const { protocol } = new URL(baseUrl);
    if (protocol !== "https:" && protocol !== "http:") return null;
  } catch {
    return null;
  }

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model: envValue("AI_MODEL") ?? DEFAULT_MODEL,
  };
}

export function isAiConfigured(): boolean {
  return getAiConfig() !== null;
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const hosts = [
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
  ];
  try {
    hosts.push(new URL(request.url).host);
  } catch {
    // request.url is always absolute in route handlers
  }
  return hosts.some((h) => h?.split(",")[0].trim() === originHost);
}

async function getSessionUserId(): Promise<string | null> {
  try {
    const supabase = await createServerSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getClaims();
    return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort fixed-window limiter. State lives in this server instance's
 * memory, so it resets on cold starts and is not shared across instances.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

function consume(key: string, limit: number, windowMs: number, now: number) {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count > limit ? Math.ceil((bucket.resetAt - now) / 1000) : 0;
}

function rateLimit(route: string, ip: string, perMinute: number, perHour: number) {
  const now = Date.now();
  if (buckets.size > MAX_TRACKED_CLIENTS) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }
  return Math.max(
    consume(`${route}:m:${ip}`, perMinute, 60_000, now),
    consume(`${route}:h:${ip}`, perHour, 3_600_000, now)
  );
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

async function readJsonBody(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, response: jsonError("Expected a JSON request body.", 415) };
  }

  const tooLarge = () => ({
    ok: false as const,
    response: jsonError("Request too large for AI processing.", 413),
  });

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: jsonError("Invalid request body.", 400) };
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes) return tooLarge();

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: jsonError("Invalid JSON body.", 400) };
  }
}

/** Origin, config, (optional) session, rate-limit and body-size checks shared by AI routes. */
export async function guardAiRequest(
  request: Request,
  options: AiGuardOptions
): Promise<AiGuardResult> {
  if (!isAllowedOrigin(request)) {
    return { ok: false, response: jsonError("Cross-origin requests are not allowed.", 403) };
  }

  const config = getAiConfig();
  if (!config) {
    return {
      ok: false,
      response: jsonError(
        options.notConfiguredMessage ?? "AI summaries are not configured yet.",
        503
      ),
    };
  }

  if (AI_REQUIRE_SIGN_IN && !(await getSessionUserId())) {
    return { ok: false, response: jsonError("Sign in to use AI features.", 401) };
  }

  const retryAfter = rateLimit(
    options.route,
    clientIp(request),
    options.perMinute,
    options.perHour
  );
  if (retryAfter > 0) {
    return {
      ok: false,
      response: jsonError("Too many AI requests. Try again in a minute.", 429, {
        "Retry-After": String(retryAfter),
      }),
    };
  }

  const parsed = await readJsonBody(
    request,
    options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
  );
  if (!parsed.ok) return parsed;
  return { ok: true, config, body: parsed.body };
}

/** Metrics must be ≤40 simple keys mapping to finite numbers or short strings. */
export function sanitizeMetrics(
  raw: unknown
): Record<string, string | number> | string {
  if (!isRecord(raw)) return "Missing metrics.";
  const entries = Object.entries(raw);
  if (entries.length > MAX_METRICS) return "Too many metrics.";

  const metrics: Record<string, string | number> = {};
  for (const [key, value] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) return "Invalid metric name.";
    if (value === null) continue;
    if (typeof value === "number" && Number.isFinite(value)) {
      metrics[key] = value;
    } else if (typeof value === "string" && value.length <= MAX_METRIC_STRING) {
      const text = cleanText(value, MAX_METRIC_STRING);
      if (text) metrics[key] = text;
    } else {
      return "Invalid metric value.";
    }
  }
  return metrics;
}

function mapProviderError(status: number, errText: string): string {
  const lower = errText.toLowerCase();

  if (
    status === 429 ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("quota") ||
    lower.includes("resource exhausted") ||
    lower.includes("too many requests")
  ) {
    return "AI summary limit reached. Try again later or check your AI provider quota.";
  }

  if (status === 401 || (status === 403 && !lower.includes("quota"))) {
    return "AI authentication failed. Check AI_API_KEY on the server.";
  }

  if (
    status === 404 ||
    (lower.includes("model") && lower.includes("not found"))
  ) {
    return "AI model not found. Check AI_MODEL on the server.";
  }

  if (status >= 500) {
    return "The AI provider is temporarily unavailable. Try again in a few minutes.";
  }

  return "The AI provider returned an error. Try again in a moment.";
}

/** Calls the OpenAI-compatible chat endpoint. Never logs prompts or provider bodies. */
export async function callChatCompletion(
  config: AiConfig,
  route: string,
  params: {
    messages: { role: "system" | "user"; content: string }[];
    temperature: number;
    maxTokens: number;
    json?: boolean;
  }
): Promise<ProviderResult> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        ...(params.json ? { response_format: { type: "json_object" } } : {}),
        messages: params.messages,
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "unknown";
    console.error(`[${route}] provider request failed:`, name);
    return name === "TimeoutError" || name === "AbortError"
      ? { ok: false, status: 504, error: "The AI provider took too long to respond. Try again." }
      : { ok: false, status: 502, error: "Could not reach the AI provider. Try again later." };
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error(`[${route}] provider error status`, response.status);
    return { ok: false, status: 502, error: mapProviderError(response.status, errText) };
  }

  const data: unknown = await response.json().catch(() => null);
  const choices = isRecord(data) && Array.isArray(data.choices) ? data.choices : [];
  const message = isRecord(choices[0]) ? choices[0].message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  if (typeof content !== "string" || !content.trim()) {
    console.error(`[${route}] empty or unreadable AI response`);
    return { ok: false, status: 502, error: "AI returned an empty response. Try regenerating." };
  }
  return { ok: true, content };
}
