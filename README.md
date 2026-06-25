# IG Wrapped

A privacy-first Instagram data export intelligence dashboard. Upload your official Instagram data export ZIP and explore your social graph, DMs, activity eras, ads, security, and more — all processed locally in your browser.

Optional accounts let you save your full parsed analysis and LinkedIn Helper progress across devices with one click.

## Features

### Core dashboard

- **Overview** — High-level stats, export quality score, and data coverage
- **Network Manager** — Followers, following, mutuals, don't follow me back, blocked, restricted, and account detail drawer
- **Wrapped Insights** — Likes, comments, saves, stories, polls, quizzes, viewing activity, and content diet
- **Fun Stats** — DM awards, quirky metrics, and highlights
- **DMs** — Thread analytics, relationship insights, and optional AI summaries
- **Ads & Privacy** — Ad categories, advertisers, themed interests, click resistance, and privacy creep score
- **Security** — Login timeline, connected apps, health score, and suggested actions
- **LinkedIn Helper** — Manual Google search links for networking (no automation)
- **Export Data** — CSV exports and summary JSON, generated locally
- **Saved Analyses** — Optional cloud save of your full parsed snapshot (Supabase)

### Intelligence features

- **Social Graph** — Unified account model connecting follows, DMs, interactions, and LinkedIn status; cleanup priority scores; Real Ones leaderboards; account leaderboards
- **Account Detail Drawer** — Identity, follow relationship, timeline, DM connection, interactions, LinkedIn notes, and recommended actions (click any username across tabs)
- **Cleanup Score** — Smart unfollow priority beyond "don't follow me back" with protective keep signals
- **Real Ones** — Relationship strength scores and leaderboards (top friends, silent mutuals, longest connections, and more)
- **DM Wrapped** — Per-thread analytics: message share, reply times, active hours, late-night counts, and fun awards
- **Group Chat Wrapped** — Participant roles, message share, and anonymized participant labels
- **Instagram Eras** — Monthly activity timeline with era labels (DM peak, story watcher, doomscroll, follow spree, and more)
- **Content Diet** — Passive vs active ratio, engagement personality, doomscroll score, and ad resistance
- **Personality** — Instagram persona based on your full export with shareable summary cards
- **Search Wrapped** — Privacy-gated search history insights (collapsed by default with warning)
- **Data Explorer** — Detected JSON files, categories, export completeness, and optional raw preview
- **Export Completeness** — Export quality score (0–100) with missing categories and re-export tips
- **Shareable Cards** — Public-safe, network, DM, and ads/privacy summary cards (names hidden by default)
- **Optional AI Summaries** — User-triggered DM thread summaries via `/api/dm-summary` (Gemini/OpenAI-compatible)

### Advanced features (v4 insights)

- **Demo Mode** — Explore the full dashboard with synthetic fake data (`Try Demo Data` on upload). No real names or private info. Optional “Save demo analysis” to cloud.
- **Story Mode** — Spotify Wrapped–style slideshow from Overview (`View Story Mode`). Keyboard navigation, public-safe name toggle.
- **Presentation Mode** — Global toggle (top-right) hides sensitive names, DM previews, and search details across all tabs.
- **Compare Exports** — Data tab: upload an older ZIP or pick a saved analysis; see follower/following/DM deltas.
- **Since Last Save** — Overview card comparing current snapshot vs your previous cloud save.
- **Action Plan** — Prioritized recommendations with jump-to-tab actions (dismissible locally).
- **IG Health Scoreboard** — Social, network, privacy, DM energy, security, cleanup, and completeness scores with verdict.
- **AI Data Analyst Chat** — `/api/analysis-chat` answers questions from aggregated metrics only (no raw ZIP).
- **DM Heatmap** — Day × hour activity grid from export timestamps.
- **Reply Pattern Analyzer** — Fastest/slowest responder, ghost gaps, conversation starters (Fun Stats awards).
- **Network Clusters** — Social Graph groupings (DM friends, silent mutuals, cleanup candidates, etc.).
- **Unfollow Impact Preview** — Cleanup tab planning tool with projected follow-back ratio + CSV export.
- **Red / Green Flag Scanner** — Per-account signals in the account detail drawer.
- **Explain + Confidence** — Score explanations and high/medium/low confidence pills on key insights.
- **Share Cards** — Download PNG, copy stats, hide names globally via Presentation Mode or per-card toggle.

## Privacy-first, local-first

IG Wrapped is designed with privacy as the core principle:

- **No Instagram login** — Uses only your official data export ZIP
- **ZIP parsed locally** — JSZip parses JSON in your browser; the raw ZIP is never uploaded automatically
- **Optional cloud save** — Sign in only if you want to save your parsed analysis snapshot
- **No media upload** — Photos and videos from your export are never sent to the cloud
- **No scraping** — Does not access Instagram, LinkedIn, or any external API
- **No LinkedIn automation** — LinkedIn Helper only opens manual Google search links
- **DM privacy** — Message previews off by default; Presentation Mode hides names and sensitive details for sharing
- **AI summaries are opt-in** — DM text is only sent to the AI provider when you click Generate AI Summary for a thread
- **AI chat uses summaries only** — `/api/analysis-chat` receives aggregated metrics, not your raw ZIP or full DM history
- **Search history is sensitive** — Hidden in Presentation Mode; Search Wrapped requires explicit unlock

### What cloud save stores

When you click **Save full analysis**, IG Wrapped stores:

- Parsed dashboard data (network lists, wrapped insights, DM analytics, ads, security)
- Computed insights bundle (unified accounts, cleanup/real ones scores, DM awards, eras, content diet, personality, export completeness)
- LinkedIn Helper statuses and notes
- Generated AI summaries (if you created them)
- Export metadata and progress

It does **not** store:

- Your original ZIP or media files
- Full raw message history
- Raw search history (only sanitized summaries when applicable)
- API keys

Older saved analyses without the insights bundle will still load; re-upload and save again to unlock newer insights.

## Tech stack

- [Next.js](https://nextjs.org/) 16 (App Router)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Supabase](https://supabase.com/) — Optional auth & cloud save (`@supabase/supabase-js`, `@supabase/ssr`)
- [JSZip](https://stuk.github.io/jszip/) — ZIP parsing in the browser
- [Framer Motion](https://www.framer.com/motion/) — Animations
- [Recharts](https://recharts.org/) — Charts
- [Lucide React](https://lucide.dev/) — Icons
- [date-fns](https://date-fns.org/) — Date formatting
- [Vercel Analytics](https://vercel.com/analytics) — Deployment analytics

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and upload your Instagram export ZIP. The app works fully without signing in.

```bash
npm run build   # Production build
npm start       # Run production server
```

## Optional Supabase setup (cloud save)

Cloud save is optional. Without Supabase env vars, the app runs in local-only mode.

1. Copy `.env.local.example` to `.env.local`
2. Add your Supabase URL and anon key
3. Run `supabase/schema.sql` in the Supabase SQL Editor
4. Enable email/password auth
5. Restart the dev server

See **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** for the full step-by-step guide.

## How to get your Instagram export

1. Open Instagram or Meta Accounts Center
2. Go to **Your information and permissions**
3. Choose **Export your information**
4. Select your Instagram profile
5. Choose **Export to device**
6. Set **Date range** to **All time**
7. Set **Format** to **JSON**
8. Choose **All available information** for the best analytics coverage
9. Start the export and wait for Instagram to prepare the download
10. Download the ZIP and upload it to IG Wrapped

**Recommended:** All time · JSON · All available information · Export to device

## Limitations

- Only JSON files are parsed; media files are counted but not processed
- Export formats vary by region and Instagram version — some files may not parse
- Account leaderboards depend on Instagram including account names/URLs in activity JSON
- DM reply-time and hour/day analytics require local message text (stripped from cloud saves)
- Large exports may take a moment to process in the browser
- Cloud save stores parsed snapshots, not the original ZIP
- Personality and privacy scores are illustrative, based on Instagram's export — not scientific
- LinkedIn Helper requires manual review — it does not find profiles automatically
- Ads and privacy insights use phrasing like "Instagram's export suggests…" to avoid overclaiming

## Disclaimer

IG Wrapped is an independent tool and is not affiliated with Instagram, Meta, or LinkedIn. It does not scrape Instagram, require login credentials, scrape LinkedIn, or automate LinkedIn connection requests. Use your export data responsibly.

**Do not commit real Instagram export ZIPs to this repository.** The `.gitignore` excludes `*.zip`, `/private-data`, `/instagram-export`, `/data/private`, and `.env.local`.

## License

Private project — see repository owner for terms.
