/** Map API/technical errors to user-friendly copy. Logs raw message when provided. */
export function friendlyAiError(
  raw: string | undefined | null,
  context: "summary" | "recap" | "chat" = "summary"
): string {
  const msg = (raw ?? "").toLowerCase();

  if (process.env.NODE_ENV === "development" && raw) {
    console.warn(`[AI ${context}]`, raw);
  }

  if (!raw?.trim()) {
    return context === "chat"
      ? "AI chat is unavailable right now. Try again later."
      : "Could not generate summary. Try again later.";
  }

  if (msg.includes("too many ai requests")) {
    return "You're sending AI requests too quickly. Wait a minute and try again.";
  }

  if (msg.includes("too large")) {
    return "This request is too large for AI processing.";
  }

  if (msg.includes("sign in")) {
    return "Sign in to use AI features.";
  }

  if (msg.includes("took too long") || msg.includes("timed out")) {
    return "The AI provider took too long to respond. Try again.";
  }

  if (
    msg.includes("temporarily unavailable") ||
    msg.includes("could not reach")
  ) {
    return "The AI provider is unavailable right now. Try again in a few minutes.";
  }

  if (
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("429") ||
    msg.includes("insufficient_quota") ||
    msg.includes("billing")
  ) {
    return "AI summary limit reached. Try again later or check your API billing.";
  }

  if (
    msg.includes("api key") ||
    msg.includes("api_key") ||
    msg.includes("not configured") ||
    msg.includes("openai_api") ||
    msg.includes("missing key")
  ) {
    return "AI summaries are not configured yet.";
  }

  if (
    msg.includes("model") ||
    msg.includes("provider") ||
    msg.includes("404") ||
    msg.includes("invalid_request")
  ) {
    return "AI provider settings need to be checked.";
  }

  if (
    msg.includes("json") ||
    msg.includes("parse") ||
    msg.includes("unexpected token") ||
    msg.includes("format")
  ) {
    return "AI response could not be formatted. Try regenerating.";
  }

  if (msg.includes("network") || msg.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  return context === "chat"
    ? "AI chat hit a snag. Try again in a moment."
    : "Could not generate summary. Try again later.";
}
