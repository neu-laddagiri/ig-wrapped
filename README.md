# IG Wrapped

A privacy-first Instagram data export analyzer. Upload your official Instagram data export ZIP and explore followers, activity, ads, messages, and security history — all processed locally in your browser.

Optional accounts let you save your full parsed analysis and LinkedIn Helper progress across devices with one click.

## Features

- **Network Manager** — Followers, following, mutuals, don't follow me back, blocked, restricted, and more
- **Wrapped Insights** — Likes, comments, saves, stories, polls, quizzes, and viewing activity
- **DM Analytics** — Thread and message counts without exposing message content
- **Ads & Privacy** — Ad impressions, clicks, advertisers, and ad categories
- **Security** — Login, logout, profile, and password change activity
- **LinkedIn Helper** — Manual Google search links for networking (no automation)
- **Export Data** — CSV exports and summary JSON, generated locally
- **Saved Analyses** — Optional cloud save of your full parsed snapshot (Supabase)
- **Data Coverage** — See which categories were detected in your export

## Privacy-first, local-first

IG Wrapped is designed with privacy as the core principle:

- **No Instagram login** — Uses only your official data export ZIP
- **ZIP parsed locally** — JSZip parses JSON in your browser; the raw ZIP is not uploaded
- **Optional cloud save** — Sign in only if you want to save your parsed analysis snapshot
- **No media upload** — Photos and videos from your export are never sent to the cloud
- **No scraping** — Does not access Instagram, LinkedIn, or any external API
- **No LinkedIn automation** — LinkedIn Helper only opens manual Google search links
- **DM privacy** — Message text is never shown; only analytics are computed

### What cloud save stores

When you click **Save full analysis**, IG Wrapped stores:

- Parsed dashboard data (network lists, insights, DM analytics, ads, security)
- LinkedIn Helper statuses and notes
- Export metadata and progress

It does **not** store your original ZIP or media files.

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
8. Choose media quality (Low/Medium is faster; High includes larger media)
9. Start the export and wait for Instagram to prepare the download
10. Download the ZIP and upload it to IG Wrapped

**Recommended:** All time · JSON · Export to device · Any media quality

## Limitations

- Only JSON files are parsed; media files are counted but not processed
- Export formats vary by region and Instagram version — some files may not parse
- Large exports may take a moment to process in the browser
- Cloud save stores parsed snapshots, not the original ZIP
- Personality and privacy scores are illustrative, not scientific
- LinkedIn Helper requires manual review — it does not find profiles automatically

## Disclaimer

IG Wrapped is an independent tool and is not affiliated with Instagram, Meta, or LinkedIn. It does not scrape Instagram, require login credentials, scrape LinkedIn, or automate LinkedIn connection requests. Use your export data responsibly.

**Do not commit real Instagram export ZIPs to this repository.** The `.gitignore` excludes `*.zip`, `/private-data`, `/instagram-export`, `/data/private`, and `.env.local`.

## License

Private project — see repository owner for terms.
