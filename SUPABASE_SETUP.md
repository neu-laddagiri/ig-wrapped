# Supabase setup for IG Wrapped

Optional cloud save lets signed-in users store a **parsed analysis snapshot** and LinkedIn Helper progress. Raw ZIP files and media are never uploaded. The snapshot does include some private data (thread names, sampled DM messages, top search terms) — see [What gets saved](#what-gets-saved).

## 1. Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Choose an organization, name, database password, and region.
4. Wait for the project to finish provisioning.

## 2. Get your project credentials

1. Open your project in the Supabase dashboard.
2. Go to **Project Settings** → **API**.
3. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> Use only the **anon** public key in this app. Never put the **service_role** key in client code or commit it to git.

## 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Replace both values with your own. Placeholder values, or a URL that isn't a valid `http(s)://` URL, keep the app in **Local Mode** instead of failing.

## 4. Run the database schema

1. In Supabase, open **SQL Editor**.
2. Click **New query**.
3. Paste the full contents of `supabase/schema.sql`.
4. Click **Run**.

This creates:

- `profiles` table with RLS
- `saved_analyses` table with RLS
- Auto-profile trigger on sign up
- `updated_at` trigger on saved analyses
- Limits: each snapshot must be under 20 MB, and each user can keep up to 50 saved analyses

The script is safe to re-run on an existing project — policies, constraints and triggers are dropped and recreated.

## 5. Enable email/password auth

1. Go to **Authentication** → **Providers**.
2. Ensure **Email** is enabled.
3. Under **Authentication** → **URL Configuration**, add your site URL:
   - Local: `http://localhost:3000`
   - Production: your deployed domain

For local development, you can disable email confirmation under **Authentication** → **Providers** → **Email** if you want instant sign-up during testing. With confirmation on, sign-up shows "Check your email to confirm your account" and the user signs in after clicking the link.

Password reset links redirect to your site root (`/`), so the site URL must be in the allowed redirect URLs. Opening the link shows a **Set a new password** form. It must be opened in the same browser that requested the reset.

## 6. Restart the dev server

```bash
npm run dev
```

Environment variables are loaded at startup. Restart after changing `.env.local`.

## 7. Test the flow

1. Open [http://localhost:3000](http://localhost:3000) — app should load in **Local Mode** without Supabase if env vars are missing.
2. With env vars set, click **Sign in** → create an account.
3. Upload an Instagram export ZIP (parsed locally).
4. Click **Save full analysis**.
5. Open **Saved Analyses** tab → verify the entry appears.
6. Click **Load** → dashboard restores without re-uploading the ZIP.
7. Click **Delete** → entry is removed from your account.

## What gets saved

| Saved | Not saved |
|-------|-----------|
| Follower/following/mutual lists, blocked & restricted accounts | Original ZIP file |
| Wrapped activity counts and computed insights (scores, eras, leaderboards) | Media files (photos/videos) |
| DM thread stats and per-sender counts — real names only if "Show thread names" is on; otherwise anonymized ("Person 1, 2…") | Full DM message histories |
| Up to 100 masked DM messages per thread — **only with the explicit opt-in** at save time, for later AI summaries | Raw search terms and searched accounts |
| First-message previews — only if you turned previews on before saving | Export file paths |
| Search totals and timeline | Login IP addresses, locations and devices |
| Ad interests and advertiser names | Instagram login credentials |
| Security event types and dates (login, logout, password and privacy changes) | AI provider API keys |
| LinkedIn Helper statuses & notes | |
| Generated AI summaries | |
| Active tab & DM privacy toggles | |

## Troubleshooting

### "Cloud save is not configured yet"

- `.env.local` is missing or has placeholder values.
- Restart `npm run dev` after adding env vars.

### "Your session expired"

- Sign out and sign in again.

### RLS / permission errors

- Re-run `supabase/schema.sql` in the SQL Editor (safe to run more than once).
- Confirm you are signed in as the same user who created the row.

### "too large to save" / "up to 50 saved analyses"

- Each snapshot must be under 20 MB, and each account can keep 50 saved analyses. Delete older saves, or adjust the limits in `supabase/schema.sql`.

### Email confirmation required

- Check your inbox for the Supabase confirmation link, or disable confirmations for local testing.

## Security notes

- Row Level Security (RLS) ensures users only access their own rows.
- Snapshots are stored as plain JSON, so anyone with admin access to the Supabase project (dashboard or service role key) can read them.
- Only the anon key is used in the browser.
- No service role key is required for this app.
- Do not commit `.env.local` or real export ZIPs to git.
