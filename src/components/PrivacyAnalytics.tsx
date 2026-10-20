"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/** Drop query strings (e.g. Supabase auth ?code=…) before page views are sent. */
function stripQuery(event: BeforeSendEvent): BeforeSendEvent {
  return { ...event, url: event.url.split(/[?#]/)[0] };
}

export function PrivacyAnalytics() {
  return <Analytics beforeSend={stripQuery} />;
}
