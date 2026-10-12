# Video Finder

Paste a product name or product link. The app reads the product (title, text, main image), works out what it
looks like and how people talk about it, then collects at least **20 Instagram Reels** and **20 Meta Ad Library
videos** that match, scores each one from 0 to 100, removes anything you have already seen, and shows the result
in a dashboard. Search the same product again and you get new videos.

* Backend: Node.js 22.13+ (Express, built-in node:sqlite, zod, pino)
* Frontend: Next.js 14 (App Router, React)

## Setup

```bash
# 1. backend
cd backend
cp .env.example .env        # PROVIDER_MODE=mock works with no keys
npm install
npm test                    # unit + pipeline tests
npm run dev                 # http://localhost:4000

# 2. frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

**Mock vs live.** With `PROVIDER_MODE=mock` every collector returns deterministic, clearly labelled
("sample data") videos so you can develop and run the tests without keys. Set `PROVIDER_MODE=live` and fill in
the keys in `backend/.env` for real results. Use live mode for the demo video and test evidence
(`node scripts/evidence.js "product 1" "https://shop/product-2" ...` writes `docs/TEST_EVIDENCE.md`).

## Architecture

```
Search input -> Product resolver -> Image brain -> [Instagram | Meta Ad Library | TikTok (optional)]
                                                          |
                              Search history (seen IDs) -> De-dup + scoring -> React dashboard
```

| Piece | File |
|---|---|
| URL validation / SSRF guard | `backend/src/utils/urlGuard.js`, `safeFetch.js` |
| Product resolver | `backend/src/services/productResolver.js` |
| Image brain | `backend/src/services/imageBrain.js` |
| Collectors | `backend/src/collectors/*.js` |
| De-dup | `backend/src/services/dedup.js` |
| Scoring | `backend/src/services/scoring.js` |
| Orchestration | `backend/src/services/pipeline.js` |
| History (SQLite) | `backend/src/db.js` |
| API | `backend/src/app.js` (`POST /api/search`, `GET /api/history`, `GET /api/history/:id`, `DELETE /api/history`) |

The browser only talks to Next.js; `/api/*` is proxied to the backend (`next.config.mjs`), so there is no CORS
setup to fight with and no secret ever reaches the browser.

## How each video source is collected

All sources use **official APIs** with credentials from environment variables. No scraping, no logging in with
personal accounts.

* **Instagram Reels** - Instagram Graph API hashtag search (`ig_hashtag_search`, then `recent_media`). Items with
  `media_type = VIDEO` (Reels) are kept. Hashtags come from the image brain. Needs an Instagram Business/Creator
  account linked to a Facebook app (`IG_USER_ID`, `IG_ACCESS_TOKEN`).
* **Meta Ad Library** - `ads_archive` endpoint searched with the brain's queries. The API returns a snapshot page
  for each ad rather than a raw video file, so each result links to the snapshot. The `access_token` that Meta
  embeds in `ad_snapshot_url` is stripped before anything is returned.
* **TikTok (optional)** - TikTok Research API, off unless `TIKTOK_ENABLED=true`, and the UI toggle is hidden when
  it is off.

Each collector returns pages with a cursor. The pipeline keeps pulling pages until it has `MIN_VIDEOS_PER_SOURCE`
(20) *new* videos after de-duplication, or hits `MAX_PAGES_PER_SOURCE`. If a source cannot reach the minimum, the
dashboard shows a warning with the real number instead of padding the list.

## How the image brain works

1. The resolver extracts title, description, brand and main image from JSON-LD `Product`, Open Graph or plain HTML.
2. The title, text and image URL go to a vision model (Anthropic Messages API, `ANTHROPIC_MODEL`).
3. It returns JSON: category, attributes (colour, material, style, shape, use case, brand), keywords,
   hashtags and 3-5 short queries **per source**. The output is validated and normalised.
4. Those queries and hashtags drive collection, and the same attributes and keywords feed the scorer.
5. If there is no key or the call fails, a keyword heuristic built from the title is used and the UI says so.

## De-duplication strategy

History is kept **per product** (`name:<normalised name>` or `link:<canonical url>`) in SQLite.

1. **Against history** - every returned video id is stored as `source:id`. Later searches drop anything stored.
2. **Cursor memory** - the last cursor per product and source is stored, so a repeat search continues where the
   last one stopped instead of re-reading the same first page.
3. **Within a batch** - duplicates are removed by id, by canonical URL (no tracking params, no `www`, no trailing
   slash), and by a fingerprint of author plus the first 120 normalised caption characters (catches reposts).

## Scoring (0-100)

Pure function in `scoring.js`: keyword coverage 45, exact product name or brand mention 20, hashtag overlap 15,
attribute hits 10, engagement and recency 10. The breakdown is returned with every video and drawn as a bar on the
card.

## Security and operations

* Input validated with zod; request body capped at 10 KB; rate limit per IP.
* Product links: only http(s) on ports 80/443, no embedded credentials, no `localhost`/`.local`/`.internal`, DNS is
  resolved and every address must be public (blocks 10/8, 127/8, 169.254/16 cloud metadata, 172.16/12, 192.168/16,
  CGNAT, IPv6 loopback/ULA/link-local, IPv4-mapped IPv6). Redirects are followed manually and each hop is
  re-checked. Response size (2 MB) and time (8 s) are capped. The product image URL passes the same check.
* Secrets only come from environment variables; `.env` is git-ignored; pino redacts token fields.
* Structured JSON logs (request, search start/finish, collector failures). Errors have the shape
  `{ "error": { "code", "message" } }`; a failing source never breaks the other sources.
* Tests (`npm test`, 31 tests): de-dup, scoring, URL guard, and the full pipeline (20 + 20, repeat search returns
  only new videos, separate histories per product).

## Known limitations

* The Instagram hashtag API only returns recent public media for a hashtag, is limited to 30 distinct hashtags per
  7 days per account, and does not return creator names or thumbnails.
* The Meta Ad Library API has limited coverage outside political ads and some regions (e.g. EU/UK; configure
  `META_AD_COUNTRIES`). Check what your token can see before relying on a market. It also does not expose the raw
  video file.
* Neither API gives thumbnails, so cards are text-first with a link to the video.
* The SSRF guard resolves DNS before fetching; a determined DNS-rebinding attack could still race that check.
  Pinning the resolved IP in a custom dispatcher would close it.
* Relevance is caption-based. Videos with no caption text cannot score well even if they show the product.
* The in-memory rate limiter is per process; use a shared store if you run several instances.

## What I would build next

1. Match on the video itself: pull a thumbnail or key frame and compare it with the product image using image
   embeddings (CLIP-style), then blend that into the score.
2. Background jobs with progress streaming instead of one long request.
3. Pin resolved IPs for outbound fetches; Redis-backed rate limiting.
4. Users and per-user history; export results to CSV.
5. More sources (YouTube Shorts) behind the same collector interface.
