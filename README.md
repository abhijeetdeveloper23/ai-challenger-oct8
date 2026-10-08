# Lead Intelligence

> Don't just find leads. Find the leads most worth contacting.

Lead Intelligence is a MERN MVP that discovers local businesses and ranks them by **sales opportunity** — not just raw contact data.

Traditional lead tools answer: *"What businesses exist?"*  
This product answers: *"Which businesses have the strongest sales opportunity?"*

```text
Discovery → Data Quality → Website Intelligence → Lead Scoring → Opportunity Detection
```

---

## Features

- **Multi-source lead discovery** (SerpAPI + Google Places + Foursquare in parallel, merge/dedupe, demo fallback)
- **Website analysis** as a second insight source (booking, HTTPS, forms, social)
- **Deterministic lead scoring** (0–100) with explainable breakdown
- **Sales opportunity detection** (no website, no booking, weak digital presence, etc.)
- **Homepage website analysis** (HTTPS, booking, contact form, social, etc.)
- **Deduplication** (source ID → website → phone → name+address)
- **Filtering & pagination** by score, priority, opportunity, contact signals
- **CSV export** of filtered leads
- **AI approach guide** on lead detail (business summary + why useful + how to approach — never drives the numeric score)
- **AI business profile** during company enrichment (optional, facts-only)
- **Enhancement / owner details** — select companies, look up owner + LinkedIn signals for outreach
- **Demo mode** so the product is always demonstrable without external APIs

---

## Architecture

```text
┌──────────────┐     POST /api/search      ┌─────────────────────────────┐
│ React Client │ ─────────────────────────►│ Express API                 │
│ Vite + TS    │ ◄─────────────────────────│                             │
│ Tailwind     │     scored leads + reasons│  discovery → dedupe →       │
└──────────────┘                           │  website analyze → score    │
                                           │           ↓                 │
                                           │      MongoDB Atlas/local    │
                                           │   Leads · Searches · Jobs   │
                                           └─────────────────────────────┘
```

Monorepo layout:

```text
lead-intelligence/
├── client/          # React + Vite + TypeScript + Tailwind
├── server/          # Express + TypeScript + Mongoose
├── package.json     # concurrently: npm run dev
└── README.md
```

---

## Tech stack

| Layer    | Stack |
|----------|--------|
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, Axios, Lucide React |
| Backend  | Node.js, Express, TypeScript, Mongoose, Axios, Cheerio, Zod |
| Database | MongoDB / MongoDB Atlas |
| Security | Helmet, CORS (`CLIENT_URL`), express-rate-limit |

---

## Setup

```bash
git clone <repo-url>
cd saasquatchleads   # or lead-intelligence
npm install
npm install --prefix server
npm install --prefix client
cp server/.env.example server/.env
# Ensure MongoDB is running locally, or set MONGODB_URI to Atlas
npm run dev
```

- API: http://localhost:5001  
- UI: http://localhost:5173  

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default `5001`) |
| `CLIENT_URL` | Frontend origin(s) for CORS — **no trailing slash** (default `http://localhost:5173`; comma-separate multiples) |
| `MONGODB_URI` | MongoDB connection string |
| `DEMO_MODE` | `true` → force demo dataset only |
| `DISCOVERY_PROVIDERS` | Comma list, e.g. `serpapi,google_places,foursquare` |
| `DISCOVERY_PROVIDER` | Fallback single: `demo` / `serpapi` / `google_places` / `foursquare` / `multi` |
| `DISCOVERY_API_KEY` | SerpAPI key |
| `GOOGLE_PLACES_API_KEY` | Google Places API (New) key |
| `FOURSQUARE_API_KEY` | Foursquare Places API v3 key |
| `WEBSITE_TIMEOUT_MS` | Per-site HTTP timeout |
| `WEBSITE_CONCURRENCY` | Parallel website analyses |
| `OPENAI_API_KEY` | Optional — sales insight narrative only |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | API rate limiting |

See `server/.env.example`.

---

## Demo mode

```env
DEMO_MODE=true
```

When enabled (or when no discovery API key is set), search uses a deterministic dataset of ~20 Indore dental businesses covering:

- no website + high reviews  
- strong website / booking  
- unreachable site / no HTTPS  
- missing phone or email  
- duplicates for dedupe demos  

This keeps the final presentation independent of external API quotas.

---

## Scoring algorithm (max 100)

| Category | Max | Rules |
|----------|-----|--------|
| Business Activity | 30 | Reviews: 100+ → 20, 50–99 → 15, 20–49 → 10, 5–19 → 5. Rating ≥4.5 → +10, ≥4.0 → +5 |
| Contactability | 20 | Phone +10, Email +10 |
| Digital Opportunity | 30 | No website +25, unreachable +20, no HTTPS +10 |
| Conversion Opportunity | 20 | No booking +15, no contact form +5 |

**Priority bands:** HOT 85–100 · HIGH 70–84 · MEDIUM 50–69 · LOW 0–49

The score is **never** computed by an LLM.

---

## API documentation

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/search` | Discover + analyze + score (`{ query, location }`) |
| `GET` | `/api/leads` | List/filter leads (`page`, `limit`, `minScore`, `priority`, `opportunity`, `hasWebsite`, `hasPhone`, `hasEmail`, `searchId`, …) |
| `GET` | `/api/leads/:id` | Lead detail |
| `GET` | `/api/leads/export` | CSV export (same filters) |
| `POST` | `/api/leads/:id/insight` | Optional sales insight narrative |
| `POST` | `/api/leads/enrich-owners` | People enrichment — owners / LinkedIn (`{ leadIds }` max 25) |
| `POST` | `/api/leads/enrich-companies` | Company enrichment — website email / social / signals (`{ leadIds }` max 25) |

---

## Deployment

| Piece | Suggested host |
|-------|----------------|
| Frontend | Vercel |
| Backend | Render / Railway |
| Database | MongoDB Atlas |

Set `CLIENT_URL` to the frontend origin and `MONGODB_URI` to Atlas. Keep `DEMO_MODE=true` for demos without discovery credentials.

---

## Design decisions

We prioritized **sales prioritization** over building a huge scraper:

1. Explainable scoring beats opaque AI ranks for a sales demo.  
2. Opportunity detection turns raw listings into a pitch.  
3. Demo mode guarantees a reliable presentation.  
4. Provider abstraction allows live discovery later without rewriting the pipeline.  
5. Homepage-only website analysis keeps latency acceptable for an MVP.

---

## Limitations

- Demo discovery is curated sample data (clearly labeled `isDemo`).  
- Live discovery uses SerpAPI and/or Google Places; if both fail, demo data is used.  
- Google Places needs Places API enabled in Google Cloud.  

- Website analysis covers the homepage only.  
- Search runs synchronously for the MVP (ScrapeJob model prepares for async later).  
- No auth / multi-tenant CRM yet.

---

## Future improvements

- Redis / Upstash for hot cache  
- Async job workers for large searches  
- CRM integrations (HubSpot, Salesforce)  
- Configurable scoring profiles per industry  
- Additional discovery providers  
- Deeper AI personalization of outreach copy  

---

## Scripts

```bash
npm run dev      # client + server
npm run build    # build both
npm run lint     # TypeScript checks
```

Server tests (scoring / dedupe / normalize):

```bash
npm run test --prefix server
```

---

## Final demo flow

1. Open the dashboard.  
2. Industry: **Dentist** · Location: **Indore**.  
3. Click **Find Leads**.  
4. Filter **Minimum Score ≥ 70**.  
5. Open **ABC Dental Clinic** — high reviews, no website, HOT score.  
6. Show score breakdown + primary opportunity.  
7. Export CSV.
