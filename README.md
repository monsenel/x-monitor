# X Monitor — Smart Monitoring Dashboard for X (Twitter) Accounts and Hashtags

A dedicated, single-user dashboard for continuously monitoring X (Twitter) accounts, hashtags, keywords, and advanced search queries. It features an independent scheduler, AI-powered summarization and importance scoring (Gemini, OpenAI-compatible APIs, or OpenRouter), cost control with a Kill-Switch, and support for four data providers (free and paid).

> **Note:** The user interface is in Persian (Farsi) with RTL layout, Jalali (Solar Hijri) dates, and Persian AI output (summaries, translations, explanations).

---

## 1. Key Features

- **Four pluggable data providers (adapters):**
  1. `twscrape` — local sidecar using a dedicated account (**free, default**)
  2. `nitter-rss` — public Nitter RSS feeds with server rotation (**free, automatic fallback**)
  3. `x-official` — official X API v2 (pay-per-use)
  4. `twitterapi-io` — third-party twitterapi.io service (pay-per-item)
- **Server-side AI engine (Gemini / OpenAI / OpenRouter):**
  - Importance score from 0 to 10 with a short explanation
  - Fluent Persian translation of non-Persian posts
  - Sentiment analysis (positive / negative / neutral) and topic-tag extraction
  - Clustering of posts from the last 24 hours into shared events
  - Periodic and on-demand analytical digests
  - Prompt-injection defenses
  - **Configured entirely from the admin panel** (Settings → AI Configuration): choose the provider (Gemini / OpenAI-compatible / OpenRouter), model, base URL, and API key, with presets for OpenAI, Groq, DeepSeek, and Ollama and a built-in "Test AI Connection" button. Environment variables are optional fallbacks only
- **Built-in scheduler:**
  - Configurable polling intervals in minutes and hours (15m, 30m, 1h, ...)
  - Schedule inheritance: global settings → topic group → individual source
  - Automatic per-provider minimum intervals (provider floors) to avoid account lockouts
  - Random jitter (±20%) to avoid synchronized polling
  - Active hours, days, and timezones
  - "Poll now" and "Dry Run" buttons with cost comparison
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

Once the containers are up, the dashboard is available at `http://localhost:3000`.

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

Public Nitter instances are completely free and require no account. You can edit the server list in **System Settings**:

```text
https://nitter.privacydev.net
https://nitter.poast.org
https://nitter.projectsegfau.lt
```

The system automatically health-checks the instances and removes a failing instance from rotation for up to 1 hour.

---

## 5. Environment Variables (`.env`)

| Variable | Required | Description |
| :--- | :---: | :--- |
| `PORT` | No | Server port (default: 3000) |
| `DATABASE_PATH` | No | Path to the SQLite database file |
| `ADMIN_USERNAME` | Yes | Admin username (default: `admin`) |
| `ADMIN_PASSWORD_HASH` | Yes | scrypt hash of the admin password, generated with `npm run hash-password` |
| `SESSION_SECRET` | Yes | Session encryption key (at least 32 characters) |
| `GEMINI_API_KEY` | No* | Fallback Google Gemini API key (default AI provider) |
| `OPENAI_API_KEY` | No* | API key for OpenAI or any OpenAI-compatible endpoint |
| `OPENAI_BASE_URL` | No | Base URL for the OpenAI-compatible API (default: `https://api.openai.com/v1`) |
| `OPENAI_MODEL` | No | OpenAI model name (default: `gpt-4o-mini`) |
| `OPENROUTER_API_KEY` | No* | OpenRouter API key |
| `OPENROUTER_MODEL` | No | OpenRouter model name (default: `openai/gpt-4o-mini`) |
| `SIDECAR_URL` | Yes | Sidecar URL (in Docker: `http://scraper:8000`) |
| `SIDECAR_SHARED_SECRET` | Yes | Shared authentication secret between Node and the Python sidecar |
| `X_BEARER_TOKEN` | No | Official X API v2 bearer token |
| `TWITTERAPI_IO_KEY` | No | twitterapi.io API key |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token for sending alerts |
| `TELEGRAM_CHAT_ID` | No | Telegram chat or channel ID for notifications |
| `TZ` | No | Default timezone (default: `Asia/Tehran`) |

\* AI settings are configured from the admin panel (Settings → AI Configuration), and values saved there take priority. The AI-related environment variables are only used as fallbacks when nothing is set in the panel.

---

## 6. Local Development

```bash
# Install dependencies
npm install

# Run the logic tests
npm test

# Type-check
npm run lint

# Start the dev server (Node Express + Vite middleware)
npm run dev
```

To build the frontend for production: `npm run build`, then `npm start`.

---

## 7. Adding a New Data Provider (Custom Provider)

To add a new provider to the system:
1. Create a new file in `server/providers/` (for example `my-provider.ts`).
2. Implement the `DataProvider` interface from `server/providers/types.ts`:
   - `resolveAccount(username)`
   - `fetchNew(source, state)`
   - `healthCheck()`
   - `estimateCost(usage)`
3. Register your class in the `ProviderRegistry` constructor in `server/providers/index.ts` (`this.register(new MyProvider())`).
4. The provider name immediately appears in Settings and the source-selection menu, with no changes needed elsewhere in the app.
