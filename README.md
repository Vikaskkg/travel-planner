# 🧭 WanderWise — Local Itinerary Planner

An AI-powered local travel itinerary planner built with **Next.js**, supporting both **Claude (Anthropic)** and **ChatGPT (OpenAI)** as the LLM backend.

**Covers:** Sightseeing · Food & Drinks · In-city Transport · Culture  
**Excludes:** Hotels · Flights · Intercity travel

---

## Features

- **Intuitive preference UI** — chips for interests, food style, transport; dropdowns for group/pace/budget
- **AI model switcher** — toggle between Claude (Haiku) and ChatGPT (GPT-4o mini) in the header
- **Multi-agent loading view** — shows each specialist agent working in sequence
- **Beautiful day-by-day itinerary** — expandable slot cards with tips, costs, neighbourhoods
- **Transport slots** — visual dividers showing how to travel between locations

---

## Quick Start (Local)

### 1. Install dependencies

```bash
npm install
```

### 2. Add your API keys

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

```env
ANTHROPIC_API_KEY=sk-ant-...   # from platform.anthropic.com
OPENAI_API_KEY=sk-...           # from platform.openai.com (optional)
```

> **Free credits:** Sign up at [platform.anthropic.com](https://platform.anthropic.com) to get ~$5 free API credits — no card needed.

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel (Free)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial WanderWise commit"
gh repo create wanderwise --public --push
```

### Step 2 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo
3. Under **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your Anthropic key
   - `OPENAI_API_KEY` = your OpenAI key (optional — only needed if using ChatGPT toggle)
4. Click **Deploy**

You'll get a live URL like `wanderwise.vercel.app` in ~2 minutes.

---

## Models Used

| Toggle | Model | Cost per itinerary | Notes |
|--------|-------|--------------------|-------|
| Claude | `claude-haiku-4-5-20251001` | ~$0.001–0.003 | Fast, cheap, great for demos |
| ChatGPT | `gpt-4o-mini` | ~$0.002–0.005 | Good quality, slightly pricier |

Upgrade Claude to `claude-sonnet-4-6` in `pages/api/generate.js` for richer, more nuanced plans.

---

## Cost Estimate

| Traffic | Monthly API cost |
|---------|-----------------|
| Demo (10–50 generations) | $0 (within free credits) |
| Light (100–200 generations) | ~$1–5 |
| Medium (1000 generations) | ~$10–30 |

Hosting on Vercel Hobby plan: **£0/month**

---

## Project Structure

```
travel-planner/
├── pages/
│   ├── index.js          # Main UI (preference form + itinerary display)
│   └── api/
│       └── generate.js   # Serverless function — calls Claude or OpenAI
├── styles/
│   └── globals.css       # Typography + CSS variables
├── .env.local            # Your API keys (never commit this)
├── .env.example          # Template for deployment
└── next.config.js
```

---

## Customisation

**Change the model:** Edit `pages/api/generate.js` — update the model string.

**Add more days:** The UI caps at 10 days. The LLM generates exactly what's requested.

**Add a language selector:** Pass `language` in the preferences object and add it to the system prompt.

**Add map view:** Integrate Leaflet.js or Google Maps — add `lat`/`lng` to the JSON schema in the system prompt.

---

## Roadmap Ideas

- [ ] Map view with pins for each slot
- [ ] PDF / share export
- [ ] Saved itineraries (localStorage or Supabase)
- [ ] Chat-based refinement ("make day 2 more relaxed")
- [ ] Multi-language support
- [ ] Weather integration (show forecast per day)
