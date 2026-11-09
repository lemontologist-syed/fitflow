# FitFlow

A personal fitness, diet and daily-routine app for iPhone Safari, installable on the Home Screen. It covers:

- a 4-week no-equipment home program (9 Nov – 5 Dec 2026) with a guided workout player,
- three planned meals (including the high-protein overnight oats),
- weight and progress tracking,
- an editable daily schedule,
- reminders sent by a server, so they arrive even when the app is closed.

| Part | Where it runs | Cost |
|---|---|---|
| App (Next.js 16 static export, React 19, TypeScript, Tailwind 4) | GitHub Pages: `https://lemontologist-syed.github.io/fitflow/` | free |
| Database, sign-in, reminder sender, scheduler | Supabase free project (Postgres + Auth + RLS + one Edge Function + pg_cron) | free, with limits (below) |
| Push delivery to iPhone | Apple Push Service (standard Web Push, VAPID) | free |

> **Status, honestly:** the code builds and the automated tests pass on Windows (see "What was tested"). Nothing has been tested on a physical iPhone, and no live server exists yet. You create the GitHub repository and the Supabase project yourself (steps below). Until you do, FitFlow runs in **local-only mode**: everything works except sync and closed-app reminders.

---

## Why there are two services

GitHub Pages only serves static files. It cannot store data, send pushes or run a clock. Reminders that must arrive when the app is closed need a server that wakes up every minute. That server is the free Supabase project:

```
pg_cron (every minute) ──► Edge Function "fitflow" ──► Apple/Google push service ──► iPhone
        │                         │  reads schedule, timezone, completions
        └── secrets in Vault      └─ writes notification_log (dedupe key = one send per occurrence)
iPhone app ◄── sync (RLS-protected tables) ──► Supabase Postgres
```

GitHub Actions cron is **not** used: GitHub does not run it on time to the minute.

---

## Folder contents

| Path | What it is |
|---|---|
| `docs/` | **The built website.** GitHub Pages publishes this folder. `docs/config.js` holds your server settings; `docs/exercise-videos.json` holds the exercise video links. |
| `src/` | App source (pages in `src/app`, logic in `src/lib`, UI in `src/components`) |
| `supabase/migrations/20261109000000_fitflow_schema.sql` | Database tables, indexes, Row Level Security |
| `supabase/setup_scheduler.sql` | Minute-level scheduler (pg_cron + pg_net + Vault) |
| `supabase/functions/fitflow/index.ts` + `_shared/` | Edge Function source (Deno) |
| `supabase/fitflow-function-single-file.ts` | The same function as one file, to paste into the Supabase Dashboard |
| `GENERATE_KEYS.bat` | Creates your VAPID keys and cron secret (double-click; needs Node.js) |
| `tests/unit`, `tests/e2e` | Vitest unit tests, Playwright browser tests |
| `public/config.js` | Template that is copied to `docs/config.js` on build |

---

## Part 1: Publish the app on GitHub Pages (≈10 min)

This works before any server exists (local-only mode).

1. Sign in to GitHub as **lemontologist-syed**. Click **+ → New repository**.
   - Repository name: **`fitflow`** (lowercase; the app expects the address `/fitflow/`).
   - Public. Do **not** add a README, .gitignore or licence. Click **Create repository**.
2. On the empty repository page, click **uploading an existing file**.
3. **Upload 1: the website.** Open the `Fitness` folder (`OneDrive\Saif files\PhD\App\Fitness`) in File Explorer and drag the **`docs` folder itself** onto the GitHub upload page. Wait until all files are listed, then click **Commit changes**.
   - GitHub accepts at most 100 files per upload. `docs` has about 90, so it fits in one upload.
   - Check that `docs/.nojekyll` is in the list. If it is missing: **Add file → Create new file**, name it `docs/.nojekyll`, leave it empty and commit. Without it, GitHub hides the `_next` folder and the app shows a blank page.
4. **Upload 2: the source (recommended backup).** Click **Add file → Upload files** again. Drag in everything else in `Fitness` **except** `docs`, `node_modules`, `.next`, `out`, `test-results` and `playwright-report`: the folders `src`, `supabase`, `scripts`, `tests`, `public` plus the loose files. Commit.
5. Turn on Pages: **Settings → Pages**.
   - Under **Build and deployment**, set **Source: Deploy from a branch**.
   - Set **Branch: `main`** and **Folder: `/docs`**, then click **Save**. (Last time the Save click was the step that got missed.)
6. Wait 1–3 minutes. A 404 is normal while Pages builds. Then open **https://lemontologist-syed.github.io/fitflow/**.

### Install on your iPhone

1. Open the address in **Safari**.
2. Tap **Share** (on iOS 26: the **•••** button first, then Share).
3. Tap **Add to Home Screen**, keep **Open as Web App** on, and tap **Add**.
4. Open FitFlow **from the Home Screen icon**. Do the setup guide there.

The installed app keeps its own storage, separate from Safari.

---

## Part 2: Server for sync and closed-app reminders (≈30 min, once)

You need: a Supabase account (free), Node.js on this PC (already installed) for the key generator, and the files in `Fitness\supabase`. Never paste a **secret** key into `config.js` or GitHub.

### 2.1 Create the Supabase project
1. Go to https://supabase.com, sign up and click **New project**.
   - Name `fitflow`. Choose a strong database password and keep it.
   - Region: **Northeast Asia (Seoul)**, or Tokyo.
   - Plan: Free.
2. When the project is ready, open **Project Settings → API Keys** (or **Data API**) and note:
   - the **Project URL**, e.g. `https://abcdefghijklmnop.supabase.co`,
   - the **Publishable key** (`sb_publishable_…`). This one is public. If you only see legacy keys, the **anon public** key also works.

### 2.2 Create the database tables
1. In the Dashboard, open **SQL Editor → New query**.
2. Paste the whole of `supabase/migrations/20261109000000_fitflow_schema.sql`.
3. Click **Run**. You should see "Success. No rows returned".

### 2.3 Create your login (single user)
1. Open **Authentication → Users → Add user → Create new user**.
2. Enter your email and a password, and tick **Auto Confirm User**.
3. Open **Authentication → Sign In / Providers** (or **Settings**) and turn **Allow new users to sign up** **off**. Now nobody else can create an account.

### 2.4 Generate your keys
1. Double-click **`GENERATE_KEYS.bat`**. It prints `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `CRON_SECRET`.
2. Keep the window open until you have finished 2.5–2.7. Nothing is saved to disk.

### 2.5 Deploy the Edge Function (no CLI needed)
1. Open **Edge Functions → Deploy a new function → Via Editor**.
2. Set the function name to exactly **`fitflow`**.
3. Delete the sample code, then paste the whole of `supabase/fitflow-function-single-file.ts`.
4. Click **Deploy function**.
5. In the function's **Details/Settings**, turn **Enforce JWT verification / Verify JWT** **off** if the toggle exists. The function checks every request itself. The scheduler also sends the public key, so it works even if the toggle is not there.
6. Open **Edge Functions → Secrets** and add these four, then click **Save**:

   | Key | Value |
   |---|---|
   | `VAPID_PUBLIC_KEY` | from the key window |
   | `VAPID_PRIVATE_KEY` | from the key window |
   | `VAPID_SUBJECT` | `mailto:` followed by your email, e.g. `mailto:you@example.com` |
   | `CRON_SECRET` | from the key window |

   `SUPABASE_URL` and the project keys are provided to the function automatically. Do not add them.

### 2.6 Start the minute scheduler
1. Open **SQL Editor → New query** and paste `supabase/setup_scheduler.sql`.
2. Replace `<PROJECT_URL>`, `<CRON_SECRET>` and `<PUBLISHABLE_KEY>` with your values, then click **Run**.
3. Check that it works one or two minutes later:
   ```sql
   select status_code, content, created from net._http_response order by created desc limit 5;
   ```
   You should see `200` with `{"ok":true,"users":0,...}`. If you see `403`, the CRON_SECRET in Vault and in the function secrets differ. If you see `401`, JWT verification is still on and the publishable key is wrong.

### 2.7 Connect the app to the server
1. On GitHub, open `docs/config.js` and click the pencil icon.
2. Fill in the three public values:
   ```js
   window.FITFLOW_CONFIG = {
     supabaseUrl: "https://abcdefghijklmnop.supabase.co",
     supabaseAnonKey: "sb_publishable_...",
     vapidPublicKey: "B....",   // the PUBLIC VAPID key only
   };
   ```
3. Click **Commit changes** and wait about 1 minute for Pages to update.
4. Also paste the same values into `Fitness\docs\config.js` on this PC, so a later upload does not overwrite them. Rebuilds keep a filled-in `docs/config.js`.

### 2.8 Turn on reminders on the iPhone
1. Open FitFlow from the Home Screen. If it does not pick up the change, close and reopen it.
2. Open **Settings → Account & sync** and sign in with the user from 2.3.
3. Open **Settings → Notifications** and tap **Enable notifications**, then allow the prompt.
4. Tap **Send test notification**. FitFlow reports success only after **your phone confirms it displayed** the notification. If the push service accepted it but the phone did not confirm, the screen says exactly that.
5. Set a **Clock** alarm for 7:00 AM as a backup. The guide is in the app.

### Optional: Supabase CLI instead of the Dashboard
```bash
npx supabase login
```
```bash
npx supabase link --project-ref <your-project-ref>
```
```bash
npx supabase db push
```
```bash
npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=...
```
```bash
npx supabase functions deploy fitflow --no-verify-jwt
```
Then run `supabase/setup_scheduler.sql` in the SQL Editor (step 2.6).

---

## Free-tier limits and costs (checked 9 Nov 2026 on supabase.com and docs.github.com)

- **Supabase Free pauses a project after about 7 days of low activity.** Opening FitFlow syncs, and that normally counts as activity: "a few user requests to the database each day" is enough. It is **not documented** whether the scheduler's own calls count. If you stop opening the app for a week, the project may pause and **reminders stop**. Supabase emails a warning first. To restore: Dashboard → your project → **Resume project** (possible for up to a year, data kept). Paid Supabase plans never pause (see supabase.com/pricing).
- **Supabase Free quotas:**
  - 500,000 Edge Function invocations a month. The scheduler uses about 44,600 (one call a minute).
  - 500 MB database, 5 GB egress, 2 active projects.
  - Edge Functions: 2 s CPU per request, 150 s wall clock.
  - pg_cron: up to 8 concurrent jobs, each under 10 minutes. FitFlow uses one every-minute job plus a daily cleanup.
- **Legacy `anon`/`service_role` keys** are being phased out by the end of 2026. Use the **publishable** key in `config.js`. The function prefers the new secret keys automatically.
- **GitHub Pages:** free, 1 GB site, 100 GB/month soft bandwidth.
- **Apple Push:** free. Payload ≤ 4 KB (FitFlow uses about 0.5 KB).
- **Expected cost: $0/month.**

---

## How reminders behave

- **Timing:** each routine item has a wall-clock time in your timezone (default Asia/Seoul). Every minute the server works out which occurrences are due, handling daylight saving correctly if you move to another region.
- **No duplicates:**
  - Every occurrence has a stable ID: `user + item + local date + time`.
  - The database allows each ID only once, so overlapping scheduler runs cannot send twice.
  - The push service's `Topic` header also collapses repeats.
- **Editing a time** (Test C):
  - The ID includes the time, so moving lunch from 12:30 to 13:00 makes the 12:30 occurrence impossible. 13:00 is sent once.
  - An edit made after an occurrence's time never fires a late reminder.
  - Edits reach the server within seconds while online. The Schedule screen shows "Reminder server is up to date ✓".
- **Done/Skipped items** are not reminded. Disabled reminders and weekday rules are respected; workout items run Monday–Saturday.
- **Late reminders are dropped:** if a reminder cannot be sent within 10 minutes of its time (server outage), it is skipped rather than arriving late. Pushes are kept by Apple for up to 30 minutes if the phone is offline.
- **Snooze:**
  - Tap a reminder to open FitFlow, then tap **Snooze** on the item. The server sends it again after 5–30 minutes; you choose the length in Settings → Notifications.
  - Snooze buttons inside the iOS notification itself are not provided, because iOS does not document notification action buttons for web apps.
- **Expired subscriptions:** a 404/410 reply from the push service disables that subscription automatically. Re-enable notifications from the phone. The app also re-saves its subscription on every sync.

## Exercise video links ("Watch how")

- Every exercise has a **Watch how** button, in the workout player and in each exercise's instructions. This includes warm-up, cooldown and the easier alternatives.
- The button opens YouTube (app or Safari). Videos are not embedded.
- **Where the links live:** `docs/exercise-videos.json`, a plain file next to `index.html`. Each entry has the video URL, its title and the channel.
- **Only checked videos are listed:** 27 of 31 exercises link to a specific video. Each was confirmed on 9 Nov 2026 via YouTube's oEmbed service to exist, with a title naming the exercise, from channels such as NASM, Well+Good, PureGym, Mass General, Hinge Health and NewYork-Presbyterian. The videos themselves were not watched. The other 4 (step jacks, side step taps, step-back burpee, slow climbers) had only small-channel videos, so their button opens a **YouTube search** instead.
- **Videos can disappear or change over time.** If a link stops working:
  1. On GitHub, open `docs/exercise-videos.json` and click the pencil icon.
  2. Replace the `url` with another `https://www.youtube.com/watch?v=...` link, or set the entry to `null` to use the search fallback.
  3. Commit. No rebuild is needed.
  4. Copy the same change into `Fitness\docs\exercise-videos.json` on this PC. A rebuild keeps an edited `docs` copy anyway.
- Only `youtube.com` and `youtu.be` links are accepted. Anything else falls back to search.

## What is a "notification" vs an "alarm"

| | FitFlow can do it? |
|---|---|
| **Push notification**, closed app, locked phone | **Yes**, on iOS 16.4+ from the Home Screen app, with internet |
| **Audible notification** (the normal notification sound, once) | Yes, unless Silent mode or a Focus silences it. No custom or louder sounds. |
| **Persistent alarm** that rings until dismissed | **No.** No web app can do this. |
| **Native Clock alarm** | **Not automatically.** FitFlow shows a step-by-step guide. Use it for waking up. |
| **Apple Calendar alerts** (fallback) | Yes, via the `.ics` export in Settings → Notifications |

---

## Real-iPhone test checklist (do these yourself; none has been done yet)

- [ ] **Install:** Safari → Share → Add to Home Screen → open from the icon. It opens full-screen with no Safari bars, and the bottom tabs sit above the Home indicator.
- [ ] **Test A, closed-app notification:**
  1. Settings → Daily schedule: set a test item 3–4 minutes ahead, with its reminder on.
  2. Swipe FitFlow away in the app switcher, then lock the phone.
  3. The notification arrives within about a minute of the time. Tapping it opens FitFlow on Today with that item highlighted.
- [ ] **Test B, restart:**
  1. Restart the iPhone and don't open FitFlow.
  2. The next scheduled reminder still arrives, because scheduling is on the server.
  3. Open FitFlow: your data is intact.
- [ ] **Test C, changed schedule:**
  1. Change lunch from 12:30 to 13:00 before 12:30.
  2. Nothing arrives at 12:30. Exactly one notification arrives at 13:00.
  3. Settings → Notifications → history shows a single lunch entry.
- [ ] **Test D, offline:**
  1. Turn on Airplane mode and open FitFlow.
  2. Today, Workout, Meals and Progress all open. Marking Done/Skip and logging a meal or weight work.
  3. Turn Airplane mode off: the changes sync. Check Settings → Account & sync: "everything uploaded".
- [ ] **Focus:** with Sleep Focus on, notifications are silenced unless FitFlow is added to the Focus allow list (Settings → Focus → Sleep → Apps).
- [ ] **Workout player:** start a session and check the countdown and rest timers, the beeps (Silent switch off), Pause/Resume and Save & exit → Resume.
- [ ] **Calendar fallback:**
  1. In Safari (not the Home Screen app), open `https://lemontologist-syed.github.io/fitflow/fitflow-routine.ics` and tap **Add All**.
  2. Check that one event shows an alert. Alert handling for imported files is not documented by Apple, so verify it.
- [ ] **Clock alarm:** set the 7:00 AM repeating alarm from the in-app guide.

## What was tested (automated, on Windows 11, 9 Nov 2026)

- **66 unit tests** (Vitest), all passing:
  - date/week calculation, progression for weeks 1–4, holding intensity after pain/fatigue/poor recovery;
  - calorie and protein maths (overnight oats ≈ 592 kcal, default day 1,862 kcal / 127 g);
  - timezone and DST (Seoul, New York gap and overlap, London, Kolkata), reminder selection, deduplication, Test C logic;
  - the scheduler with failing and expired subscriptions, snoozes and test notifications;
  - Web Push encryption, checked by decrypting with an independent library (`http_ece`), and VAPID ES256 signatures;
  - sync merge (last-write-wins, no duplicates, tombstones), `.ics` output and CSV/JSON export;
  - every exercise in every session resolves to a YouTube link, and non-YouTube or missing entries fall back to search;
  - **the real SQL migration running in PGlite (PostgreSQL in WebAssembly)**: Row Level Security (user A cannot read or write user B's rows, anonymous users are denied), constraints, last-write-wins trigger, notification deduplication, hidden receipt tokens, account-deletion cascade.
- **22 browser tests** (Playwright, production build; 2 Chromium-only cases are skipped in WebKit):
  - iPhone 15 size in **WebKit** (Safari's engine) and a Chromium phone: onboarding; Today states; persistence across reloads; navigation without horizontal scrolling; workout timer, pause, rest, rep counting, easier variant and resume; week-3 intensity by date; pain holding the next week; meal portions and totals; weight and chart; CSV and `.ics` downloads; honest notifications page.
  - Chromium only: offline launch through the service worker (Test D); sign-in and sync against a mocked Supabase API; the "new version → tap to update" flow.
- **Edge Function:**
  - type-checked with Deno 2.9;
  - its Web Push code run inside Deno and decrypted successfully;
  - the single-file version booted in Deno, with route checks confirmed: 403 without the cron secret, 401 without sign-in, 405 for GET, 400 for a bad receipt token.

**Not tested:**
- any physical iPhone or iOS Safari itself (Playwright's WebKit is close to Safari, but not the same);
- delivery through Apple's or Google's real push services;
- the function against a live Supabase project, real pg_cron timing, or the Dashboard deploy steps (written from Supabase's docs, not performed);
- importing alarms into Apple Calendar.

## Running it on a PC (for future changes)

Node.js 20.9+ is required. OneDrive syncing `node_modules` is slow, so copy the folder outside OneDrive first, e.g. to `C:\dev\fitflow`.

```bash
npm install
```
```bash
npm run dev
```
```bash
npm test
```
```bash
npm run build
```
```bash
npx playwright install chromium webkit
```
```bash
npm run test:e2e
```
`npm run build` writes the site to `out/` and copies it to `docs/`, keeping a filled-in `docs/config.js`. After changing anything in `supabase/functions`, run `npm run bundle:function` and redeploy the single file. `npm run preview` serves `out/` at http://localhost:4321/fitflow/.

## Privacy and security

- **Data storage:** your data lives on your phone (IndexedDB) and, if you set up the server, in **your own** Supabase project.
- **Access control:**
  - Every table has Row Level Security.
  - The anonymous key alone can read nothing.
  - Push subscriptions and notification history are visible only to their owner.
  - The receipt token column is not readable through the API.
- **Secrets:** they live only in Supabase (function secrets and Vault). `config.js` contains public values only.
- **Your data controls:** Settings → Your data offers JSON export and import, CSV export, clearing notification history, and **Delete all my data and account**, which deletes the auth user; every table cascades.
- **No tracking:** no analytics, ads or third-party trackers. The app asks for no device permission except notifications, and only after you tap.

## Limitations needing native iOS

- **Alarms:** an alarm that keeps ringing until dismissed, or that rings during Silent/Focus, needs the Clock app or a native app.
- **Clock integration:** creating or changing Clock alarms programmatically is not available to web apps.
- **Workout cues in the background:** cues stop when iOS suspends the app. Timers catch up when you return, and progress is saved. iPhone does not support vibration from web apps.
- **Delivery guarantees:** push is best-effort. It needs internet, is not to-the-second, and is affected by Focus, Scheduled Summary and Low Power Mode.
- **Separate storage:** the Home Screen app's storage is separate from Safari's. Sign in to sync between them.
- **Nutrition values are estimates.** The weight goal is shown as a direction, not a promise. The original 5 kg in 26 days is faster than the commonly advised 0.5–1 kg per week.
