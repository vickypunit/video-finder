# Video Finder

Type a product name, paste a product link, or upload a product photo. The app reads the product (title, text, main
image), works out what it looks like, then collects at least **20 Instagram Reels** and **20 Meta Ad Library videos**,
compares their thumbnails with the product photo, scores each video 0 to 100 with a written reason, removes anything
you have already seen, and shows the result in a dashboard. Search the same product again and you get new videos.

* Backend: Node.js 22.13+ (Express, built-in `node:sqlite`, zod, pino, cheerio)
* Frontend: Next.js 14 (App Router, React), a CRM-style dashboard
* Image analysis: Anthropic Messages API (vision), see "Why this image brain"

## Setup

```bash
# 1. backend
cd backend
cp .env.example .env        # PROVIDER_MODE=mock works with no keys
npm install
npm test                    # 52 tests
npm run dev                 # http://localhost:4000

# 2. frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

Windows CMD: use `copy .env.example .env` instead of `cp`.

**One command with Docker:** `docker compose up --build`, then open http://localhost:3000. Without `backend/.env` it
starts in mock mode. (Docker files are included as a bonus; please report if your Docker version needs a tweak.)

**Mock vs live.** With `PROVIDER_MODE=mock` every collector returns deterministic videos marked "sample data", their
links are disabled and their visual scores are simulated (and labelled as such), so you can develop and run the tests
without keys. Set `PROVIDER_MODE=live` and fill in the keys in `backend/.env` for real results. Use live mode for the demo
and the test evidence: `node scripts/evidence.js "product 1" "https://shop/product-2" ...` writes `docs/TEST_EVIDENCE.md`.

## Architecture

```
Search input (name | link | photo)
      -> POST /api/search  -> job queue (202 + job id)  -> SSE progress + GET /api/search/:id
              |
   Product resolver -> Image brain -> [Instagram | Meta Ad Library | TikTok (optional)]   (parallel, retries, timeouts)
                                              |
        Search history (seen IDs) -> De-dup -> Visual match (photo vs thumbnails) -> Scoring -> React dashboard
```

| Piece | File |
|---|---|
| URL validation / SSRF guard | `backend/src/utils/urlGuard.js`, `safeFetch.js` |
| Product resolver (+ page cache) | `backend/src/services/productResolver.js` |
| Image brain (+ analysis cache) | `backend/src/services/imageBrain.js` |
| Visual match | `backend/src/services/visualMatch.js`, `thumbnails.js` |
| Collectors | `backend/src/collectors/*.js` |
| De-dup | `backend/src/services/dedup.js` |
| Scoring | `backend/src/services/scoring.js` |
| Orchestration, retries, deadlines | `backend/src/services/pipeline.js`, `utils/retry.js` |
| Background jobs + progress | `backend/src/services/jobs.js` |
| History (SQLite) | `backend/src/db.js` |
| API | `backend/src/app.js` |

### API

| Route | What it does |
|---|---|
| `POST /api/search` | Body `{ input?, image?, sources }`. Validates, queues a job, answers **202** `{ jobId }` at once. `image` is an optional `data:image/...;base64,` photo (max 1.5 MB). |
| `GET /api/search/:id` | Job status, stage, progress events and, when done, the full result. |
| `GET /api/search/:id/events` | **SSE** stream of `progress` events, then `done` or `error`. |
| `GET /api/history`, `GET /api/history/:id` | Earlier searches and their results. |
| `GET /api/history/:id/previous` | Videos from earlier searches of the same product (powers "Show previously seen"). |
| `DELETE /api/history` | Clears history, seen IDs and cursors. |

The browser only talks to Next.js; `/api/*` is proxied to the backend (`next.config.mjs`, compression off so SSE is not
buffered), so there is no CORS setup and no secret ever reaches the browser. The dashboard follows a job over SSE and also
polls it once a second, so progress and the result still arrive if some proxy buffers the stream.

The queue is in-process (`jobs.js`, concurrency `JOB_CONCURRENCY`). For several instances it would be swapped for
BullMQ/Redis; the submit / get / subscribe interface stays the same.

## How each video source is collected, and why

I chose **official APIs** for both required sources: they are stable, they do not need anyone's login, and they keep
the project inside each platform's terms. The trade-off is coverage, see "Known limitations".

* **Instagram Reels** - Instagram Graph API hashtag search (`ig_hashtag_search`, then `recent_media`). Items with
  `media_type = VIDEO` are kept. Hashtags come from the image brain. Needs an Instagram Business/Creator account linked to
  a Facebook app (`IG_USER_ID`, `IG_ACCESS_TOKEN`).
* **Meta Ad Library** - `ads_archive` searched with the brain's queries, countries from `META_AD_COUNTRIES`. The API returns
  a snapshot page per ad, not a video file, so each result links to the snapshot. The `access_token` Meta embeds in
  `ad_snapshot_url` is stripped before anything leaves the server.
* **TikTok (optional)** - TikTok Research API, off unless `TIKTOK_ENABLED=true`; the UI toggle is hidden when it is off and
  it never blocks the two required sources.

### Rate limits, blocked requests, login walls, missing data

* Every page request has a timeout (`PAGE_TIMEOUT_MS`) and up to `COLLECTOR_RETRIES` retries with exponential back-off, but
  **only for errors that can succeed next time** (network errors, timeouts, 5xx). Rate-limit responses, bad tokens and
  4xx are not retried.
* A rate limit stops that source cleanly: the dashboard says "rate limit reached, try again later" and keeps whatever was
  already collected. Each source also has an overall deadline (`SOURCE_TIMEOUT_MS`).
* Sources run in parallel and fail independently. A broken Meta token never removes the Instagram results.
* No logins, no cookies, no scraping of login-walled pages. If credentials are missing the source reports that in the UI.
* **Fewer than 20 usable videos:** after de-dup the pipeline keeps pulling pages (the brain's queries and hashtags, then
  deeper pagination, up to `MAX_PAGES_PER_SOURCE`). If it still cannot reach 20, the source shows "Below minimum" with the
  real count and a plain-language hint. The list is never padded and nothing fails silently.
* Missing fields (no caption, no creator, no thumbnail) never crash the pipeline; those videos simply score on what exists.

## Why this image brain, and how it works

**Choice:** a vision-language model (Claude) instead of image embeddings. The task needs two things: *understanding* the
product (type, colour, print, logo, text, shape) to write good queries per platform, and *judging* whether a thumbnail shows
that product, with a reason a person can read. A vision-language model does both in one API, needs no GPU or index, and
explains itself ("same print and colour, worn by a model"). CLIP-style embeddings are cheaper per image and faster, and
would be my next step for ranking at scale (see below), but they cannot say why.

1. **Resolve.** Title, description, brand and main image come from JSON-LD `Product`, Open Graph or plain HTML. A name has no
   image; an uploaded photo is used as the reference (and wins over the page image).
2. **Understand.** The photo and text go to the model, which returns JSON: product name, a one-sentence visual summary,
   category, attributes (colour, material, style, shape, use case, brand), keywords, hashtags, and 3-5 queries **per source**.
   Output is validated and normalised. The result is cached per product, so the same link is not analysed twice.
3. **Search.** The queries and hashtags drive each collector.
4. **Compare.** The product photo and up to 6 video thumbnails per call go to the model, which returns a 0-100 visual score
   and a short reason for each thumbnail (`visualMatch.js`). Scores are cached per photo + thumbnail.
5. **Score and rank.** See below. Every video carries the reason, shown in the table, cards and detail drawer.
6. **Degrade, never fail.** No key, no photo, or a failed call falls back to text matching and the UI says so.

## Scoring (0-100) and the match threshold

Pure function in `scoring.js`.

| Component | With a visual comparison | Text only |
|---|---|---|
| Visual match (photo vs thumbnail) | 40 | - |
| Keyword coverage | 25 | 45 |
| Exact product name or brand mention | 10 | 20 |
| Hashtag overlap | 10 | 15 |
| Attribute hits (colour, material ...) | 5 | 10 |
| Engagement and recency | 10 | 10 |

Videos below `MATCH_THRESHOLD` (default 40) are **flagged "Low match"**, dimmed, counted separately in the coverage panel and
can be hidden with one toggle. They are not silently discarded, so you can see what the system rejected and why.

## De-duplication strategy

History is kept **per product** (`name:<normalised name>`, `link:<canonical url>` or `image:<hash>`) in SQLite.

1. **Against history.** Every returned video id is stored as `source:id`; later searches drop anything stored.
2. **Cursor memory.** The last cursor per product and source is stored, so a repeat search continues where the last one stopped.
3. **Within one result set.** Duplicates are removed by id, by canonical URL (no tracking params, no `www`, no trailing
   slash), and by a **near-duplicate fingerprint**: author + the first 120 normalised caption characters (lower-case, no
   links, punctuation collapsed). That catches reposts, re-uploads and the same ad running under several IDs.
4. **Shortfall.** If de-dup leaves fewer than 20, more pages are fetched before giving up.
5. **Show previously seen.** A toggle loads the earlier results for the same product on demand and marks them "Seen before".

## Dashboard

Search bar for a name or link with an optional photo upload; source toggles; product panel (title, image, detected
attributes, queries); per-source tabs with live `count / 20`; coverage panel with a "minimum met" state; table and card
views with thumbnail, platform badge, caption or ad copy, match score and reason; detail drawer with score breakdown and
inline player where the platform allows embedding (Instagram, TikTok; Meta ad snapshots only open in a new tab); filters
(text, minimum score, hide low matches, show previously seen); sorting by best match, newest, likes, views; CSV export
(formula-injection safe); history list; a progress panel that follows the pipeline (reading, analysing, per-source counts,
scoring, saving); error and empty states that say what to try next. Responsive down to tablet width.

## Security and operations

* Input validated with zod; JSON body capped at 3 MB (room for one photo); uploads checked for type and size; rate limit per IP.
* Product links: only http(s) on ports 80/443, no embedded credentials, no `localhost`/`.local`/`.internal`; DNS is resolved
  and every address must be public (blocks 10/8, 127/8, 169.254/16 cloud metadata, 172.16/12, 192.168/16, CGNAT, IPv6
  loopback/ULA/link-local, IPv4-mapped IPv6). Redirects are followed manually and each hop is re-checked. Response size
  (2 MB) and time (8 s) are capped. The product image URL passes the same check.
* Secrets only come from environment variables; `.env` is git-ignored; pino redacts token fields.
* Structured JSON logs (request, search start/finish, retries, collector failures). Errors have the shape
  `{ "error": { "code", "message" } }`. Caching: product pages, image analysis and thumbnail comparisons (TTL, size-bounded).
* Tests (`npm test`, 52): de-dup, scoring incl. visual weights, URL guard, retry/timeout/cache, a flaky source that is
  retried, a dead source that does not break the other, a source that hits its deadline, image upload validation, the full
  pipeline (20 + 20, repeat search returns only new videos), and the HTTP flow (202, SSE, polling, `/previous`, errors).

## Test evidence

`docs/TEST_EVIDENCE.md` is generated by `backend/scripts/evidence.js`: results for 5 products with per-source counts,
strong matches, a repeat-search proof (0 videos repeated) and good / bad examples with the reason shown in the UI.
**The committed file must come from a `PROVIDER_MODE=live` run**; the header of the file says which mode produced it.

## Known limitations

* **Instagram hashtag search** returns recent public media only, is limited to 30 distinct hashtags per 7 days per account,
  and gives no creator names, no view counts and **no thumbnail for Reels**. So Instagram videos have no image to compare
  and fall back to text scoring, which the UI states per video. `ENRICH_THUMBNAILS=true` tries the public `og:image` of each
  permalink (instagram.com only, low concurrency, cached). It is **off by default** because it fetches platform pages
  outside the official API; review the platform terms before turning it on. The alternative is a licensed data provider.
* **Meta Ad Library API** has broad coverage mainly for ads in the EU/UK and political or issue ads elsewhere; check what your
  token returns for the countries in `META_AD_COUNTRIES` before relying on a market. It exposes a snapshot page, not the
  video file, and does not say whether an ad is a video, so "video ads only" is not enforced by the API. Thumbnails are not
  returned either.
* Visual comparison therefore only runs on videos that have a thumbnail; `visual.compared` and the notes in each result say
  how many were compared. In live mode this is the biggest accuracy gap.
* The SSRF guard resolves DNS before fetching; a determined DNS-rebinding attack could still race that check. Pinning the
  resolved IP in a custom dispatcher would close it.
* The job queue and rate limiter are in-process; jobs are lost on restart and need Redis for multiple instances.
* Docker files have not been run in my environment.

## What I would build next

1. Real frames: thumbnails or key frames from a licensed data provider, compared with the product image using embeddings
   (CLIP-style) for a fast first pass and the vision model only for the top candidates.
2. Redis + BullMQ for jobs and rate limits, so searches survive restarts and scale out.
3. Pin resolved IPs for outbound fetches.
4. A labelled set of good/bad matches to tune the threshold and weights instead of hand-picking them.
5. Users, per-user history and saved shortlists; more sources (YouTube Shorts) behind the same collector interface.
 
## Note on test evidence 
The evidence in docs/TEST_EVIDENCE.md was generated in mock (sample-data) mode, because I could not finish the Meta/Instagram app setup in time. Live mode is implemented but has not been tested with real keys yet. 
 
Demo video: https://drive.google.com/file/d/1FmJclbxE-6dQhAG7GqhCDwg94m3h6-TJ/view?usp=drive_link 
