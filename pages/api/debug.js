import { fetchWeather } from "../../lib/weather.js";
import { retrieveContext } from "../../lib/rag.js";

const SYSTEM_PROMPT = `You are WanderWise, an expert local travel planner specialising in authentic, immersive city experiences. You create detailed day-by-day itineraries focused exclusively on:
- Local sightseeing (landmarks, hidden gems, neighbourhoods, viewpoints)
- Food and drinks (local restaurants, street food, cafes, markets, bars)
- In-city local transport (metro, bus, tram, walking, cycling, rickshaw, tuk-tuk)
- Cultural experiences (workshops, markets, festivals, community events)

You do NOT include hotels or air/intercity travel.

WEATHER RULES (critical):
- If RAIN_LIKELY: move outdoor markets/parks to covered/indoor alternatives
- If HEAT WARNING: schedule outdoor slots before 11am or after 4pm
- If COLD: open each day with a warm indoor venue

CURATED DATA RULES (critical):
- When CURATED RESTAURANTS provided, use at least 3 by name
- When CURATED EXCURSIONS provided, prioritise over generic attractions
- When LOCAL HIDDEN GEMS provided and user likes offbeat, include at least 1
- Weave SEASONAL CONTEXT naturally into day themes and tips

IMPORTANT: 1-2 sentence descriptions. Tips 1 sentence. Exactly 5 slots per day.
Return ONLY valid JSON — no markdown, no explanation.`;

function buildUserPrompt(prefs, weatherContext, ragContext) {
  const parts = [
    `Plan a ${prefs.days}-day itinerary for ${prefs.city}.`,
    "",
    "TRAVELLER PROFILE:",
    `- Group: ${prefs.group}`,
    `- Pace: ${prefs.pace}`,
    `- Budget: ${prefs.budget}`,
    `- Interests: ${prefs.interests.join(", ")}`,
    `- Food style: ${prefs.foodStyle.join(", ")}`,
    `- Transport: ${prefs.transport.join(", ")}`,
    `- Notes: ${prefs.notes || "none"}`,
  ];
  if (weatherContext?.prompt_block) parts.push("", weatherContext.prompt_block);
  if (ragContext) parts.push("", ragContext);
  parts.push("", "Rules: exactly 5 slots per day, 1-2 sentence descriptions. Use curated venues by name where provided.");
  return parts.join("\n");
}

function maskKey(key) {
  if (!key) return "NOT SET";
  if (key.length < 8) return "TOO SHORT";
  return `${key.slice(0, 10)}...${key.slice(-4)}`;
}

function slugify(city) {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const city   = req.query.city   || "London";
  const days   = parseInt(req.query.days   || "3");
  const group  = req.query.group  || "Couple";
  const budget = req.query.budget || "mid-range";
  const pace   = req.query.pace   || "Moderate";

  const prefs = {
    city, days, group, pace, budget,
    interests: (req.query.interests || "history,offbeat,markets").split(","),
    foodStyle:  (req.query.foodStyle  || "local,street").split(","),
    transport:  (req.query.transport  || "walking,metro").split(","),
    notes:      req.query.notes || "",
  };

  const report = {
    timestamp: new Date().toISOString(),
    tip: "Customise via query params: ?city=Paris&days=2&budget=luxury&interests=art,offbeat",
    prefs_used: prefs,
    env_keys: {
      ANTHROPIC_API_KEY: maskKey(process.env.ANTHROPIC_API_KEY),
      OPENAI_API_KEY:    maskKey(process.env.OPENAI_API_KEY),
      WEATHER_API_KEY:   maskKey(process.env.WEATHER_API_KEY),
    },
    weather:       null,
    rag:           null,
    final_payload: null,
    errors:        [],
  };

  // ── 1. Weather ──────────────────────────────────────────────────────
  let weatherContext = null;
  try {
    if (!process.env.WEATHER_API_KEY) {
      report.errors.push("WEATHER_API_KEY not set in .env.local");
    } else {
      weatherContext = await fetchWeather(city, days);
      if (weatherContext) {
        report.weather = {
          status:        "OK",
          city:          weatherContext.city,
          country:       weatherContext.country,
          days_returned: weatherContext.days.length,
          days:          weatherContext.days,
          alerts:        weatherContext.alerts,
          prompt_block:  weatherContext.prompt_block,
        };
      } else {
        report.errors.push("Weather returned null — verify WEATHER_API_KEY and city name spelling");
      }
    }
  } catch (err) {
    report.errors.push("Weather fetch threw: " + err.message);
  }

  // ── 2. RAG ─────────────────────────────────────────────────────────
  let ragContext = "";
  try {
    ragContext = retrieveContext(city, prefs, weatherContext);
    report.rag = {
      status:                ragContext.length > 0 ? "OK" : "NO_DATA",
      file_expected:         "data/locations/" + slugify(city) + ".json",
      context_chars:         ragContext.length,
      context_token_estimate: Math.round(ragContext.length / 4),
      full_context:          ragContext || "(empty — no data file found for this city)",
    };
    if (!ragContext) {
      report.errors.push("No RAG file for " + city + ". Create data/locations/" + slugify(city) + ".json");
    }
  } catch (err) {
    report.errors.push("RAG threw: " + err.message);
  }

  // ── 3. Final assembled prompt ───────────────────────────────────────
  const userPrompt = buildUserPrompt(prefs, weatherContext, ragContext);

  report.final_payload = {
    description: "Exact object sent to Anthropic API on each /api/generate call",
    model:       "claude-haiku-4-5-20251001",
    max_tokens:  8000,
    system_message: {
      type:            "text (with cache_control: ephemeral)",
      char_length:     SYSTEM_PROMPT.length,
      token_estimate:  Math.round(SYSTEM_PROMPT.length / 4),
      full_text:       SYSTEM_PROMPT,
    },
    user_message: {
      char_length:    userPrompt.length,
      token_estimate: Math.round(userPrompt.length / 4),
      sections_included: {
        traveller_profile: true,
        weather_block:     !!weatherContext?.prompt_block,
        rag_knowledge:     ragContext.length > 0,
      },
      full_text: userPrompt,
    },
    total_input_tokens_estimate:
      Math.round((SYSTEM_PROMPT.length + userPrompt.length) / 4),
    estimated_cost_usd:
      +(Math.round((SYSTEM_PROMPT.length + userPrompt.length) / 4) * 0.0000008).toFixed(6),
  };

  report.overall_status = report.errors.length === 0
    ? "ALL_OK"
    : report.errors.length + " error(s) — see errors[]";

  res.setHeader("Content-Type", "application/json");
  return res.status(200).send(JSON.stringify(report, null, 2));
}
