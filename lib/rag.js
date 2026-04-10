/**
 * rag.js — Retrieval-Augmented Generation for curated location data
 *
 * Architecture:
 * - Location JSON files in /data/locations/{city-slug}.json
 * - Each file contains curated restaurants, excursions, hidden gems, events
 * - retriveContext() pulls relevant entries based on user preferences
 * - Returns a compact text block injected into the LLM prompt
 *
 * For production at scale, replace the JSON file lookup with:
 * - Pinecone / Weaviate / pgvector for semantic search
 * - Embed each venue description, query by preference embedding
 * - This gives fuzzy matching: "cosy" → finds intimate wine bars etc.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data", "locations");

/**
 * Normalise city name to a file slug.
 * "New York City" → "new-york-city"
 * "São Paulo" → "sao-paulo"
 */
function citySlug(city) {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Load the curated knowledge base for a city.
 * Returns null if no data file exists (graceful degradation).
 */
function loadLocationData(city) {
  const slug = citySlug(city);
  const filePath = join(DATA_DIR, `${slug}.json`);

  if (!existsSync(filePath)) {
    console.log(`No curated data for "${city}" (slug: ${slug}) — LLM uses training knowledge only`);
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch (err) {
    console.error(`Failed to parse ${filePath}:`, err.message);
    return null;
  }
}

/**
 * Score a venue against user preferences.
 * Higher score = more relevant to retrieve.
 */
function scoreVenue(venue, prefs) {
  let score = venue.priority ?? 5; // base score from curated data

  // Budget match
  const budgetMap = { budget: 1, "mid-range": 2, comfort: 3, luxury: 4 };
  const userBudget = budgetMap[prefs.budget?.toLowerCase()] ?? 2;
  const venueBudget = budgetMap[venue.price_tier?.toLowerCase()] ?? 2;
  if (Math.abs(userBudget - venueBudget) <= 1) score += 2;

  // Interest match
  if (prefs.interests) {
    for (const interest of prefs.interests) {
      if (venue.tags?.includes(interest)) score += 3;
    }
  }

  // Food style match
  if (prefs.foodStyle) {
    for (const style of prefs.foodStyle) {
      if (venue.tags?.includes(style)) score += 3;
    }
  }

  // Group match
  if (venue.good_for?.includes(prefs.group?.toLowerCase())) score += 1;

  return score;
}

/**
 * Main RAG retrieval function.
 *
 * @param {string} city
 * @param {object} prefs  - user preferences
 * @param {object} weather - parsed weather context (optional)
 * @returns {string}      - text block for injection into LLM prompt
 */
export function retrieveContext(city, prefs, weather = null) {
  const data = loadLocationData(city);
  if (!data) return "";

  const sections = [];
  const MAX_PER_CATEGORY = 5; // keep token cost low

  // ── Restaurants ──────────────────────────────────────────
  if (data.restaurants?.length > 0) {
    const isRainy = weather?.days?.some((d) => d.planning_flags?.some((f) => f.includes("RAIN")));

    let restaurants = data.restaurants
      .map((r) => ({ ...r, _score: scoreVenue(r, prefs) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, MAX_PER_CATEGORY);

    // Prefer indoor restaurants if rain expected
    if (isRainy) {
      restaurants = restaurants.sort((a, b) =>
        (b.indoor ? 1 : 0) - (a.indoor ? 1 : 0)
      );
    }

    const lines = restaurants.map((r) =>
      `- ${r.name} (${r.cuisine}, ${r.price_tier}, ${r.neighbourhood}): ${r.description}${r.must_try ? ` Must try: ${r.must_try}.` : ""}`
    );
    sections.push("CURATED RESTAURANTS:\n" + lines.join("\n"));
  }

  // ── Excursions & Activities ───────────────────────────────
  if (data.excursions?.length > 0) {
    const excursions = data.excursions
      .map((e) => ({ ...e, _score: scoreVenue(e, prefs) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, MAX_PER_CATEGORY);

    const lines = excursions.map((e) =>
      `- ${e.name} (${e.duration}, ${e.price_tier ?? "varies"}, ${e.neighbourhood ?? ""}): ${e.description}${e.booking_tip ? ` Tip: ${e.booking_tip}.` : ""}`
    );
    sections.push("CURATED EXCURSIONS & ACTIVITIES:\n" + lines.join("\n"));
  }

  // ── Hidden Gems ───────────────────────────────────────────
  if (data.hidden_gems?.length > 0 && prefs.interests?.includes("offbeat")) {
    const gems = data.hidden_gems.slice(0, MAX_PER_CATEGORY);
    const lines = gems.map((g) =>
      `- ${g.name} (${g.neighbourhood}): ${g.description}`
    );
    sections.push("LOCAL HIDDEN GEMS (prioritise these over tourist spots):\n" + lines.join("\n"));
  }

  // ── Seasonal / Event context ──────────────────────────────
  if (data.seasonal_notes) {
    const month = new Date().getMonth(); // 0-11
    const season = data.seasonal_notes.find(
      (s) => s.months?.includes(month)
    );
    if (season) {
      sections.push(`SEASONAL CONTEXT (${season.label}): ${season.notes}`);
    }
  }

  // ── Markets ───────────────────────────────────────────────
  if (data.markets?.length > 0 && prefs.interests?.includes("markets")) {
    const lines = data.markets.map((m) =>
      `- ${m.name} (${m.days}, ${m.neighbourhood}): ${m.description}`
    );
    sections.push("LOCAL MARKETS:\n" + lines.join("\n"));
  }

  if (sections.length === 0) return "";

  return [
    "--- CURATED LOCAL KNOWLEDGE BASE (prefer these over generic suggestions) ---",
    ...sections,
    "--- END LOCAL KNOWLEDGE ---",
  ].join("\n\n");
}
