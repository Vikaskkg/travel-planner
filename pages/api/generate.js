import Anthropic from "@anthropic-ai/sdk";
// OpenAI is imported dynamically inside each branch so the SDK never
// validates OPENAI_API_KEY at module load time — only when actually used.
import { fetchWeather } from "../../lib/weather.js";
import { retrieveContext } from "../../lib/rag.js";

// ── System prompt (cached by Anthropic — never changes) ─────────────────────
const SYSTEM_PROMPT = `You are TripPivotal, an expert local travel planner specialising in authentic, immersive city experiences. You create detailed day-by-day itineraries focused exclusively on:
- Local sightseeing (landmarks, hidden gems, neighbourhoods, viewpoints)
- Food and drinks (local restaurants, street food, cafes, markets, bars)
- In-city local transport (metro, bus, tram, walking, cycling, rickshaw, tuk-tuk)
- Cultural experiences (workshops, markets, festivals, community events)

You do NOT include hotels or air/intercity travel.

WEATHER RULES (critical — follow these strictly):
- If RAIN_LIKELY is flagged for a day: move outdoor markets and parks to covered/indoor alternatives
- If HEAT WARNING: schedule all outdoor slots before 11am or after 4pm
- If COLD: open each day with a warm indoor venue (cafe, museum, covered market)
- Always mention weather-adapted tips in the slot tip field

CURATED DATA RULES (critical):
- When a CURATED RESTAURANTS section is provided, you MUST use at least 3 of those specific restaurants by name
- When CURATED EXCURSIONS are provided, prioritise these over generic tourist attractions
- When LOCAL HIDDEN GEMS are provided and the user likes offbeat experiences, include at least 1
- When SEASONAL CONTEXT is provided, weave it naturally into the day themes and tips

IMPORTANT: Keep slot descriptions concise (1-2 sentences). Tips short (1 sentence). Exactly 5 slots per day.

COMMUTE TIME RULES (important):
- Every non-transport slot MUST include a "commute_to_next" object showing how to reach the NEXT slot
- Use realistic times for the city (London tube ~15-25 min, walking ~10 min per km, etc.)
- The last slot of each day should have commute_to_next as null
- Transport slots themselves do NOT need commute_to_next
- commute_mode must be one of: walking|metro|bus|tram|taxi|cycling|auto
- commute_time is in minutes as a number

Return ONLY valid JSON — no markdown, no explanation:
{
  "title": "evocative trip title",
  "city": "city name",
  "tagline": "one-line poetic description",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "weather_note": "one sentence on overall weather for the trip",
  "days": [
    {
      "day": 1,
      "date_label": "Day 1",
      "theme": "day theme",
      "summary": "One sentence describing the day",
      "weather": "sunny|cloudy|rainy|mixed",
      "slots": [
        {
          "id": "d1s1",
          "time": "8:00 AM",
          "duration": "45 min",
          "title": "activity title",
          "description": "1-2 sentences with specific local detail",
          "category": "food|sightseeing|transport|culture|drinks",
          "tip": "one short tip",
          "cost": "Free|£|££|£££",
          "neighbourhood": "neighbourhood name",
          "weather_sensitive": false,
          "commute_to_next": {
            "mode": "walking|metro|bus|tram|taxi|cycling|auto",
            "time": 12,
            "label": "12 min walk to Shoreditch"
          }
        }
      ]
    }
  ]
}`;

// ── User prompt builder ──────────────────────────────────────────────────────
// One of these is picked randomly when surprise=true so every call feels different
const SURPRISE_ANGLES = [
  "Focus on a single neighbourhood and go absurdly deep — every slot should be within walking distance of each other, creating an intimate portrait of one area rather than a city overview.",
  "Build the itinerary around a hidden narrative thread — e.g. the history of one street, a single artisan craft, or a local subculture. Each slot should connect to that thread.",
  "Design the day backwards — start with a late-night experience and plan back to morning, optimising for atmosphere at each hour rather than efficiency.",
  "Prioritise encounters with real locals over sights — markets where vendors know each other, community cafes, neighbourhood parks at the right hour, local sports events.",
  "Create a sensory itinerary — each slot should be chosen for a different dominant sense: a sound (street musician, market noise), a smell (bakery, spice shop), a texture, a taste, a view.",
  "Build around slow transitions — long walks between places are intentional, each route chosen for what you pass rather than speed. Minimise transport slots.",
  "Focus entirely on things that only exist in this city and nowhere else — hyper-local dishes, unique architectural details, traditions found only here.",
  "Design for golden hour and dusk — anchor the itinerary around the best light moments of the day and build everything else around them.",
];

function buildUserPrompt(prefs, weatherContext, ragContext, surprise = false) {
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

  if (surprise) {
    const angle = SURPRISE_ANGLES[Math.floor(Math.random() * SURPRISE_ANGLES.length)];
    parts.push(
      "",
      "SURPRISE MODE — CREATIVE BRIEF (follow this carefully):",
      angle,
      "Make this itinerary feel fundamentally different from a standard tourist plan.",
      "The title and tagline must reflect this unique angle.",
    );
  }

  if (weatherContext?.prompt_block) {
    parts.push("", weatherContext.prompt_block);
  }

  if (ragContext) {
    parts.push("", ragContext);
  }

  parts.push("", "Rules: exactly 5 slots per day, 1-2 sentence descriptions. Use curated venues by name where provided.");

  return parts.join("\n");
}

// ── JSON extraction with truncation recovery ─────────────────────────────────
function extractJSON(text) {
  let clean = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON found in response");
  clean = clean.slice(start, end + 1);

  try {
    return JSON.parse(clean);
  } catch {
    for (const tail of ["]}]}", "]}"]) {
      const idx = clean.lastIndexOf(tail);
      if (idx !== -1) {
        try { return JSON.parse(clean.slice(0, idx + tail.length)); } catch {}
      }
    }
    throw new Error("Itinerary was cut off — please try again");
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { preferences, model, surprise = false } = req.body;
  if (!preferences || !model) {
    return res.status(400).json({ error: "Missing preferences or model" });
  }

  try {
    // ── Step 1: Fetch weather and RAG context in parallel ──────────────────
    const [weatherContext, ragContext] = await Promise.all([
      fetchWeather(preferences.city, preferences.days),
      Promise.resolve(retrieveContext(preferences.city, preferences, null)),
    ]);

    // Re-run RAG with weather context now available (for rain-aware filtering)
    const ragContextWithWeather = retrieveContext(preferences.city, preferences, weatherContext);

    const userPrompt = buildUserPrompt(preferences, weatherContext, ragContextWithWeather, surprise);

    console.log("\n========== TripPivotal PROMPT ==========");
    console.log("Weather :", !!weatherContext, "| RAG :", ragContextWithWeather.length > 0, "| Model:", model, "| Surprise:", surprise);
    console.log("--- SYSTEM PROMPT (" + SYSTEM_PROMPT.length + " chars) ---");
    console.log(SYSTEM_PROMPT);
    console.log("--- USER PROMPT (" + userPrompt.length + " chars) ---");
    console.log(userPrompt);
    console.log("Token estimate:", Math.round((SYSTEM_PROMPT.length + userPrompt.length) / 4));
    console.log("=======================================\n");

    // ── Step 2: Call LLM with prompt caching ──────────────────────────────
    let text = "";
    let cacheStats = null;

    if (model === "claude") {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001", // fastest + cheapest — stays under Vercel 10s limit
        max_tokens: 4096, // keep under Vercel 10s timeout on free tier
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" }, // cache the static system prompt
          },
        ],
        messages: [{ role: "user", content: userPrompt }],
      });
      text = response.content.map((b) => b.text || "").join("");
      cacheStats = {
        input_tokens: response.usage.input_tokens,
        cache_write_tokens: response.usage.cache_creation_input_tokens ?? 0,
        cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
        output_tokens: response.usage.output_tokens,
      };
      console.log("Cache stats:", JSON.stringify(cacheStats));

    } else if (model === "openai") {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 4096,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      });
      text = response.choices[0].message.content;

    } else {
      // ── OpenRouter — any model string passed as `openrouter_model` ──────
      // OpenRouter is OpenAI-compatible: same SDK, different baseURL + key.
      // Docs: https://openrouter.ai/docs
      const orModel = preferences.openrouter_model || "meta-llama/llama-3.3-70b-instruct:free";
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({
        apiKey:  process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": process.env.SITE_URL || "https://TripPivotal.vercel.app",
          "X-Title": "TripPivotal Travel Planner",
        },
      });
      const response = await client.chat.completions.create({
        model: orModel,
        max_tokens: 4096,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        // Note: not all OpenRouter models support response_format json_object
        // So we rely on our extractJSON parser instead
      });
      text = response.choices[0].message.content;
      console.log("OpenRouter model used:", orModel);
    }

    // ── Step 3: Parse and return ───────────────────────────────────────────
    const itinerary = extractJSON(text);

    return res.status(200).json({
      itinerary,
      model,
      meta: {
        surprise_mode: !!surprise,
        openrouter_model: model === "openrouter" ? (preferences.openrouter_model || "google/gemini-flash-1.5") : null,
        weather_loaded: !!weatherContext,
        rag_loaded: ragContextWithWeather.length > 0,
        cache_stats: cacheStats,
        weather_summary: weatherContext?.days?.map(d => ({
          day: d.day,
          summary: d.summary,
          temp: d.temp,
          outdoor_suitable: d.outdoor_suitable,
        })) ?? [],
      },
    });

  } catch (err) {
    console.error("Generate error:", err.message);
    return res.status(500).json({ error: err.message || "Generation failed" });
  }
}
