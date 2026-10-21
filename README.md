# X Monitor — Smart Monitoring Dashboard for X (Twitter) Accounts and Hashtags

A dedicated, single-user dashboard for continuously monitoring X (Twitter) accounts, hashtags, keywords, and advanced search queries. It features an independent scheduler, AI-powered summarization and importance scoring (Gemini, OpenAI-compatible APIs, or OpenRouter), cost control with a Kill-Switch, and support for four data providers (free and paid).

> **Note:** The user interface is in Persian (Farsi) with RTL layout, Jalali (Solar Hijri) dates, and Persian AI output (summaries, translations, explanations).

---

## 1. Key Features

- **Four pluggable data providers (adapters):**
  1. `twscrape` — local sidecar using a dedicated account (**free, default**)
  2. `nitter-rss` — Nitter RSS feeds: public instances with rotation, or the bundled local Nitter container (**free, automatic fallback**)
  3. `x-official` — official X API v2 (pay-per-use)
  4. `twitterapi-io` — third-party twitterapi.io service (pay-per-item)
- **Server-side AI engine (Gemini / OpenAI / OpenRouter):**
  - Importance score from 0 to 10 with a short explanation
  - Fluent Persian translation of non-Persian posts
  - Sentiment analysis (positive / negative / neutral) and topic-tag extraction
  - Clustering of posts from the last 24 hours into shared events
  - Periodic and on-demand analytical digests as short bullet points, one blank line between bullets
  - Digests skip posts and news already covered by earlier digests (toggle in Settings); posts that made it into a digest carry an "In digest" tag in the feed
  - Configurable look-back window for digests and clustering (hours)
  - Prompt-injection defenses
  - The AI provider, model, and API keys can be changed from the Settings page; environment variables act as defaults
- **Built-in scheduler:**
  - Configurable polling intervals in minutes and hours (15m, 30m, 1h, ...)
  - Schedule inheritance: global settings → topic group → individual source
  - Automatic per-provider minimum intervals (provider floors) to avoid account lockouts
  - Random jitter (±20%) to avoid synchronized polling
  - Active hours, days, and timezones
  - "Poll now" and "Dry Run" buttons with cost comparison
- **Telegram notifications (configured entirely from the admin panel):**
  - Alerts and digests go to one or many recipients: your own user ID, groups, or `@channels`
  - Bot token, recipient list, on/off switches, and a "send test message" button live in Settings
  - The bot answers `/id` with your numeric ID, so finding the right chat ID takes seconds
- **Cost control:**
  - Separate monthly budget caps per provider and for the whole system
  - Kill-Switch that halts polling when a budget cap is reached
  - Detailed logging of every call, tweet count, and dollar cost
- **Modern RTL Persian UI:**
  - Vazirmatn font
  - Jalali dates with Gregorian dates in tooltips
  - Keyboard shortcuts (`j`/`k` navigate, `m` mark read, `b` bookmark, `o` open in X, `/` search)
  - Real-time updates (SSE) and browser tab title changes for new posts
  - CSV and JSON export

---

## 2. Quick Start with Docker Compose (Recommended)

The project consists of two cooperating containers:
1. `app`: the full-stack Node.js 22 + React application
2. `scraper`: a Python 3.12 sidecar running FastAPI and `twscrape`, reachable only on the internal Docker network (no port exposed to the host)

```bash
# 1. Clone the project and enter the directory
git clone <repo_url>
cd xmonitor

# 2. Create the environment file
cp .env.example .env

# 3. Generate a hashed admin password
npm run hash-password your_secure_password
# Put the output in ADMIN_PASSWORD_HASH in .env

# 4. Start all services
docker compose up -d --build
```

Once the containers are up, the dashboard is available at `http://localhost:3000` (set `PORT=1009` in `.env` to use another host port).

Four containers run: `app`, `scraper`, `nitter`, `nitter-redis` (see sections 3-4). The image installs dependencies with `npm install --legacy-peer-deps` (the repo has no lockfile).

> **Server recommendation:** Run the app on a VPS outside Iran whose datacenter IP is not blocked by Cloudflare/X.

---

## 3. Extracting Cookies for the Dedicated Account (`twscrape`)

The default `twscrape` provider fetches tweets without an official API key, but it needs an X account (preferably a burner/test account).

1. Log in to your dedicated account at `https://x.com` in your browser.
2. Press `F12` to open Developer Tools.
3. Go to the **Application** tab (**Storage** in Firefox).
4. In the left sidebar, expand **Cookies** and select `https://x.com`.
5. Copy these two values:
   - `auth_token`: a string of roughly 40 characters
   - `ct0`: the CSRF token, roughly 160 characters
6. In the dashboard menu, open **Scraper Accounts** (حساب‌های اسکرپر), click **Add Account**, and enter the values.

> **Security note:** These cookies are sent directly to the sidecar and are never stored in the Node database or logs.

---

## 4. Configuring the Nitter RSS Provider

### Option A: bundled local Nitter (recommended)

`docker-compose.yml` ships a self-hosted Nitter (plus Redis) that is reachable only from the app at `http://nitter:8080`. Since 2024 Nitter needs a real X account session:

1. Open **Settings → Local Nitter (Docker)**.
2. Enter the username, the `twid` cookie (e.g. `u%3D123456789`, or just the numeric user ID), `auth_token`, and `ct0` of a dedicated/burner account (cookies come from F12 → Application → Cookies → `x.com`, as in section 3). Passwords are never needed.
3. Click **Add account**. The panel writes a sessions file to a shared volume and the Nitter container restarts itself within seconds.
4. **Check Nitter status** verifies that it serves RSS.

Once at least one session exists, the local instance is used automatically and first.

### Option B: public instances

Public Nitter instances are free and need no account, but most are unreliable. Edit the list in **System Settings**:

```text
https://nitter.privacydev.net
https://nitter.poast.org
https://nitter.projectsegfau.lt
```

The system health-checks the instances and removes a failing one from rotation for up to 1 hour. Plain `http://` URLs are accepted only for local/Docker-network hosts (for example `http://nitter:8080`).

---

## 5. Setting Up Telegram

Everything is configured in **Settings → Telegram Notifications**; no `.env` edit is needed.

1. Create a bot with [@BotFather](https://t.me/BotFather) (`/newbot`) and copy the token into the panel.
2. Send `/id` to your bot in Telegram. It replies with your numeric user ID. For a group, add the bot to the group and send `/id` there to get the group ID (a negative number).
3. Enter the IDs in **Recipient chat IDs**, one per line or comma-separated. Use numeric IDs (usernames of people do not work; `@channel` works if the bot is an admin there).
4. Press **Send test message**, then **Save**.

Alerts (rules with the Telegram channel enabled) and every generated digest are sent to all recipients. A failure for one recipient does not block the others. Each person must have started the bot (`/start` or `/id`) before it can message them.

The bot listens with long polling, so no public URL is required. A token can only be polled by one program; if the same bot has a webhook elsewhere, polling fails with a 409 error (visible in the server log).

---

## 6. Environment Variables (`.env`)

| Variable | Required | Description |
| :--- | :---: | :--- |
| `PORT` | No | Server port (default: 3000); with Docker Compose it is the host port |
| `DATABASE_PATH` | No | Path to the SQLite database file |
| `ADMIN_USERNAME` | Yes | Admin username (default: `admin`) |
| `ADMIN_PASSWORD_HASH` | Yes | scrypt hash of the admin password, generated with `npm run hash-password` |
| `SESSION_SECRET` | Yes | Session encryption key (at least 32 characters) |
| `GEMINI_API_KEY` | Yes* | Google Gemini API key (default AI provider) |
| `OPENAI_API_KEY` | No | API key for OpenAI or any OpenAI-compatible endpoint |
| `OPENAI_BASE_URL` | No | Base URL for the OpenAI-compatible API (default: `https://api.openai.com/v1`) |
| `OPENAI_MODEL` | No | OpenAI model name (default: `gpt-4o-mini`) |
| `OPENROUTER_API_KEY` | No | OpenRouter API key |
| `OPENROUTER_MODEL` | No | OpenRouter model name (default: `openai/gpt-4o-mini`) |
| `SIDECAR_URL` | Yes | Sidecar URL (in Docker: `http://scraper:8000`) |
| `SIDECAR_SHARED_SECRET` | Yes | Shared authentication secret between Node and the Python sidecar |
| `X_BEARER_TOKEN` | No | Official X API v2 bearer token |
| `TWITTERAPI_IO_KEY` | No | twitterapi.io API key |
| `TELEGRAM_BOT_TOKEN` | No | Fallback only: the token is normally set in Settings, which takes priority |
| `TELEGRAM_CHAT_ID` | No | Fallback only: recipients are normally set in Settings (comma-separated list supported) |
| `NITTER_HMAC_KEY` | No | Signing key for the bundled Nitter's media URLs (change the default) |
| `TZ` | No | Default timezone (default: `Asia/Tehran`) |

\* Required only when Gemini is the selected AI provider. If you use OpenAI or OpenRouter, set the matching key instead (or enter it in Settings).

> **Docker note:** `docker-compose.yml` only forwards the variables listed in its `environment` section to the `app` container. To use the OpenAI/OpenRouter variables via `.env`, add them there, or configure the AI provider from the Settings page instead.

---

## 7. Local Development

```bash
# Install dependencies (the repo has no lockfile and has peer-dependency conflicts)
npm install --legacy-peer-deps

# Run the logic tests
npm test

# Type-check
npm run lint

# Start the dev server (Node Express + Vite middleware)
npm run dev
```

To build the frontend for production: `npm run build`, then `npm start`.

---

## 8. Adding a New Data Provider (Custom Provider)

To add a new provider to the system:
1. Create a new file in `server/providers/` (for example `my-provider.ts`).
2. Implement the `DataProvider` interface from `server/providers/types.ts`:
   - `resolveAccount(username)`
   - `fetchNew(source, state)`
   - `healthCheck()`
   - `estimateCost(usage)`
3. Register your class in the `ProviderRegistry` constructor in `server/providers/index.ts` (`this.register(new MyProvider())`).
4. The provider name immediately appears in Settings and the source-selection menu, with no changes needed elsewhere in the app.
