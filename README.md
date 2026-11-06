# drinks

A social drink tracker. Everyone gets a profile, logs what they drink, follows
friends, and competes on leaderboards.

**Features**

- **Sign in with Google or Apple** (Supabase Auth). First sign-in walks you through picking a username.
- **Detailed drink logs**: type, name, size, ABV, time, notes and a photo. Standard drinks are calculated automatically (US standard: 14 g of alcohol). Your recent drinks show up as one-tap "again?" buttons.
- **Public or private profiles**: each user chooses. Anyone can follow a public account. Following a private account sends a request the owner approves in Settings.
- **Feed** of drinks from people you follow, or everyone. Includes 🍻 cheers and comments.
- **Leaderboards** for 24 hours, 7 days, 30 days or all time, ranked by standard drinks, among friends or everyone.
- **Groups & events**: create one, share the invite link, log drinks to it, and get a group leaderboard and feed. Drinks logged to a group are visible to its members even if your account is private.
- **Personal stats**: totals, a 30-day chart, and a breakdown by drink type.

**Stack:** Next.js 15 (App Router) + Tailwind CSS 4 + Supabase (Postgres, Auth, Storage).
Every privacy rule is enforced in the database with row level security, so the
app can't leak a private user's drinks even through a bug in a page.

---

## Setup

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the contents of
   [`supabase/migrations/20261106000000_init.sql`](supabase/migrations/20261106000000_init.sql).
   Alternatively, with the Supabase CLI: `supabase link` then `supabase db push`.
   This creates the tables, security policies, the `drink-photos` storage bucket,
   and the leaderboard function.
3. Copy `.env.example` to `.env.local` and fill in the values from
   **Project Settings → API** (project URL and anon/publishable key).

### 2. Configure sign-in

In Supabase, go to **Authentication → URL Configuration**:

- **Site URL**: your production URL (e.g. `https://drinks.vercel.app`)
- **Redirect URLs**: add `http://localhost:3000/auth/callback` and
  `https://<your-domain>/auth/callback`

**Google** (Authentication → Providers → Google):

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an OAuth client ID (type *Web application*).
2. Add `https://<your-project-ref>.supabase.co/auth/v1/callback` as an
   authorized redirect URI.
3. Paste the client ID and secret into Supabase and enable the provider.

**Apple** (Authentication → Providers → Apple). This needs a paid Apple Developer account:

1. In [Apple Developer](https://developer.apple.com/account/resources/identifiers/list),
   create an App ID with *Sign in with Apple* enabled, then a **Services ID**
   (this is the client ID).
2. Configure the Services ID with your domain and the return URL
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. Create a **Key** with Sign in with Apple enabled and download the `.p8` file.
4. In Supabase, enter the Services ID, then generate the client secret from your
   Team ID, Key ID and `.p8` key (Supabase's Apple provider page explains this).
   Apple secrets expire after 6 months, so set a reminder to regenerate it.

### 3. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### 4. Deploy

Push to GitHub and import the repo in [Vercel](https://vercel.com). Add the two
`NEXT_PUBLIC_SUPABASE_*` environment variables, deploy, and add the production
`/auth/callback` URL to Supabase's redirect list.

---

## Project layout

```
supabase/migrations/   Database schema, security policies, leaderboard function
src/app/
  page.tsx             Landing page
  login/               Google / Apple sign-in
  auth/                OAuth callback + sign-out
  onboarding/          Pick username + privacy on first sign-in
  feed/                Following / everyone feed
  log/                 Log a drink (with photo upload)
  drinks/[id]/         Drink detail + comments
  u/[username]/        Profiles, follow / request
  leaderboard/         Leaderboards
  groups/              Groups & events, invite links
  stats/               Personal stats
  settings/            Edit profile, privacy, follow requests
  actions.ts           Server actions (follow, cheers, comments, groups…)
src/components/        Shared UI (drink card, stats chart, leaderboard…)
src/lib/               Supabase clients, types, drink presets and helpers
```

## Ideas for later

- Profile photo uploads (avatars currently come from Google/Apple)
- Notifications for cheers, comments and follow requests
- Editing a logged drink
- Optional safety features (estimated BAC, pace reminders)
